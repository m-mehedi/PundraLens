"""End-to-end unit and integration tests for PUB NoticeLens."""

from __future__ import annotations

import io
import os
from PIL import Image
import pytest

from pipeline.bangla_date import convert_bangla_digits, convert_to_bangla_digits, parse_bangla_date_to_iso
from pipeline.calendar import generate_ics_calendar
from pipeline.diff_and_duplicates import compute_notice_diff, detect_duplicates
from pipeline.ingestion import process_document
from pipeline.models import Deadline, EventDateTime, Fees, NoticeRecord, TargetStudents
from pipeline.ocr import run_ocr_on_image
from pipeline.preprocess import enhance_and_denoise_image
from pipeline.tts import generate_speech
from storage.db import (
    add_category,
    add_department,
    delete_notice,
    get_all_categories,
    get_all_departments,
    init_db,
    list_notices,
    publish_notice,
    save_notice,
    update_notice,
)
from evaluation.evaluate import evaluate_benchmark


@pytest.fixture(autouse=True)
def _clear_llm_client_cache():
    """Never let a client built with a test key leak into another test."""
    from pipeline import llm

    llm._clients.clear()
    yield
    llm._clients.clear()


def test_bangla_digits_and_dates():
    # Digits
    assert convert_bangla_digits("১৫ অক্টোবর ২০২৬") == "15 অক্টোবর 2026"
    assert convert_to_bangla_digits("2026") == "২০২৬"

    # Dates
    assert parse_bangla_date_to_iso("১৫ অক্টোবর ২০২৬") == "2026-10-15"
    assert parse_bangla_date_to_iso("১৫ই অক্টোবর, ২০২৬") == "2026-10-15"
    assert parse_bangla_date_to_iso("15/10/2026") == "2026-10-15"
    assert parse_bangla_date_to_iso("2026-10-15") == "2026-10-15"
    assert parse_bangla_date_to_iso("10 November 2026") == "2026-11-10"


def test_image_preprocessing():
    # Create a small dummy image
    img = Image.new("RGB", (100, 100), color="white")
    enhanced = enhance_and_denoise_image(img)
    assert enhanced.size == (100, 100)


def test_ingestion_plain_text():
    sample_text = "পরীক্ষা সংক্রান্ত নোটিশ\nতারিখ: ১৫ অক্টোবর ২০২৬"
    result = process_document(plain_text=sample_text)
    assert result.source_type == "plain_text"
    assert "পরীক্ষা" in result.raw_text


def test_gemini_vision_ocr_flattens_content_blocks(monkeypatch):
    """Gemini 3+ returns list-shaped content blocks, not a plain string."""
    import langchain_google_genai
    from langchain_core.messages import AIMessage

    captured = {}

    class FakeLLM:
        def __init__(self, **kwargs):
            captured.update(kwargs)

        def invoke(self, messages):
            return AIMessage(
                content=[
                    {"type": "thinking", "text": "internal reasoning"},
                    {"type": "text", "text": "  বিজ্ঞপ্তি  "},
                    {"type": "text", "text": "বিজ্ঞপ্তির বিবরণ"},
                ]
            )

    monkeypatch.setenv("GOOGLE_API_KEY", "test-key")
    monkeypatch.setattr(langchain_google_genai, "ChatGoogleGenerativeAI", FakeLLM)

    img = Image.new("RGB", (32, 32), color="white")
    text = run_ocr_on_image(img, force_gemini=True)

    assert text == "বিজ্ঞপ্তি  বিজ্ঞপ্তির বিবরণ"
    assert "internal reasoning" not in text
    assert captured["model"] == os.environ.get("GEMINI_MODEL", "gemini-2.5-flash")


def test_ocr_retries_then_degrades_to_placeholder(monkeypatch):
    """OCR failures are retried, then the pipeline degrades instead of raising."""
    from pipeline import ocr

    attempts = {"count": 0}
    sleeps = []

    def failing_ocr(image, force_gemini=False):
        attempts["count"] += 1
        raise RuntimeError("provider unavailable")

    monkeypatch.setattr(ocr, "_ocr_once", failing_ocr)
    monkeypatch.setattr(ocr.time, "sleep", lambda seconds: sleeps.append(seconds))

    img = Image.new("RGB", (16, 16), color="white")
    text = run_ocr_on_image(img)

    assert text == ocr.OCR_UNAVAILABLE_TEXT == "Not available right now"
    assert attempts["count"] == 4  # initial attempt + 3 retries
    assert sleeps == [2, 5, 10]


def test_ocr_returns_text_on_first_success(monkeypatch):
    """A working provider short-circuits the retry loop."""
    from pipeline import ocr

    attempts = {"count": 0}

    def working_ocr(image, force_gemini=False):
        attempts["count"] += 1
        return "notice text"

    monkeypatch.setattr(ocr, "_ocr_once", working_ocr)
    monkeypatch.setattr(ocr.time, "sleep", lambda seconds: None)

    img = Image.new("RGB", (16, 16), color="white")

    assert run_ocr_on_image(img) == "notice text"
    assert attempts["count"] == 1


def test_model_catalogue_is_consistent():
    """Every catalogue key is unique and the default exists."""
    from pipeline import llm

    keys = [spec.key for spec in llm.MODEL_CATALOG]
    assert keys, "catalogue must not be empty"
    assert len(keys) == len(set(keys)), "catalogue keys must be unique"
    assert llm.DEFAULT_MODEL_KEY in keys
    assert llm.default_model().key == llm.DEFAULT_MODEL_KEY

    for spec in llm.MODEL_CATALOG:
        assert spec.provider in ("groq", "gemini")
        assert spec.model_id
        assert spec.max_tokens > 0


def test_get_model_rejects_unknown_key():
    """An unknown model key lists the valid ones."""
    from pipeline import llm

    with pytest.raises(llm.UnknownModelError) as excinfo:
        llm.get_model("does-not-exist")

    assert "does-not-exist" in str(excinfo.value)
    assert llm.DEFAULT_MODEL_KEY in str(excinfo.value)


def test_get_model_supports_custom_entries():
    """`custom:<provider>:<model_id>` runs a model outside the catalogue."""
    from pipeline import llm

    spec = llm.get_model("custom:groq:moonshotai/kimi-k2-instruct")
    assert spec.provider == "groq"
    assert spec.model_id == "moonshotai/kimi-k2-instruct"

    with pytest.raises(llm.UnknownModelError):
        llm.get_model("custom:openai:gpt-4o")


def test_groq_client_requires_api_key(monkeypatch):
    """A missing provider key fails with a message naming the variable."""
    from pipeline import llm

    monkeypatch.delenv("GROQ_API_KEY", raising=False)
    llm._clients.clear()

    with pytest.raises(EnvironmentError) as excinfo:
        llm.get_chat_client(llm.get_model("groq-qwen3.8-27b"))

    assert "GROQ_API_KEY" in str(excinfo.value)


def test_groq_client_uses_catalogue_settings(monkeypatch):
    """The Groq client is built from the catalogue entry."""
    from pipeline import llm

    monkeypatch.setenv("GROQ_API_KEY", "test-key")
    llm._clients.clear()

    spec = llm.get_model("groq-qwen3.8-27b")
    client = llm.get_chat_client(spec)

    assert type(client).__name__ == "ChatGroq"
    assert client.model_name == spec.model_id
    assert client.temperature == spec.temperature
    assert client.model_kwargs["max_completion_tokens"] == spec.max_tokens


def test_groq_schema_is_strict_shaped():
    """The Groq schema closes objects and requires every field."""
    from pipeline.llm import groq_json_schema
    from pipeline.models import NoticeExtract

    schema = groq_json_schema(NoticeExtract)

    assert "$defs" not in schema
    assert schema["additionalProperties"] is False
    assert set(schema["required"]) == set(schema["properties"].keys())
    assert "default" not in schema["properties"]["title"]

    nested = schema["properties"]["fees"]["anyOf"][0]
    assert nested["additionalProperties"] is False
    assert set(nested["required"]) == set(nested["properties"].keys())


def test_invoke_structured_retries_on_invalid_output():
    """A malformed first answer is retried before giving up."""
    from pipeline import llm
    from pipeline.models import NoticeExtract

    class FakeRunner:
        def __init__(self):
            self.calls = 0

        def invoke(self, messages):
            self.calls += 1
            if self.calls == 1:
                raise ValueError("could not parse JSON")
            return {
                "summary_bengali": "বিজ্ঞপ্তি",
                "summary_english": "Notice",
            }

    runner = FakeRunner()

    class FakeClient:
        def with_structured_output(self, *args, **kwargs):
            return runner

    data = llm.invoke_structured(
        FakeClient(),
        llm.get_model("groq-qwen3.8-27b"),
        NoticeExtract,
        [{"role": "user", "content": "text"}],
    )

    assert runner.calls == 2
    assert data["summary_english"] == "Notice"


def test_storage_crud_and_filters():
    init_db()

    # Save draft notice
    notice = NoticeRecord(
        title="Test Notice for Integration Test",
        issuing_office="Test Office",
        date_of_issue="2026-10-18",
        category="exam",
        deadlines=[Deadline(date="2026-10-25", description="Form fillup")],
        target_students=TargetStudents(department="CSE", batch="54"),
        fees=Fees(amount=1000.0, currency="BDT"),
        summary_bengali="টেস্ট সারাংশ",
        summary_english="Test summary",
        status="draft",
        raw_text="Test notice full text content here",
    )
    nid = save_notice(notice)
    assert nid is not None

    # Verify in draft
    drafts = list_notices(status="draft")
    assert any(d.id == nid for d in drafts)

    # Publish
    publish_notice(nid, published_by="Test Runner")
    published = list_notices(status="published")
    assert any(p.id == nid for p in published)

    # Filter by dept
    cse_notices = list_notices(status="published", department="CSE")
    assert any(p.id == nid for p in cse_notices)

    # Clean up test notice
    delete_notice(nid)


def test_calendar_generation():
    notice = NoticeRecord(
        id=999,
        title="Final Exam",
        date_of_issue="2026-10-10",
        deadlines=[Deadline(date="2026-10-25", description="Admit Card")],
        event_date_time=EventDateTime(date="2026-11-01", time="10:00"),
        venue="Exam Hall 101",
    )
    ics_str = generate_ics_calendar([notice])
    assert "BEGIN:VCALENDAR" in ics_str
    assert "END:VCALENDAR" in ics_str
    assert "Admit Card" in ics_str
    assert "20261025" in ics_str
    assert "20261101" in ics_str


def test_tts_audio_generation():
    audio = generate_speech("টেস্ট নোটিশ", lang="bn")
    # If network allows, audio will be bytes, otherwise gracefully None without raising
    if audio is not None:
        assert len(audio) > 0


def test_duplicate_detection_and_diff():
    existing = [
        NoticeRecord(
            id=1,
            title="Semester Final Examination",
            raw_text="The semester final examination for CSE students will be held in November.",
        )
    ]
    new_text = "The semester final examination for CSE students will take place in November."
    dups = detect_duplicates(new_text, existing, threshold=0.60)
    assert len(dups) > 0
    assert dups[0].notice_id == 1

    # Diff
    old_n = NoticeRecord(id=1, title="Exam Notice", fees=Fees(amount=500.0, currency="BDT"))
    new_n = NoticeRecord(id=1, title="Revised Exam Notice", fees=Fees(amount=600.0, currency="BDT"))
    diff = compute_notice_diff(old_n, new_n)
    assert "title" in diff["field_changes"]
    assert "fees" in diff["field_changes"]


def test_benchmark_evaluation():
    results = evaluate_benchmark(limit=5)
    assert results.total_notices == 5
    assert results.mean_character_error_rate >= 0.0
    assert results.overall_extraction_accuracy >= 90.0

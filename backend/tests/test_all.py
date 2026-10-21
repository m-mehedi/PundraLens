"""End-to-end unit and integration tests for PUB NoticeLens."""

from __future__ import annotations

import io
from PIL import Image

from pipeline.bangla_date import convert_bangla_digits, convert_to_bangla_digits, parse_bangla_date_to_iso
from pipeline.calendar import generate_ics_calendar
from pipeline.diff_and_duplicates import compute_notice_diff, detect_duplicates
from pipeline.ingestion import process_document
from pipeline.models import Deadline, EventDateTime, Fees, NoticeRecord, TargetStudents
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

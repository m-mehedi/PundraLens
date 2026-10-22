"""LLM extraction — send OCR text to the configured LLM for structured extraction.

The model is picked from the catalogue in `pipeline.llm`; see
`MODEL_CATALOG` for the available models.
"""

from __future__ import annotations

import logging
from typing import Any, Dict, Optional

from pipeline import llm
from pipeline.bangla_date import parse_bangla_date_to_iso
from pipeline.models import NoticeExtract

logger = logging.getLogger(__name__)


SYSTEM_PROMPT = """You are an expert document analyzer specializing in Bengali and English university notices.

Your task is to extract structured information from the OCR text of a notice and return it as JSON.

Rules:
1. Extract all available fields. If a field is not present, set it to null.
2. Convert Bengali dates and digits (e.g., ১৫ অক্টোবর ২০২৬) to standard ISO dates (YYYY-MM-DD).
3. Classify the notice into one of these categories: exam, registration, fee, holiday, event, scholarship, result, general.
4. Write a short summary in both Bengali and English.
5. Return ONLY valid JSON, no markdown, no explanation.

Output JSON schema:
{
  "title": string or null,
  "issuing_office": string or null,
  "date_of_issue": string or null (ISO date),
  "deadlines": [{"date": string, "description": string}] or null,
  "event_date_time": {"date": string, "time": string} or null,
  "venue": string or null,
  "target_students": {"department": string, "batch": string, "semester": string} or null,
  "required_action": string or null,
  "fees": {"amount": number, "currency": string} or null,
  "contact": string or null,
  "category": one of ["exam", "registration", "fee", "holiday", "event", "scholarship", "result", "general"],
  "summary_bengali": string,
  "summary_english": string
}
"""


def extract_notice(
    ocr_text: str, model: Optional[str] = None
) -> NoticeExtract:
    """Send *ocr_text* to the LLM and return a validated NoticeExtract model.

    Args:
        ocr_text: The OCR text of the notice.
        model: Catalogue key of the model to use (defaults to the default
            model). Unknown keys raise `pipeline.llm.UnknownModelError`.

    Reads API credentials from environment variables:
    - GROQ_API_KEY or GOOGLE_API_KEY, depending on the model's provider.
    """
    spec = llm.get_model(model)
    client = llm.get_chat_client(spec)

    data: Dict[str, Any] = llm.invoke_structured(
        client,
        spec,
        NoticeExtract,
        [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": ocr_text},
        ],
    )

    # Post-process dates deterministically if LLM left them in Bangla
    if data.get("date_of_issue"):
        iso_val = parse_bangla_date_to_iso(data["date_of_issue"])
        if iso_val:
            data["date_of_issue"] = iso_val

    if data.get("deadlines"):
        for dl in data["deadlines"]:
            if dl.get("date"):
                iso_val = parse_bangla_date_to_iso(dl["date"])
                if iso_val:
                    dl["date"] = iso_val

    if data.get("event_date_time") and data["event_date_time"].get("date"):
        iso_val = parse_bangla_date_to_iso(data["event_date_time"]["date"])
        if iso_val:
            data["event_date_time"]["date"] = iso_val

    # LangChain returns a dict; validate against the Pydantic model
    return NoticeExtract(**data)


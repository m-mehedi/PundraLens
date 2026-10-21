"""LLM extraction — send OCR text to Google Gemini via LangChain for structured extraction."""

from __future__ import annotations

import logging
import os
from typing import TYPE_CHECKING

from pipeline.bangla_date import parse_bangla_date_to_iso
from pipeline.models import NoticeExtract

if TYPE_CHECKING:
    from langchain_google_genai import ChatGoogleGenerativeAI

logger = logging.getLogger(__name__)

# Module-level client cache
_client: "ChatGoogleGenerativeAI | None" = None


def _get_client() -> "ChatGoogleGenerativeAI":
    """Get or create the Google Gemini chat client via LangChain (cached)."""
    global _client
    if _client is None:
        from langchain_google_genai import ChatGoogleGenerativeAI

        api_key = os.environ.get("GOOGLE_API_KEY")
        if not api_key:
            raise EnvironmentError(
                "GOOGLE_API_KEY environment variable is not set. "
                "Get one at https://aistudio.google.com/apikey"
            )
        _client = ChatGoogleGenerativeAI(
            model=os.environ.get("GEMINI_MODEL", "gemini-2.5-flash"),
            api_key=api_key,
            temperature=0.1,
        )
        logger.info("Google Gemini client initialized (%s)", os.environ.get("GEMINI_MODEL", "gemini-2.5-flash"))
    return _client


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


def extract_notice(ocr_text: str) -> NoticeExtract:
    """Send *ocr_text* to the LLM and return a validated NoticeExtract model.

    Reads API credentials from environment variables:
    - GOOGLE_API_KEY (required)
    """
    chat_model = _get_client()

    # Use LangChain's structured output to get typed results directly
    structured_llm = chat_model.with_structured_output(NoticeExtract, method="json_schema")

    result = structured_llm.invoke(
        [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": ocr_text},
        ]
    )

    data = result if isinstance(result, dict) else result.model_dump()

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


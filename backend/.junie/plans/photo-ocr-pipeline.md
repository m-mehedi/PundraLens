---
sessionId: session-261017-201210-tbd4
---

# Delivery Plan

## Goal
Build a standalone Python function `process_photo(image_bytes)` that takes a photo of a Bengali/English notice and returns structured JSON with extracted fields. The pipeline: **Photo → DocAligner (deskew/align) → Datalab Cloud OCR (Bengali+English) → LLM (structured extraction)**.

## Scope
- **In scope**: Photo input only. Pipeline as a Python function. Dependencies via `uv`.
- **Out of scope**: PDF input, text input, web API, database, user management, search, QA, calendar export. These come later.

## Pipeline Stages
1. **DocAligner**: Detect document corners, dewarp and crop the document from the photo. Uses `docaligner-docsaid` package with `fastvit_sa24` model (runs locally).
2. **Datalab Cloud OCR**: Send the aligned image to Datalab's cloud API (`datalab-python-sdk`) for OCR with Bengali+English support. Returns markdown/text.
3. **LLM Extraction**: Send OCR text to an OpenAI-compatible API with a prompt that extracts structured fields and returns JSON.

## Output Schema
The LLM returns a JSON object with these fields:
```
{
  "title": str | null,
  "issuing_office": str | null,
  "date_of_issue": str | null,       # ISO date, converted from Bengali dates
  "deadlines": [{"date": str, "description": str}] | null,
  "event_date_time": {"date": str, "time": str} | null,
  "venue": str | null,
  "target_students": {"department": str, "batch": str, "semester": str} | null,
  "required_action": str | null,
  "fees": {"amount": float, "currency": str} | null,
  "contact": str | null,
  "category": one of ["exam", "registration", "fee", "holiday", "event", "scholarship", "result", "general"],
  "summary_bengali": str,
  "summary_english": str
}
```

## Project Structure
```
backend/
├── main.py                  # Entry point: exposes process_photo()
├── pyproject.toml           # Dependencies: docaligner-docsaid, capybara-docsaid, datalab-python-sdk, openai, Pillow
├── pipeline/
│   ├── __init__.py
│   ├── align.py             # DocAligner wrapper
│   ├── ocr.py               # SuryaOCR wrapper
│   ├── extract.py           # LLM extraction with prompt
│   └── models.py            # Pydantic output model
└── README.md                # Self-contained project docs
```

## Key Decisions
- **Python function only** — no web framework. Easy to test, call from scripts or future API.
- **OpenAI-compatible API** — configurable via env vars (`OPENAI_API_KEY`, `OPENAI_BASE_URL`). Works with OpenAI, Ollama, or any compatible provider.
- **Pydantic model** for output — provides validation and clear contract for downstream consumers.
- **uv as package manager** — fast, modern, handles Python versions and dependencies.

## Dependencies
- `docaligner-docsaid` — document corner detection and alignment (local, requires torch)
- `capybara-docsaid` — image preprocessing utilities for docaligner
- `datalab-python-sdk` — Datalab cloud OCR API (Bengali + English, no local models)
- `openai` — LLM client for extraction
- `Pillow` — image handling
- `pydantic` — output model validation
- `torch` — required by docaligner (CPU only)

## Environment Variables
- `DATALAB_API_KEY` — API key for Datalab cloud OCR (get from https://datalab.to)
- `OPENAI_API_KEY` — API key for LLM extraction
- `OPENAI_BASE_URL` — (optional) custom base URL for OpenAI-compatible providers

# Delivery Steps

### * Step 1: Set up project dependencies and structure
Add all pipeline dependencies to `pyproject.toml` and create the module structure.
- Update `pyproject.toml` with dependencies: `docaligner-docsaid`, `capybara-docsaid`, `datalab-python-sdk`, `openai`, `Pillow`, `pydantic`, `torch`.
- Create `pipeline/` package with `__init__.py`, `align.py`, `ocr.py`, `extract.py`, `models.py`.
- Run `uv sync` to install dependencies.

###   Step 2: Implement DocAligner wrapper
Add `pipeline/align.py` with a function that deskews and crops a photo using DocAligner (local).
- `align_image(image: Image.Image) -> Image.Image` — loads the `fastvit_sa24` model via `docaligner-docsaid`, pads the image with `capybara-docsaid`, detects document corners, and returns the cropped, aligned image using OpenCV `warpPerspective`.
- Handle edge cases: if corner detection fails, return the original image (graceful degradation).
- Cache the model load so it's only loaded once across calls.

###   Step 3: Implement Datalab Cloud OCR wrapper
Add `pipeline/ocr.py` with a function that sends an aligned image to Datalab's cloud API for OCR.
- `run_ocr_on_image(image: Image.Image) -> str` — saves the image to a temporary file, calls `client.convert()` via `datalab-python-sdk`, and returns the markdown/text output.
- Reads `DATALAB_API_KEY` from environment variables.
- Return plain text/markdown for the LLM prompt.

###   Step 4: Implement LLM extraction with Pydantic model
Add `pipeline/models.py` and `pipeline/extract.py` for structured output.
- `models.py`: Define `NoticeExtract` Pydantic model with all fields (title, issuing_office, date_of_issue, deadlines, event_date_time, venue, target_students, required_action, fees, contact, category, summary_bengali, summary_english).
- `extract.py`: `extract_notice(ocr_text: str) -> NoticeExtract` — sends OCR text to OpenAI-compatible API with a system prompt that instructs the LLM to extract all fields, convert Bengali dates to ISO format, classify the category, and produce bilingual summaries. Uses `response_format` for JSON output. Reads API key and base URL from env vars.
- Update `main.py` to expose `process_photo(image_bytes: bytes) -> dict` that chains: align → OCR → extract → returns the dict.

###   Step 5: Add integration test and verify end-to-end
Verify the complete pipeline works with a test image.
- Add a simple test script `test_pipeline.py` that loads a sample Bengali notice image, runs `process_photo()`, and prints the structured output.
- Verify each stage: alignment produces a cropped image, OCR returns Bengali text, LLM returns valid JSON matching the Pydantic schema.
- Document usage in `README.md` with example code and env var setup.
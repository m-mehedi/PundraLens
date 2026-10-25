# Handover — `service/`

## Overview

This service extracts structured data from Pundra University notices. It accepts three input types via a single HTTP endpoint:

- **Image** (`.jpg`/`.jpeg`/`.png`) → OCR → extract
- **PDF** (`.pdf`) → OCR → extract
- **Raw text** → extract (no OCR)

Output is a validated JSON object matching `ExtractionSchema`.

**Key architectural rule:** `core/` is **framework-free**. It imports nothing from FastAPI. The `api/` layer wraps `core/`. You can delete `api/` entirely and reuse `core/` in any other Python project as-is.

---

## Architecture / folder map

```
service/
├── core/                       # framework-free, reusable
│   ├── __init__.py
│   ├── schema.py               # ExtractionSchema (single source of truth)
│   ├── exceptions.py           # domain errors: UnsupportedFileType, OCRFailure, ExtractionFailure
│   ├── ocr.py                  # image/PDF bytes -> markdown (Datalab, via temp file)
│   ├── extract.py              # text -> ExtractionSchema (LangChain + Gemini)
│   └── pipeline.py            # process_file() / process_text()
├── api/                        # FastAPI wrapper
│   ├── __init__.py             # loads .env
│   ├── dependencies.py         # shared Extractor (cached)
│   └── main.py                 # app + /extract + /health
└── HANDOVER.md                 # this file
```

**Dependency direction:** `api/` → `core/`. Never the reverse.

---

## How it works (data flow)

```
file (image/PDF)                text
   │                             │
   ▼                             │
ocr_to_markdown()                │
   │                             │
   ▼                             ▼
   └────────► extract_from_markdown()
                      │
                      ▼
               ExtractionSchema
```

- **File input:** bytes are written to a temporary file (preserving the original extension for type detection), sent to Datalab's `convert()`, returned as markdown, temp file is deleted in a `finally` block.
- **Text input:** goes straight to extraction — no OCR.
- **Extraction:** LangChain + Gemini (`gemini-3.5-flash-lite`) with `with_structured_output(ExtractionSchema)`. Retries up to 3× on failure with 429-aware backoff. Rate-limited to 15 RPM.

---

## Endpoints

### `POST /extract`

Accepts multipart form data. Provide **exactly one** of:

| Param | Type | Description |
|-------|------|-------------|
| `file` | UploadFile | Image (`.jpg`/`.jpeg`/`.png`) or PDF (`.pdf`) |
| `text` | string | Raw notice text (skips OCR) |

#### Example: text input

```bash
curl -X POST http://localhost:8000/extract \
  -F 'text=পুণ্ড্র ইউনিভার্সিটি অব সায়েন্স অ্যান্ড টেকনোলজি ...'
```

#### Example: file upload (image)

```bash
curl -X POST http://localhost:8000/extract \
  -F 'file=@notice.png'
```

#### Example: file upload (PDF)

```bash
curl -X POST http://localhost:8000/extract \
  -F 'file=@notice.pdf'
```

#### Example response

```json
{
  "title": "ইসলামিক স্টাডিজ ১৩তম ব্যাচের মৌখিক পরীক্ষার নোটিশ",
  "issuing_office": "Office of the Controller of Examinations",
  "date_of_issue": "2024-12-17",
  "category": "exam",
  "deadline": "2024-12-20",
  "event_date_and_time": "2024-12-21T12:30:00Z",
  "venue": "Pundra University of Science & Technology",
  "departments": "IS",
  "batches": [13],
  "required_action": "বকেয়া সহ ভাইভা পরীক্ষার ফি রকেটের মাধ্যমে পরিশোধ করে মৌখিক পরীক্ষায় অংশগ্রহণ করুন এবং পেমেন্টের তথ্য এসএমএস করে নিশ্চিত করুন।",
  "fees": "২,০০০/- টাকা",
  "contact": "01313377064",
  "notice_no": "পি.ইউ.বি/পরীঃ নিঃ/২০২৪-৬৫৯",
  "notice_summary_bn": "পুণ্ড্র ইউনিভার্সিটি অব সায়েন্স অ্যান্ড টেকনোলজি'র ইসলামিক স্টাডিজ প্রোগ্রামের ১৩তম ব্যাচের মৌখিক পরীক্ষা ২১ ডিসেম্বর ২০২৪ তারিখে অনুষ্ঠিত হবে। শিক্ষার্থীদের ২০ ডিসেম্বরের মধ্যে রকেটের মাধ্যমে পরীক্ষার ফি ও বকেয়া পরিশোধ করতে হবে।",
  "notice_summary_en": "The oral examination for the 13th batch of Islamic Studies program at Pundra University of Science & Technology will be held on December 21, 2024. Students must pay the exam fee and dues via Rocket by December 20, 2024."
}
```

### `GET /health`

```bash
curl http://localhost:8000/health
```
```json
{"status": "ok"}
```

### Error codes

| Status | When |
|--------|------|
| `400` | Both `file` and `text` provided, or neither |
| `415` | Unsupported file type (not `.jpg`/`.jpeg`/`.png`/`.pdf`) |
| `502` | OCR step failed (Datalab error) |
| `422` | Extraction failed (LLM/validation error after retries) |

---

## Core API (for reuse in other projects)

The `core/` module is importable without FastAPI:

```python
from service.core.pipeline import process_file, process_text

# From bytes (image/PDF)
schema = process_file(data_bytes, filename="notice.png")

# From raw text
schema = process_text("পুণ্ড্র ইউনিভার্সিটি ...")

print(schema.model_dump_json(indent=2))
```

### Available functions & classes

| Name | Module | Purpose |
|------|--------|---------|
| `process_file(data, filename)` | `core.pipeline` | Image/PDF bytes → schema |
| `process_text(text)` | `core.pipeline` | Raw text → schema |
| `ocr_to_markdown(data, filename)` | `core.ocr` | Image/PDF bytes → markdown |
| `Extractor` | `core.extract` | Reusable extractor class (chain + rate limit) |
| `extract_from_markdown(text)` | `core.extract` | Text → schema (convenience wrapper) |
| `ExtractionSchema` | `core.schema` | Pydantic output model |

### Domain exceptions

Core raises these — never `HTTPException`:

| Exception | When |
|-----------|------|
| `UnsupportedFileType` | File extension not in the allowed list |
| `OCRFailure` | Datalab `convert()` fails |
| `ExtractionFailure` | LLM call fails after all retries |

Import path: `from service.core.exceptions import UnsupportedFileType, OCRFailure, ExtractionFailure`

---

## Configuration

All secrets live in `backend_evaluation/.env` (gitignored, loaded by `python-dotenv`):

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `DATALAB_API_KEY` | yes | — | Datalab SDK key (for OCR) |
| `GOOGLE_API_KEY` | yes | — | Google/Gemini API key (for extraction) |
| `EXTRACTION_MODEL` | no | `gemini-3.5-flash-lite` | Gemini model string |
| `EXTRACTION_RPM_LIMIT` | no | `15` | Requests per minute cap |

The rate limiter sleeps `(60 / RPM) + 0.5` seconds between requests (4.5s for 15 RPM) and backs off 3× longer on 429 errors.

---

## Setup & run

```bash
# install dependencies
cd backend_evaluation
uv sync

# start the server (auto-reload)
uv run uvicorn service.api.main:app --reload

# interactive docs
open http://localhost:8000/docs
```

Dependencies (already in `pyproject.toml`):

- `fastapi`, `uvicorn[standard]`, `python-multipart` (API layer)
- `langchain`, `langchain-google-genai`, `python-dotenv`, `pydantic` (core layer)
- `datalab-python-sdk` (OCR)

---

## Extending

| Task | Where |
|------|-------|
| Add/rename a schema field | `core/schema.py` only |
| Support a new file type | Add the extension to `SUPPORTED_EXTS` in `core/ocr.py` |
| Change the Gemini model | Set `EXTRACTION_MODEL` env var |
| Change rate limit | Set `EXTRACTION_RPM_LIMIT` env var |
| Add a new endpoint | `api/main.py` — keep logic in `core/` |
| Change the OCR provider | `core/ocr.py` — keep the same function signature |

**Rule of thumb:** if it's HTTP-specific, it goes in `api/`. Everything else goes in `core/`.

---

## Known limitations

- **Synchronous core:** Datalab and LangChain calls are blocking. The API wraps them in `run_in_threadpool` to avoid blocking the event loop.
- **External OCR dependency:** OCR requires a working Datalab API key and network access.
- **Single extraction model:** only Gemini is wired in. To support multiple models, extend `Extractor`.
- **No auth:** the API has no authentication. Add middleware/guards before exposing it publicly.
- **Rate limit is per-process:** the `Extractor` tracks request timing in-memory. If you scale to multiple workers, each gets its own limiter — use a shared store (e.g. Redis) for distributed rate limiting.
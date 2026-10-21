# PundraNoticeLens Backend — Remediation Plan

This document catalogs all identified issues from the code review, organized by severity, with concrete fix descriptions referencing specific files and lines. It serves as a master checklist to tackle problems systematically.

---

## 🔴 Critical Issues

### C1. Evaluation Suite Compares Ground Truth Against Itself

**File:** `evaluation/evaluate.py`  
**Lines:** 89–121

**Problem:** The `evaluate_benchmark()` function compares each field against itself (e.g., `item["title"] == item["title"]`), producing 100% accuracy regardless of actual system performance. Deadlines, event_date_time, fees, and contact are hardcoded to `1.0`. CER defaults to comparing `ground_truth_text` against itself.

**Fix:**
- Redesign `evaluate_benchmark()` to accept `extracted_notices` (actual LLM extraction output) as a parameter alongside `BENCHMARK_NOTICES` (ground truth).
- Compare each extracted field against its ground truth counterpart:
  - `title`: `compute_string_similarity(extracted.title, ground_truth["title"])`
  - `issuing_office`: same pattern
  - `date_of_issue`: exact ISO date match between extracted and ground truth
  - `category`: exact match
  - `deadlines`: compare date and description pairs using fuzzy matching
  - `event_date_time`: compare date and time fields
  - `fees`: compare amount and currency
  - `venue`, `target_students`, `required_action`, `contact`: fuzzy string match
- For CER, either store actual OCR output in `BENCHMARK_NOTICES` or run OCR during evaluation instead of defaulting to ground truth.
- Add an `extracted` key to each benchmark item in `evaluation/benchmark_data.py` to store actual extraction results, or run the full pipeline on sample documents during evaluation.

### C2. No Authentication or Authorization

**Files:** `api.py` (line 56), `ui.py` (role switcher), `api.py` (line 317–321)

**Problem:**
- CORS is set to `allow_origins=["*"]` with `allow_credentials=True` — security anti-pattern.
- No auth on any API endpoint: any user can create, publish, delete, or seed notices.
- `ui.py` role switcher is a cosmetic `st.selectbox` with no authentication.
- `/api/seed-benchmark` is publicly accessible.

**Fix:**
- **Short term (quick win):** Remove `allow_credentials=True` from CORS; restrict `allow_origins` to known origins. Add a simple API key or session-based auth middleware to `api.py`.
- **Medium term:** Implement proper authentication:
  - Add login endpoints (`/api/auth/login`, `/api/auth/logout`) using the existing `users` table in `storage/db.py`.
  - Add an auth middleware/dependency in FastAPI that validates tokens/sessions on protected routes.
  - Protect admin-only endpoints (`/api/seed-benchmark`, `DELETE /api/notices/{id}`, `POST /api/notices/{id}/publish`) with role checks.
  - Replace the cosmetic role switcher in `ui.py` with actual login/logout flow using `st.session_state`.

### C3. Missing `rapidfuzz` Dependency

**File:** `pyproject.toml`  
**Import:** `evaluation/evaluate.py` line 17

**Problem:** `rapidfuzz` is imported but not listed in `pyproject.toml` dependencies. Will cause `ImportError` at runtime.

**Fix:** Add `"rapidfuzz>=3.0.0"` to the `dependencies` list in `pyproject.toml`.

---

## 🟠 High-Priority Issues

### H1. Database Connection Leak Pattern

**File:** `storage/db.py`  
**Functions affected:** `save_notice()` (226–283), `update_notice()` (286–338), `publish_notice()` (341–357), `get_notice_by_id()` (360–369), `delete_notice()` (372–378), `list_notices()` (381–436), `get_all_departments()` (439–446), `get_all_categories()` (463–470)

**Problem:** Most functions create a connection and close it manually but lack `try/finally` blocks. If an exception occurs between `get_connection()` and `conn.close()`, the connection leaks. Only `add_department()` and `add_category()` use `try/finally` correctly.

**Fix:** Wrap all database functions with `try/finally` blocks to guarantee `conn.close()` is called. Alternatively, implement a context manager:

```python
from contextlib import contextmanager

@contextmanager
def db_connection():
    conn = get_connection()
    try:
        yield conn
    finally:
        conn.close()
```

Then refactor all functions to use `with db_connection() as conn:`.

### H2. No Input Validation on File Uploads

**Files:** `api.py` (line 118), `ui.py` (line 454)

**Problem:** `file.read()` reads the entire file into memory with no size limit (DoS risk). No MIME type validation beyond file extension.

**Fix:**
- Add a `MAX_UPLOAD_SIZE` constant (e.g., 10 MB) in `api.py`.
- Check `file.size` or limit `file.read(MAX_UPLOAD_SIZE)` and raise `HTTPException(413)` if exceeded.
- Validate MIME type using `python-magic` or by checking file headers (magic bytes) in addition to extension.
- Apply the same limits in `ui.py` using `st.file_uploader(max_files=1, type=[...])` and a post-upload size check.

### H3. Gemini Model Name May Be Invalid

**Files:** `pipeline/extract.py`, `pipeline/ocr.py`, `pipeline/qa.py` (line 132)

**Problem:** The code references `gemini-3.8-flash` across multiple files. This model name may not exist; current models are `gemini-2.0-flash` or `gemini-2.5-flash`.

**Fix:**
- Verify the correct model name against the Google AI API documentation.
- Replace `gemini-3.8-flash` with the correct model name (likely `gemini-2.5-flash` or `gemini-2.0-flash`).
- Consider making the model name configurable via environment variable (`GEMINI_MODEL`) instead of hardcoding.

### H4. Broken Import in `qa.py`

**File:** `pipeline/qa.py` line 14

**Problem:** `from storage.db import list_notices, NoticeRecord` — `NoticeRecord` is defined in `pipeline.models`, not exported by `storage.db`. This import will fail at runtime.

**Fix:** Change the import to:
```python
from storage.db import list_notices
from pipeline.models import NoticeRecord
```

---

## 🟡 Medium-Priority Issues

### M1. TTS Cache Uses MD5

**File:** `pipeline/tts.py` line 33

**Problem:** `hashlib.md5` is used for cache key generation. MD5 is deprecated for new uses.

**Fix:** Replace `hashlib.md5(...).hexdigest()` with `hashlib.sha256(...).hexdigest()`.

### M2. Bangla Date Parser Has Duplicate Keys

**File:** `pipeline/bangla_date.py` lines 20–23

**Problem:**
```python
"জানুয়ারি": 1,
"জানুয়ারি": 1,  # Duplicate — second overwrites first silently
"ফেব্রুয়ারি": 2,
"ফেব্রুয়ারি": 2,  # Duplicate
```
The author likely intended different Bengali spellings (with/without zero-width characters or variant glyphs) but used identical keys.

**Fix:**
- Identify the intended distinct Bengali spellings (e.g., `জানুয়ারি` vs `জানুয়ারি` — the difference is `য়` vs `য়`).
- Replace duplicate keys with the correct alternative spellings.
- Common variants to add: `জানুয়ারি`, `ফেব্রুয়ারি`, `মার্চ`, `জুলাই`, `আগস্ট`/`আগষ্ট` (already has both), `সেপ্টেম্বর`/`সেপ্টেম্বৰ`.

### M3. Scanned PDF Pages Skip Alignment Step

**File:** `pipeline/ingestion.py` lines 74–75 (image path) vs line ~153 (PDF path)

**Problem:** `_process_image` calls `align_image()` before preprocessing. For scanned PDFs in `_process_pdf`, only `enhance_and_denoise_image` is called — no alignment. Skewed scanned PDF pages will produce poor OCR results.

**Fix:** Add `align_image()` call in the `_process_pdf` page rendering loop, before `enhance_and_denoise_image`.

### M4. No Pagination on Notice Listing

**Files:** `storage/db.py` (`list_notices()`), `api.py`

**Problem:** `list_notices()` returns ALL matching notices. With hundreds of notices, this returns massive payloads and slows the UI.

**Fix:**
- Add `offset` and `limit` parameters to `list_notices()` in `storage/db.py`.
- Append `LIMIT ? OFFSET ?` to the SQL query.
- Update the API endpoint to accept `?offset=&limit=` query parameters.
- Update `ui.py` to use pagination (Streamlit's `st.dataframe` or manual page navigation).

### M5. `binarize_for_ocr` Defined but Never Used

**File:** `pipeline/preprocess.py` lines 51–62

**Problem:** The function is defined but never called. Dead code.

**Fix:** Either:
- Integrate it into the OCR preprocessing pipeline (call it in `ingestion.py` after `enhance_and_denoise_image` and before `run_ocr_on_image`), or
- Remove it if it provides no value.

### M6. Session State Cleanup Incomplete in UI

**File:** `ui.py` line 662

**Problem:** After saving a notice, only `staff_extracted_data` is popped from session state. Keys `staff_raw_text`, `staff_source_type`, `staff_file_name`, `staff_preview_img`, and `staff_duplicates` remain, causing stale data on the next upload.

**Fix:** Pop all staff-related session state keys after saving or add a `reset_staff_form()` helper that clears all keys.

### M7. Benchmark Seed Skips If 20+ Notices Exist

**File:** `evaluation/evaluate.py` line 157

**Problem:** `if len(existing) >= 20` — arbitrary threshold. If a user has 20+ real notices, seed is skipped but evaluation still runs against benchmark data.

**Fix:**
- Increase the threshold to the full benchmark size (32) or use a flag-based approach (check for a specific benchmark notice ID).
- Alternatively, add a `--force-seed` option to overwrite.

---

## 🔵 Low-Priority / Style Issues

### L1. Logging Configured Multiple Times

**Files:** `api.py` (line 44), `ui.py` (line 47)

**Problem:** `logging.basicConfig()` is called in both entry points. The second call is ignored.

**Fix:** Move logging configuration to a single shared module (e.g., `pipeline/logging_config.py`) or to `main.py`. Call it only once at the top-level entry point.

### L2. No `.gitignore` for Sensitive Files

**Problem:** No `.env` or `.db` file exclusion visible.

**Fix:** Create or update `.gitignore` to include:
```
.env
*.db
__pycache__/
data/tts_cache/
*.pyc
.venv/
```

### L3. Hardcoded Default Values

**Files:** `ui.py` (lines 130–131), `api.py` (line 289)

**Problem:**
- Default batch is `"54"`, default semester is 7th.
- `published_by` defaults to `"Staff Publisher"`.

**Fix:**
- Make batch/semester defaults configurable or derive from the most common values in the database.
- Use the authenticated user's name for `published_by` instead of a hardcoded string.

### L4. `NoticeRecord` vs `NoticeExtract` Model Duplication

**File:** `pipeline/models.py`

**Problem:** Two nearly identical models differ only in database fields (`id`, `status`, `created_at`, etc.).

**Fix:** Use inheritance:
```python
class NoticeExtract(BaseModel):
    # common fields

class NoticeRecord(NoticeExtract):
    id: Optional[int] = None
    status: str = "draft"
    created_at: Optional[str] = None
    # ... other DB fields
```

### L5. No Rate Limiting on API

**File:** `api.py`

**Problem:** TTS and QA endpoints call external APIs. Without rate limiting, these could incur significant costs.

**Fix:** Add a simple token-bucket or sliding-window rate limiter (e.g., `slowapi` package) to FastAPI. Start with generous limits (e.g., 30 requests/minute for TTS, 10/minute for QA) and tighten based on usage.

---

## Implementation Order (Recommended)

| Phase | Issues | Rationale |
|-------|--------|-----------|
| **Phase 1 — Quick Fixes** | C3, H4, M1, M2, L2 | One-line to small changes; no risk; immediate wins |
| **Phase 2 — Security** | C2, H2, L5 | Protect the system before other changes |
| **Phase 3 — Reliability** | H1, H3, M3, M5, M6 | Fix connection leaks, model name, and pipeline gaps |
| **Phase 4 — Evaluation** | C1, M7 | Fix the benchmark suite so it actually measures performance |
| **Phase 5 — Polish** | M4, L1, L3, L4 | Pagination, logging, model cleanup, and defaults |

---

## Checklist

- [ ] **C1** Fix evaluation suite self-comparison
- [ ] **C2** Add authentication and authorization
- [ ] **C3** Add `rapidfuzz` to `pyproject.toml`
- [ ] **H1** Fix database connection leaks with `try/finally` or context manager
- [ ] **H2** Add file upload size and MIME validation
- [ ] **H3** Verify and fix Gemini model name
- [ ] **H4** Fix `NoticeRecord` import in `qa.py`
- [ ] **M1** Replace MD5 with SHA-256 in TTS cache
- [ ] **M2** Fix duplicate Bengali month keys
- [ ] **M3** Add alignment step for scanned PDF pages
- [ ] **M4** Add pagination to `list_notices()`
- [ ] **M5** Integrate or remove `binarize_for_ocr`
- [ ] **M6** Complete session state cleanup in UI
- [ ] **M7** Fix benchmark seed threshold
- [ ] **L1** Consolidate logging configuration
- [ ] **L2** Create `.gitignore`
- [ ] **L3** Remove hardcoded defaults
- [ ] **L4** Refactor model duplication with inheritance
- [ ] **L5** Add rate limiting to API endpoints

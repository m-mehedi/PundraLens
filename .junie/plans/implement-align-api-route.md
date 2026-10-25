---
sessionId: session-261023-195951-1g8a
---

# Requirements

### Overview
Port the `POST /api/align` endpoint from the old backend (`backend old/api.py`) to the new backend (`backend/api/main.py`). This endpoint accepts an uploaded image, detects document corners using the DocAligner model, and returns corner coordinates as percentages for the frontend's cropping UI.

### Scope

**In Scope:**
- Add `detect_corners` function to `backend/core/align.py` (currently only has `warp_with_corners`)
- Add `POST /api/align` endpoint to `backend/api/main.py`
- Add `docaligner-docsaid` and `capybara-docsaid` dependencies to `backend/pyproject.toml`

**Out of Scope:**
- Rate limiting (the new backend has no rate limiter infrastructure; the old endpoint had it but the new backend's other endpoints don't either)
- The `/api/warp` endpoint (already exists in the new backend)
- Tests (new backend has no test suite)

# Technical Design

### Current Implementation

**New backend (`backend/`):**
- `backend/api/main.py` — FastAPI app with `/health`, `/extract`, `/api/warp`, `/api/render`. No `/api/align`.
- `backend/core/align.py` — only has `warp_with_corners()` (perspective transform from 4 corners). Missing `detect_corners()`.
- `backend/pyproject.toml` — no `docaligner-docsaid` or `capybara-docsaid` dependencies.
- Pattern: constants like `MAX_UPLOAD_SIZE`, `ALLOWED_IMAGE_EXTENSIONS` live in `api/main.py`. Threaded work via `run_in_threadpool`.

**Old backend (`backend old/`):**
- `backend old/api.py` — `POST /api/align` endpoint (lines 301-372). Validates image upload, calls `detect_corners()`, returns corners as percentages clamped to 0-100.
- `backend old/pipeline/align.py` — full align module: `_load_model()` (DocAligner cache), `_detect_corners_by_channel()` (per-channel heatmap), `_clamp_corners()`, `detect_corners()`, `warp_with_corners()`, `align_image()`.

### Key Decisions

1. **Port `detect_corners` and helpers to `backend/core/align.py`** — keeps all align logic in one module alongside the existing `warp_with_corners`. The new backend already imports from `core.align`.

2. **No rate limiting** — the new backend's other endpoints (`/api/warp`, `/api/render`) have no rate limiting. Adding it only for `/api/align` would be inconsistent.

3. **No API key auth** — the new backend has no authentication middleware. The endpoint will be open like the others.

4. **Same response contract** — return `{"success": true, "data": {"corners": [...], "count": N, "image_width": W, "image_height": H}}` to match the old endpoint and any frontend code that consumes it.

### Proposed Changes

**1. `backend/pyproject.toml`** — add dependencies:
- `docaligner-docsaid>=1.1.1`
- `capybara-docsaid>=0.12.0`

**2. `backend/core/align.py`** — add:
- `_model` module-level cache and `_load_model()` (DocAligner with `fastvit_sa24` config)
- `_detect_corners_by_channel()` — per-channel heatmap postprocess for accurate corner slot mapping
- `_clamp_corners()` — clamp corners to image bounds (0 to width/height)
- `detect_corners(image: Image.Image) -> List[Optional[Tuple[float, float]]]` — main entry point, returns 4-slot list (TL→TR→BR→BL), None for undetected corners

**3. `backend/api/main.py`** — add:
- `POST /api/align` endpoint: accepts image file, validates size/type, calls `detect_corners()` via `run_in_threadpool`, returns corners as percentages (0-100) clamped to bounds
- Import `detect_corners` from `core.align`
- Reuse existing constants: `MAX_UPLOAD_SIZE`, `ALLOWED_IMAGE_EXTENSIONS`

# Delivery Steps

### ✓ Step 1: Add detect_corners to core/align.py
Port the DocAligner-based corner detection from `backend old/pipeline/align.py` to `backend/core/align.py`. This adds the model loading, per-channel detection, clamping, and the public `detect_corners()` function alongside the existing `warp_with_corners()`. Also adds `docaligner-docsaid` and `capybara-docsaid` to `backend/pyproject.toml`. Files: `backend/core/align.py`, `backend/pyproject.toml`.

### ✓ Step 2: Add POST /api/align endpoint to api/main.py
Add the `POST /api/align` endpoint to `backend/api/main.py`. It accepts an image file, validates size and type (reusing existing constants), calls `detect_corners()` via `run_in_threadpool`, and returns corner coordinates as percentages clamped to 0-100 — matching the old endpoint's response contract. File: `backend/api/main.py`.
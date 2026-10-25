---
sessionId: session-261023-194423-c1qy
---

# Requirements

### Overview
Replace the `POST /api/render` 404 stub with a working implementation that renders PDF pages as PNG images. The implementation is ported from `backend old/pipeline/ingestion.py` (the `render_pdf_pages_with_total` function) and the old `backend old/api.py` render endpoint.

### Scope
- **In Scope**: Port the PDF-to-PNG rendering logic into the current backend as a standalone module (`backend/core/render.py`), add `pymupdf` to dependencies, and replace the 404 stub in `backend/api/main.py` with a real endpoint.
- **Out of Scope**: Rate limiting, API key authentication, OCR pipeline integration, scanned-PDF processing, digital-PDF text extraction. Those are concerns of the old backend's full ingestion pipeline and not needed for a render-only endpoint.

### User Story
As a frontend editor, I want to upload a PDF and receive each page as a base64-encoded PNG image, so I can display, crop, and straighten pages before sending them to the OCR pipeline.

# Technical Design

### Current Implementation
The current `backend/api/main.py` has a 404 stub at `POST /api/render` (lines 170-175). The `backend/core/` directory contains pure-logic modules (`ocr.py`, `align.py`, `pipeline.py`, `exceptions.py`, `extract.py`, `schema.py`). The backend depends on `marker-pdf` for OCR but not on `pymupdf`.

The old backend (`backend old/`) has:
- `pipeline/ingestion.py:render_pdf_pages_with_total()` — opens a PDF with `pymupdf`, renders each page to a PNG pixmap at the given DPI, returns `List[Tuple[int, int, int, bytes]]` (page number, width, height, png bytes) plus the total page count.
- `api.py:render_endpoint()` — the HTTP layer: validates the upload (PDF magic bytes, size limit), clamps `dpi` to 72-300 and `max_pages` to 1-100, calls the render function in a thread pool, and returns a JSON response with base64-encoded images.

### Key Decisions
- **Standalone port** — copy only the render function into `backend/core/render.py` rather than importing from `backend old/`. This avoids pulling in the entire old dependency tree (`docaligner-docsaid`, `capybara-docsaid`, `gtts`, etc.). Only `pymupdf` is needed.
- **No rate limiting or auth middleware** — the current backend has neither (unlike the old backend). Adding those is out of scope; the endpoint follows the current backend's pattern of bare endpoints.
- **Sync function + `run_in_threadpool`** — the render function is sync (uses `pymupdf` which is CPU-bound and not async-friendly). The endpoint will dispatch it with `run_in_threadpool`, matching the pattern already used in `/extract` and `/api/warp`.

### Proposed Changes

**1. Add `pymupdf` to `backend/pyproject.toml` dependencies.**

**2. Create `backend/core/render.py`** with a port of `render_pdf_pages_with_total`:
```python
import pymupdf
from typing import List, Optional, Tuple

def render_pdf_pages_with_total(
    pdf_bytes: bytes, dpi: int = 200, max_pages: Optional[int] = None
) -> Tuple[List[Tuple[int, int, int, bytes]], int]:
    """Render pages of a PDF to PNGs.

    Returns one ``(page number, width, height, png bytes)`` tuple per page
    and the total page count of the document.
    ``max_pages`` caps how many pages are rendered.
    """
    doc = pymupdf.open(stream=pdf_bytes, filetype="pdf")
    try:
        total = len(doc)
        limit = total if max_pages is None else min(total, max_pages)
        pages: List[Tuple[int, int, int, bytes]] = []
        for index in range(limit):
            pix = doc[index].get_pixmap(dpi=dpi)
            pages.append((index + 1, pix.width, pix.height, pix.tobytes("png")))
        return pages, total
    finally:
        doc.close()
```

**3. Replace the 404 stub in `backend/api/main.py`** with a real endpoint matching the old backend's contract:
- Accept `file: UploadFile`, `dpi: int = Form(200)`, `max_pages: int = Form(30)`.
- Validate: empty file → 400, size > 10 MB → 413, not PDF (magic bytes `%PDF`) → 400.
- Clamp `dpi` to 72-300, `max_pages` to 1-100.
- Call `render_pdf_pages_with_total` via `run_in_threadpool`.
- Return `{"success": True, "data": {"dpi": ..., "page_count": ..., "total_pages": ..., "pages": [...]}}` with base64-encoded PNGs.

### File Structure
- `backend/pyproject.toml` — add `pymupdf>=1.28.2` to dependencies (modified).
- `backend/core/render.py` — new file, render logic (added).
- `backend/api/main.py` — replace 404 stub with real render endpoint (modified).

### Architecture Diagram
```mermaid
graph LR
    A[POST /api/render] --> B[Validate upload PDF]
    B --> C[run_in_threadpool]
    C --> D[core/render.py render_pdf_pages_with_total]
    D --> E[pymupdf open + get_pixmap]
    E --> F[Return base64 PNG pages]
```

### Risks
- **`pymupdf` installation** — it's a C-extension package; may require build tools on some systems. Mitigation: use `uv add` which handles binary wheels.
- **Large PDFs** — rendering many pages at high DPI produces megabytes of base64 data. The `max_pages` cap (100) and `dpi` cap (300) limit this. The 10 MB upload limit also constrains input size.

# Delivery Steps

### ✓ Step 1: Add POST /api/render 404 stub
Already done. The stub exists at `backend/api/main.py` lines 170-175.

### ✓ Step 2: Add pymupdf dependency and create backend/core/render.py
Add `pymupdf>=1.28.2` to `backend/pyproject.toml` and create the render logic module.
- Append `"pymupdf>=1.28.2"` to the `[project] dependencies` list in `backend/pyproject.toml`.
- Create `backend/core/render.py` with the `render_pdf_pages_with_total` function ported from `backend old/pipeline/ingestion.py`.
- Run `uv sync` in `backend/` to install the new dependency.

### ✓ Step 3: Replace the 404 stub with the real render endpoint in backend/api/main.py
Replace the stub with a full endpoint matching the old backend's contract.
- Import `render_pdf_pages_with_total` from `core.render`.
- Replace the `render_not_implemented` function with `render_endpoint` that accepts `file`, `dpi`, and `max_pages` form parameters.
- Add validation: empty file (400), file too large (413), not a PDF by magic bytes (400).
- Clamp `dpi` to 72-300 and `max_pages` to 1-100.
- Dispatch rendering via `run_in_threadpool` (already imported).
- Return the same JSON structure as the old backend: `{success, data: {dpi, page_count, total_pages, pages: [{page, width, height, image}]}}`.
- Verify with `uv run python -c "from api.main import app; print('OK')"`.
"""PUB NoticeLens — High-Performance Intelligence REST API.

Exposes endpoints for multi-modal ingestion, OCR, structured extraction,
grounded QA, bilingual TTS, duplicate detection, and benchmark evaluation.
"""

from __future__ import annotations

import base64
import io
import logging
import time
import threading
from collections import defaultdict
from typing import Any, Dict, List, Optional

import base64
import io
import json
import logging
import os
import time
import threading
from collections import defaultdict
from typing import Any, Dict, List, Optional, Tuple

from fastapi import FastAPI, File, Form, HTTPException, Response, UploadFile, Request
from fastapi.concurrency import run_in_threadpool
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.security import APIKeyHeader
from pydantic import BaseModel, Field

import pipeline  # Loads .env
from evaluation.evaluate import evaluate_benchmark, seed_database_with_benchmark
from pipeline import llm
from pipeline.align import detect_corners, warp_with_corners
from pipeline.calendar import generate_ics_calendar
from pipeline.diff_and_duplicates import compute_notice_diff, detect_duplicates
from pipeline.extract import extract_notice
from pipeline.ingestion import process_document
from pipeline.logging_config import configure_logging
from pipeline.models import Deadline, EventDateTime, Fees, NoticeExtract, NoticeRecord, TargetStudents
from pipeline.ocr import OCR_UNAVAILABLE_TEXT
from pipeline.qa import answer_question, QAResponse
from pipeline.tts import generate_speech
from storage.db import (
    add_category,
    add_department,
    delete_notice,
    get_all_categories,
    get_all_departments,
    get_notice_by_id,
    init_db,
    list_notices,
    publish_notice,
    save_notice,
    update_notice,
)

# Initialize DB on startup
init_db()

configure_logging()
logger = logging.getLogger(__name__)

app = FastAPI(
    title="PUB NoticeLens Intelligence API",
    description="Backend API for document ingestion, OCR, structured field extraction, and grounded QA",
    version="1.0.0",
)

# Enable CORS for Next.js frontend (default port 3000, 3001)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://localhost:3001",
        "http://localhost:8501",
    ],
    allow_credentials=False,
    allow_methods=["GET", "POST", "PUT", "DELETE"],
    allow_headers=["Authorization", "Content-Type", "X-API-Key"],
)


# ---------------------------------------------------------------------------
# API Key Authentication
# ---------------------------------------------------------------------------

API_KEY_HEADER = APIKeyHeader(name="X-API-Key", auto_error=False)
API_KEY = os.environ.get("API_KEY", "")


async def verify_api_key(request: Request, call_next):
    """FastAPI middleware that checks the X-API-Key header on protected routes."""
    # Skip auth for public endpoints (reads only — writes always need the key)
    public_paths = {
        "/api/health",
        "/api/notices",
        "/api/departments",
        "/api/categories",
        "/docs",
        "/openapi.json",
        "/redoc",
    }
    # Check if the path starts with a public prefix (e.g. /api/notices/123)
    public_prefixes = {"/api/notices/", "/api/align", "/api/extract"}
    path = request.url.path
    if path in public_paths and request.method == "GET":
        return await call_next(request)
    for prefix in public_prefixes:
        if path.startswith(prefix) and request.method == "GET":
            return await call_next(request)

    # Require API key for all other routes
    if not API_KEY:
        # If no API key is configured, allow all requests (development mode)
        return await call_next(request)

    api_key: str = await API_KEY_HEADER(request)
    if not api_key or api_key != API_KEY:
        return JSONResponse(
            status_code=401,
            content={"detail": "Invalid or missing API key"},
        )

    return await call_next(request)


app.middleware("http")(verify_api_key)


# ---------------------------------------------------------------------------
# Request / Response Schemas
# ---------------------------------------------------------------------------

class QARequest(BaseModel):
    query: str
    department: Optional[str] = None
    batch: Optional[str] = None
    model: Optional[str] = Field(
        default=None,
        description="Catalogue key of the model to answer with (defaults to the default model).",
    )


class TTSRequest(BaseModel):
    text: str
    lang: str = Field(default="bn", description="'bn' or 'en'")


class DuplicateCheckRequest(BaseModel):
    text: str
    threshold: float = 0.60


class DiffRequest(BaseModel):
    old_notice: Dict[str, Any]
    new_notice: Dict[str, Any]


class CalendarRequest(BaseModel):
    notice_ids: Optional[List[int]] = None
    department: Optional[str] = None


# ---------------------------------------------------------------------------
# Rate Limiter (Simple Sliding Window)
# ---------------------------------------------------------------------------

class RateLimiter:
    """Simple in-memory sliding window rate limiter."""

    def __init__(self, max_requests: int, window_seconds: int):
        self.max_requests = max_requests
        self.window_seconds = window_seconds
        self.requests: Dict[str, list] = defaultdict(list)
        self.lock = threading.Lock()

    def is_allowed(self, key: str) -> bool:
        now = time.time()
        cutoff = now - self.window_seconds
        with self.lock:
            # Prune old entries
            self.requests[key] = [
                t for t in self.requests[key] if t > cutoff
            ]
            if len(self.requests[key]) >= self.max_requests:
                return False
            self.requests[key].append(now)
            return True


# Generous limits: 30 req/min for TTS, 10 req/min for QA, 60 req/min for extract
rate_limiter_tts = RateLimiter(max_requests=30, window_seconds=60)
rate_limiter_qa = RateLimiter(max_requests=10, window_seconds=60)
rate_limiter_extract = RateLimiter(max_requests=60, window_seconds=60)
rate_limiter_align = RateLimiter(max_requests=30, window_seconds=60)


def _get_client_key(request: Request) -> str:
    """Extract client identifier from request for rate limiting."""
    # Use X-Forwarded-For header if behind a proxy, otherwise client host
    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return (request.client.host if request.client else "unknown")


# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

MAX_UPLOAD_SIZE = 10 * 1024 * 1024  # 10 MB
ALLOWED_FILE_EXTENSIONS = {".pdf", ".png", ".jpg", ".jpeg", ".bmp", ".tiff", ".tif"}

# MIME type magic bytes for validation
MAGIC_BYTES = {
    b"%PDF": "application/pdf",
    b"\x89PNG": "image/png",
    b"\xff\xd8\xff": "image/jpeg",
    b"BM": "image/bmp",
    b"II\x2a\x00": "image/tiff",
    b"MM\x00\x2a": "image/tiff",
}


def validate_file_upload(file: UploadFile, file_bytes: bytes) -> None:
    """Validate file size, extension, and MIME type."""
    # Size check
    if len(file_bytes) > MAX_UPLOAD_SIZE:
        raise HTTPException(
            status_code=413,
            detail=f"File too large. Maximum size is {MAX_UPLOAD_SIZE // (1024 * 1024)} MB.",
        )
    if len(file_bytes) == 0:
        raise HTTPException(status_code=400, detail="Empty file uploaded.")

    # Extension check
    ext = ""
    if file.filename:
        ext = "." + file.filename.rsplit(".", 1)[-1].lower()
    if ext not in ALLOWED_FILE_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"File type not allowed. Allowed: {', '.join(sorted(ALLOWED_FILE_EXTENSIONS))}",
        )

    # Magic bytes check
    if file_bytes[:4] not in MAGIC_BYTES and file_bytes[:3] not in MAGIC_BYTES and file_bytes[:2] not in MAGIC_BYTES:
        # Check all magic byte lengths
        found = False
        for magic in MAGIC_BYTES:
            if file_bytes[:len(magic)] == magic:
                found = True
                break
        if not found:
            raise HTTPException(status_code=400, detail="File format not recognized.")


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@app.get("/api/health")
def health_check() -> Dict[str, Any]:
    """Health check endpoint."""
    default = llm.describe_default()
    return {
        "status": "healthy",
        "service": "PUB NoticeLens API",
        "model": default["model"],
        "llm": default,
    }


@app.get("/api/models")
def list_models_endpoint() -> Dict[str, Any]:
    """List the LLM models this deployment can extract with.

    The catalogue lives in `pipeline/llm.py`; the client picks one by key so
    different models can be compared on the same notice.
    """
    return {
        "success": True,
        "data": {
            "default": llm.DEFAULT_MODEL_KEY,
            "models": llm.list_models(),
        },
    }


@app.post("/api/align")
async def align_endpoint(
    request: Request,
    file: UploadFile = File(...),
) -> Dict[str, Any]:
    """Detect document corners in an uploaded image.

    Accepts image files only (no PDFs). Returns corner coordinates as
    percentages of image dimensions for frontend cropping UI.
    """
    client_key = _get_client_key(request)
    if not rate_limiter_align.is_allowed(client_key):
        raise HTTPException(status_code=429, detail="Rate limit exceeded. Try again later.")

    try:
        file_bytes = await file.read()
        filename = file.filename or "uploaded_image"

        # Validate upload (reuse but reject PDFs)
        if len(file_bytes) > MAX_UPLOAD_SIZE:
            raise HTTPException(
                status_code=413,
                detail=f"File too large. Maximum size is {MAX_UPLOAD_SIZE // (1024 * 1024)} MB.",
            )
        if len(file_bytes) == 0:
            raise HTTPException(status_code=400, detail="Empty file uploaded.")

        ext = ""
        if filename:
            ext = "." + filename.rsplit(".", 1)[-1].lower()
        if ext not in {".png", ".jpg", ".jpeg", ".bmp", ".tiff", ".tif"}:
            raise HTTPException(
                status_code=400,
                detail="File type not allowed. Allowed: .png, .jpg, .jpeg, .bmp, .tiff, .tif",
            )

        # Load image and detect corners
        from PIL import Image
        image = Image.open(io.BytesIO(file_bytes))
        image.load()  # Force load to catch corrupt images
        width, height = image.size

        corners = await run_in_threadpool(detect_corners, image)

        corners_pct: List[Optional[Dict[str, float]]] = [
            None
            if c is None
            else {"x": c[0] / width * 100, "y": c[1] / height * 100}
            for c in corners
        ]

        return {
            "success": True,
            "data": {
                "corners": corners_pct,
                "count": sum(1 for c in corners_pct if c is not None),
                "image_width": width,
                "image_height": height,
            },
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Alignment failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/extract")
async def extract_notice_endpoint(
    request: Request,
    file: Optional[UploadFile] = File(None),
    plain_text: Optional[str] = Form(None),
    is_handwritten: bool = Form(False),
    corners: Optional[str] = Form(None),
    model: Optional[str] = Form(None),
) -> Dict[str, Any]:
    """Multi-modal document ingestion & structured extraction endpoint.

    Accepts Scanned PDFs, Digital PDFs, photos/scans, or plain text.
    Optional `corners` parameter: JSON string of 4 points [x, y] as percentages.
    Optional `model` parameter: catalogue key of the model to extract with.
    """
    client_key = _get_client_key(request)
    if not rate_limiter_extract.is_allowed(client_key):
        raise HTTPException(status_code=429, detail="Rate limit exceeded. Try again later.")
    try:
        # Resolve the model first so an unknown key fails fast with a 400.
        try:
            spec = llm.get_model(model)
        except llm.UnknownModelError as e:
            raise HTTPException(status_code=400, detail=str(e))

        file_bytes = await file.read() if file else None
        filename = file.filename if file else "uploaded_document"

        # Validate file upload
        if file and file_bytes:
            validate_file_upload(file, file_bytes)

        # Parse corners if provided
        pixel_corners = None
        if corners:
            try:
                corners_data = json.loads(corners)
                if not isinstance(corners_data, list) or len(corners_data) != 4:
                    raise ValueError("Corners must be a list of exactly 4 points")
                for pt in corners_data:
                    if not isinstance(pt, list) or len(pt) != 2:
                        raise ValueError("Each corner must be [x, y]")
                    x, y = pt
                    if not (0 <= x <= 100 and 0 <= y <= 100):
                        raise ValueError("Corner coordinates must be percentages 0-100")

                # We need image dimensions to convert percentages to pixels.
                # If file is provided, get dimensions from the image.
                if file_bytes:
                    from PIL import Image
                    image = Image.open(io.BytesIO(file_bytes))
                    image.load()
                    width, height = image.size
                    pixel_corners = [
                        (x / 100 * width, y / 100 * height)
                        for x, y in corners_data
                    ]
                else:
                    raise ValueError("Corners provided but no image file uploaded")
            except json.JSONDecodeError:
                raise HTTPException(status_code=400, detail="Invalid JSON in corners parameter")
            except ValueError as e:
                raise HTTPException(status_code=400, detail=str(e))

        # Step 1 & 2: Ingest, preprocess, and OCR
        # Run in a worker thread: the pipeline is blocking (OCR + LLM calls
        # take tens of seconds) and the Datalab SDK's sync wrapper cannot
        # start its own event loop on the running one.
        ingestion = await run_in_threadpool(
            process_document,
            file_bytes=file_bytes,
            filename=filename,
            plain_text=plain_text,
            is_handwritten=is_handwritten,
            corners=pixel_corners,
        )

        # Step 3: LLM Extraction
        ocr_unavailable = ingestion.raw_text.strip() == OCR_UNAVAILABLE_TEXT
        if ocr_unavailable:
            # OCR degraded to the placeholder — skip the LLM call so we don't
            # burn a request or invent fields from the placeholder text.
            logger.warning("OCR unavailable — returning an empty extraction")
            extracted = NoticeExtract(summary_bengali="", summary_english="")
        else:
            extracted = await run_in_threadpool(
                extract_notice, ingestion.raw_text, spec.key
            )
        result_dict = extracted.model_dump()

        # Add ingestion metadata
        result_dict["raw_text"] = ingestion.raw_text
        result_dict["source_type"] = ingestion.source_type
        result_dict["file_name"] = filename
        result_dict["ocr_unavailable"] = ocr_unavailable
        result_dict["model"] = {
            "key": spec.key,
            "label": spec.label,
            "provider": spec.provider,
            "provider_model_id": spec.model_id,
        }

        # Preview image (base64)
        if ingestion.preview_images:
            buf = io.BytesIO()
            ingestion.preview_images[0].save(buf, format="JPEG", quality=85)
            preview_b64 = base64.b64encode(buf.getvalue()).decode("utf-8")
            result_dict["preview_image_base64"] = f"data:image/jpeg;base64,{preview_b64}"
        else:
            result_dict["preview_image_base64"] = None

        # Check duplicates
        existing = list_notices(status="all")
        duplicates = detect_duplicates(ingestion.raw_text, existing)
        result_dict["potential_duplicates"] = [
            {"id": d.notice_id, "title": d.title, "similarity": d.similarity_score, "status": d.status}
            for d in duplicates[:3]
        ]

        return {"success": True, "data": result_dict}

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Extraction failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/qa")
def qa_endpoint(request: Request, req: QARequest) -> Dict[str, Any]:
    """Grounded question answering over published notices with citations."""
    client_key = _get_client_key(request)
    if not rate_limiter_qa.is_allowed(client_key):
        raise HTTPException(status_code=429, detail="Rate limit exceeded. Try again later.")
    try:
        try:
            spec = llm.get_model(req.model)
        except llm.UnknownModelError as e:
            raise HTTPException(status_code=400, detail=str(e))

        res = answer_question(
            req.query, department=req.department, batch=req.batch, model=spec.key
        )
        return {
            "success": True,
            "answer": res.answer,
            "citations": [c.model_dump() for c in res.citations],
            "found_answer": res.found_answer,
            "model": {
                "key": spec.key,
                "label": spec.label,
                "provider": spec.provider,
                "provider_model_id": spec.model_id,
            },
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"QA error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/tts")
def tts_endpoint(request: Request, req: TTSRequest) -> Response:
    """Generate audio stream for Bengali or English summary."""
    client_key = _get_client_key(request)
    if not rate_limiter_tts.is_allowed(client_key):
        raise HTTPException(status_code=429, detail="Rate limit exceeded. Try again later.")
    audio_bytes = generate_speech(req.text, lang=req.lang)
    if not audio_bytes:
        raise HTTPException(status_code=500, detail="Failed to synthesize speech")
    return Response(content=audio_bytes, media_type="audio/mpeg")


@app.post("/api/duplicates")
def duplicate_check_endpoint(req: DuplicateCheckRequest) -> Dict[str, Any]:
    """Check text against existing notice corpus for duplicates."""
    existing = list_notices(status="all")
    matches = detect_duplicates(req.text, existing, threshold=req.threshold)
    return {
        "matches": [
            {"notice_id": m.notice_id, "title": m.title, "similarity": m.similarity_score, "status": m.status}
            for m in matches
        ]
    }


@app.post("/api/diff")
def diff_endpoint(req: DiffRequest) -> Dict[str, Any]:
    """Compute structured and line diffs between notice versions."""
    try:
        old_n = NoticeRecord(**req.old_notice)
        new_n = NoticeRecord(**req.new_notice)
        diff_res = compute_notice_diff(old_n, new_n)
        return {"success": True, "diff": diff_res}
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Diff calculation failed: {e}")


@app.get("/api/benchmark")
def run_benchmark_endpoint() -> Dict[str, Any]:
    """Run full evaluation suite over 32 benchmark notices."""
    try:
        results = evaluate_benchmark()
        return {
            "success": True,
            "total_notices": results.total_notices,
            "mean_character_error_rate": results.mean_character_error_rate,
            "ocr_accuracy_percentage": results.ocr_accuracy_percentage,
            "field_accuracies": results.field_accuracies,
            "overall_extraction_accuracy": results.overall_extraction_accuracy,
            "detailed_reports": results.detailed_field_reports,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Benchmark failed: {e}")


@app.post("/api/calendar/ics")
def calendar_ics_endpoint(req: CalendarRequest) -> Response:
    """Export .ics calendar string for notices."""
    all_notices = list_notices(status="published", department=req.department)
    if req.notice_ids:
        all_notices = [n for n in all_notices if n.id in req.notice_ids]

    ics_content = generate_ics_calendar(all_notices)
    return Response(
        content=ics_content,
        media_type="text/calendar",
        headers={"Content-Disposition": "attachment; filename=pub_notices.ics"},
    )


# ---------------------------------------------------------------------------
# Notice Database CRUD & Moderation Endpoints
# ---------------------------------------------------------------------------

@app.get("/api/notices")
def get_notices_endpoint(
    status: Optional[str] = "published",
    category: Optional[str] = None,
    department: Optional[str] = None,
    batch: Optional[str] = None,
    search_query: Optional[str] = None,
    offset: int = 0,
    limit: Optional[int] = None,
) -> Dict[str, Any]:
    """Query notices with filtering, search, and pagination."""
    notices = list_notices(
        status=status,
        category=category,
        department=department,
        batch=batch,
        search_query=search_query,
        offset=offset,
        limit=limit,
    )
    return {"success": True, "count": len(notices), "notices": [n.model_dump() for n in notices]}


@app.get("/api/notices/{notice_id}")
def get_single_notice(notice_id: int) -> Dict[str, Any]:
    """Get single notice by ID."""
    notice = get_notice_by_id(notice_id)
    if not notice:
        raise HTTPException(status_code=404, detail="Notice not found")
    return {"success": True, "notice": notice.model_dump()}


@app.post("/api/notices")
def create_notice(data: Dict[str, Any]) -> Dict[str, Any]:
    """Save a notice (draft or published)."""
    try:
        notice = NoticeRecord(**data)
        new_id = save_notice(notice)
        return {"success": True, "id": new_id, "status": notice.status}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.put("/api/notices/{notice_id}/publish")
def publish_notice_endpoint(notice_id: int, published_by: Optional[str] = None) -> Dict[str, Any]:
    """Approve and publish a draft notice."""
    notice = get_notice_by_id(notice_id)
    if not notice:
        raise HTTPException(status_code=404, detail="Notice not found")
    publish_notice(notice_id, published_by=published_by or "Staff Reviewer")
    return {"success": True, "id": notice_id, "status": "published"}


@app.put("/api/notices/{notice_id}")
def update_notice_endpoint(notice_id: int, data: Dict[str, Any]) -> Dict[str, Any]:
    """Update an existing notice with a partial patch.

    Only the content fields can be patched — status and the publishing
    metadata stay under the control of `PUT /api/notices/{id}/publish`.
    """
    existing = get_notice_by_id(notice_id)
    if not existing:
        raise HTTPException(status_code=404, detail="Notice not found")

    patchable = {
        "title",
        "issuing_office",
        "date_of_issue",
        "deadlines",
        "event_date_time",
        "venue",
        "target_students",
        "required_action",
        "fees",
        "contact",
        "category",
        "summary_bengali",
        "summary_english",
        "raw_text",
        "review_notes",
    }

    try:
        merged = existing.model_dump()
        for key, value in data.items():
            if key in patchable:
                merged[key] = value
        notice = NoticeRecord(**merged)
        notice.id = notice_id
        update_notice(notice)
        return {"success": True, "id": notice_id, "status": notice.status}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.delete("/api/notices/{notice_id}")
def delete_notice_endpoint(notice_id: int) -> Dict[str, Any]:
    """Delete a notice by ID."""
    delete_notice(notice_id)
    return {"success": True, "deleted_id": notice_id}


@app.get("/api/departments")
def get_departments() -> Dict[str, Any]:
    """Get list of departments."""
    return {"success": True, "departments": get_all_departments()}


@app.get("/api/categories")
def get_categories() -> Dict[str, Any]:
    """Get list of notice categories."""
    return {"success": True, "categories": get_all_categories()}


@app.post("/api/seed-benchmark")
def seed_benchmark_endpoint() -> Dict[str, Any]:
    """Seed database with the 32 benchmark notices."""
    count = seed_database_with_benchmark()
    return {"success": True, "count": count}

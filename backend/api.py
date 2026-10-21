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

from fastapi import FastAPI, File, Form, HTTPException, Response, UploadFile, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import APIKeyHeader
from pydantic import BaseModel, Field
import os

import pipeline  # Loads .env
from evaluation.evaluate import evaluate_benchmark, seed_database_with_benchmark
from pipeline.calendar import generate_ics_calendar
from pipeline.diff_and_duplicates import compute_notice_diff, detect_duplicates
from pipeline.extract import extract_notice
from pipeline.ingestion import process_document
from pipeline.logging_config import configure_logging
from pipeline.models import Deadline, EventDateTime, Fees, NoticeRecord, TargetStudents
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
    allow_headers=["Authorization", "Content-Type"],
)


# ---------------------------------------------------------------------------
# API Key Authentication
# ---------------------------------------------------------------------------

API_KEY_HEADER = APIKeyHeader(name="X-API-Key", auto_error=False)
API_KEY = os.environ.get("API_KEY", "")


async def verify_api_key(request: Request) -> None:
    """FastAPI middleware that checks the X-API-Key header on protected routes."""
    # Skip auth for public endpoints
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
    public_prefixes = {"/api/notices/"}
    path = request.url.path
    if path in public_paths:
        return
    for prefix in public_prefixes:
        if path.startswith(prefix) and request.method == "GET":
            return

    # Require API key for all other routes
    if not API_KEY:
        # If no API key is configured, allow all requests (development mode)
        return

    api_key: str = await API_KEY_HEADER(request)
    if not api_key or api_key != API_KEY:
        raise HTTPException(status_code=401, detail="Invalid or missing API key")


app.middleware("http")(verify_api_key)


# ---------------------------------------------------------------------------
# Request / Response Schemas
# ---------------------------------------------------------------------------

class QARequest(BaseModel):
    query: str
    department: Optional[str] = None
    batch: Optional[str] = None


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
    return {
        "status": "healthy",
        "service": "PUB NoticeLens API",
        "model": os.environ.get("GEMINI_MODEL", "gemini-2.5-flash"),
    }


@app.post("/api/extract")
async def extract_notice_endpoint(
    request: Request,
    file: Optional[UploadFile] = File(None),
    plain_text: Optional[str] = Form(None),
    is_handwritten: bool = Form(False),
) -> Dict[str, Any]:
    """Multi-modal document ingestion & structured extraction endpoint.

    Accepts Scanned PDFs, Digital PDFs, photos/scans, or plain text.
    """
    client_key = _get_client_key(request)
    if not rate_limiter_extract.is_allowed(client_key):
        raise HTTPException(status_code=429, detail="Rate limit exceeded. Try again later.")
    try:
        file_bytes = await file.read() if file else None
        filename = file.filename if file else "uploaded_document"

        # Validate file upload
        if file and file_bytes:
            validate_file_upload(file, file_bytes)

        # Step 1 & 2: Ingest, preprocess, and OCR
        ingestion = process_document(
            file_bytes=file_bytes,
            filename=filename,
            plain_text=plain_text,
            is_handwritten=is_handwritten,
        )

        # Step 3: LLM Extraction
        extracted = extract_notice(ingestion.raw_text)
        result_dict = extracted.model_dump()

        # Add ingestion metadata
        result_dict["raw_text"] = ingestion.raw_text
        result_dict["source_type"] = ingestion.source_type
        result_dict["file_name"] = filename

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
        res = answer_question(req.query, department=req.department, batch=req.batch)
        return {
            "success": True,
            "answer": res.answer,
            "citations": [c.model_dump() for c in res.citations],
            "found_answer": res.found_answer,
        }
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
    publish_notice(notice_id, published_by=published_by)
    return {"success": True, "id": notice_id, "status": "published"}


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

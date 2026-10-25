import base64
import io
import json
import logging
from typing import Any, Dict, List, Optional, Tuple

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.concurrency import run_in_threadpool
from PIL import Image, ImageOps

from api import dependencies
from core.align import detect_corners, warp_with_corners
from core.exceptions import ExtractionFailure, OCRFailure, UnsupportedFileType
from core.pipeline import process_file, process_text
from core.render import render_pdf_pages_with_total
from core.schema import ExtractionSchema

logger = logging.getLogger(__name__)

app = FastAPI(
    title="Pundra Notice Extractor",
    description="Extract structured data from notice images, PDFs, or raw text.",
    version="1.0.0",
)


# ---------------------------------------------------------------------------
# Warp helpers
# ---------------------------------------------------------------------------

MAX_UPLOAD_SIZE = 10 * 1024 * 1024  # 10 MB
ALLOWED_IMAGE_EXTENSIONS = {"png", "jpg", "jpeg", "bmp", "tiff", "tif"}


def _parse_corner_points(corners_data: Any) -> List[Tuple[float, float]]:
    """Validate one set of four corners given as percentages."""
    if not isinstance(corners_data, list) or len(corners_data) != 4:
        raise ValueError("Corners must be a list of exactly 4 points")
    points: List[Tuple[float, float]] = []
    for pt in corners_data:
        if not isinstance(pt, list) or len(pt) != 2:
            raise ValueError("Each corner must be [x, y]")
        x, y = pt
        if not (0 <= x <= 100 and 0 <= y <= 100):
            raise ValueError("Corner coordinates must be percentages 0-100")
        points.append((float(x), float(y)))
    return points


def _to_pixel_corners(
    points: List[Tuple[float, float]], image_bytes: bytes
) -> List[Tuple[float, float]]:
    """Convert percentage corners into the pixel space of one image."""
    image = Image.open(io.BytesIO(image_bytes))
    image.load()
    width, height = image.size
    return [(x / 100 * width, y / 100 * height) for x, y in points]


@app.get("/health")
async def health() -> dict:
    return {"status": "ok"}


@app.post("/api/align")
async def align_endpoint(file: UploadFile = File(...)) -> Dict[str, Any]:
    """Detect document corners in an uploaded image.

    Accepts image files only (no PDFs). Returns corner coordinates as
    percentages of image dimensions for frontend cropping UI.
    """
    try:
        file_bytes = await file.read()
        filename = file.filename or "uploaded_image"

        # Validate upload — images only
        if len(file_bytes) > MAX_UPLOAD_SIZE:
            raise HTTPException(
                status_code=413,
                detail=f"File too large. Maximum size is {MAX_UPLOAD_SIZE // (1024 * 1024)} MB.",
            )
        if len(file_bytes) == 0:
            raise HTTPException(status_code=400, detail="Empty file uploaded.")

        ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
        if ext not in ALLOWED_IMAGE_EXTENSIONS:
            raise HTTPException(
                status_code=400,
                detail="File type not allowed. Allowed: .png, .jpg, .jpeg, .bmp, .tiff, .tif",
            )

        # Load image and detect corners
        image = Image.open(io.BytesIO(file_bytes))
        image.load()  # Force load to catch corrupt images
        width, height = image.size

        corners = await run_in_threadpool(detect_corners, image)

        # Convert pixel coordinates to percentages, clamped to 0-100
        corners_pct: List[Optional[Dict[str, float]]] = [
            None
            if c is None
            else {
                "x": min(max(c[0] / width * 100, 0.0), 100.0),
                "y": min(max(c[1] / height * 100, 0.0), 100.0),
            }
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


@app.post("/extract", response_model=ExtractionSchema)
async def extract(
    file: UploadFile | None = File(None, description="Notice image (.jpg/.jpeg/.png) or PDF"),
    text: str | None = Form(None, description="Raw notice text (skips OCR)"),
) -> ExtractionSchema:
    """Extract structured notice data.

    Provide exactly one input:
    - `file`: an image or PDF, which goes through OCR first.
    - `text`: raw text, which skips OCR and is extracted directly.
    """
    if file is not None and text is not None:
        raise HTTPException(
            status_code=400,
            detail="Provide either 'file' or 'text', not both.",
        )
    if file is None and text is None:
        raise HTTPException(
            status_code=400,
            detail="Provide one of 'file' or 'text'.",
        )

    extractor = dependencies.get_extractor()

    try:
        if file is not None:
            data = await file.read()
            if not data:
                raise HTTPException(status_code=400, detail="Uploaded file is empty.")
            result = await run_in_threadpool(
                process_file, data, file.filename or "upload", extractor
            )
        else:
            result = await run_in_threadpool(process_text, text, extractor)

    except UnsupportedFileType as e:
        raise HTTPException(status_code=415, detail=str(e))
    except OCRFailure as e:
        raise HTTPException(status_code=502, detail=str(e))
    except ExtractionFailure as e:
        raise HTTPException(status_code=422, detail=str(e))

    return result


@app.post("/api/warp")
async def warp_image_endpoint(
    file: UploadFile = File(...),
    corners: str = Form(...),
) -> Dict[str, Any]:
    """Warp an image into the rectangle its four corners describe.

    Accepts an image file and four corner points as percentages (0-100).
    Returns the warped image as a JPEG data URL.
    """
    try:
        file_bytes = await file.read()
        filename = file.filename or "uploaded_image"

        # Images only — a PDF cannot be warped.
        ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
        if ext not in ALLOWED_IMAGE_EXTENSIONS:
            raise HTTPException(
                status_code=400,
                detail="File type not allowed. Allowed: .png, .jpg, .jpeg, .bmp, .tiff, .tif",
            )
        if len(file_bytes) == 0:
            raise HTTPException(status_code=400, detail="Empty file uploaded.")
        if len(file_bytes) > MAX_UPLOAD_SIZE:
            raise HTTPException(
                status_code=413,
                detail=f"File too large. Maximum size is {MAX_UPLOAD_SIZE // (1024 * 1024)} MB.",
            )

        # Parse corner points from JSON string
        try:
            corners_data = json.loads(corners)
            points = _parse_corner_points(corners_data)
        except json.JSONDecodeError:
            raise HTTPException(status_code=400, detail="Invalid JSON in corners parameter")
        except ValueError as e:
            raise HTTPException(status_code=400, detail=str(e))

        pixel_corners = _to_pixel_corners(points, file_bytes)

        image = Image.open(io.BytesIO(file_bytes))
        image.load()
        image = ImageOps.exif_transpose(image).convert("RGB")

        warped = await run_in_threadpool(warp_with_corners, image, pixel_corners)

        buf = io.BytesIO()
        warped.save(buf, format="JPEG", quality=92)

        return {
            "success": True,
            "data": {
                "image": f"data:image/jpeg;base64,{base64.b64encode(buf.getvalue()).decode('utf-8')}",
                "width": warped.width,
                "height": warped.height,
            },
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/render")
async def render_endpoint(
    file: UploadFile = File(...),
    dpi: int = Form(200),
    max_pages: int = Form(30),
) -> Dict[str, Any]:
    """Render the pages of a PDF as PNG images.

    Accepts a PDF file and returns each page as a base64-encoded PNG image.
    """
    try:
        file_bytes = await file.read()

        if len(file_bytes) == 0:
            raise HTTPException(status_code=400, detail="Empty file uploaded.")
        if len(file_bytes) > MAX_UPLOAD_SIZE:
            raise HTTPException(
                status_code=413,
                detail=f"File too large. Maximum size is {MAX_UPLOAD_SIZE // (1024 * 1024)} MB.",
            )
        if file_bytes[:4] != b"%PDF":
            raise HTTPException(
                status_code=400,
                detail="Only PDF files can be rendered into pages.",
            )

        dpi = max(72, min(dpi, 300))
        max_pages = max(1, min(max_pages, 100))

        pages, total_pages = await run_in_threadpool(
            render_pdf_pages_with_total, file_bytes, dpi, max_pages
        )

        return {
            "success": True,
            "data": {
                "dpi": dpi,
                "page_count": len(pages),
                "total_pages": total_pages,
                "pages": [
                    {
                        "page": number,
                        "width": width,
                        "height": height,
                        "image": base64.b64encode(png).decode("ascii"),
                    }
                    for number, width, height, png in pages
                ],
            },
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

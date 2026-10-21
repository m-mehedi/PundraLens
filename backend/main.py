"""PundraNoticeLens — Multi-Modal Notice Ingestion and Intelligence System.

Entry points:
- ``process_photo(image_bytes)``: Backwards-compatible single-photo processing.
- ``process_notice(...)``: Full multi-modal processing for PDF, photos, and plain text.
- ``ask_notices(query)``: Grounded QA with source notice and passage citations.
"""

from __future__ import annotations

import io
import logging
from typing import Any, Optional

from PIL import Image

import pipeline  # Loads .env
from pipeline.align import align_image
from pipeline.extract import extract_notice
from pipeline.ingestion import process_document
from pipeline.ocr import run_ocr_on_image
from pipeline.qa import answer_question, QAResponse

logger = logging.getLogger(__name__)


def process_photo(image_bytes: bytes) -> dict[str, Any]:
    """Process a photo of a notice and return structured JSON (backwards-compatible).

    Pipeline stages:
    1. **Align** — deskew and crop the document from the photo.
    2. **OCR** — extract Bengali/English text.
    3. **Extract** — send OCR text to LLM for structured field extraction.

    Args:
        image_bytes: Raw image data (PNG, JPG, etc.).

    Returns:
        A dictionary matching the ``NoticeExtract`` schema with all extracted fields.
    """
    image = Image.open(io.BytesIO(image_bytes)).convert("RGB")
    logger.info(f"Loaded image: {image.size[0]}x{image.size[1]}")

    aligned = align_image(image)
    logger.info(f"Aligned image: {aligned.size[0]}x{aligned.size[1]}")

    ocr_text = run_ocr_on_image(aligned)
    logger.info(f"OCR returned {len(ocr_text)} characters")

    notice = extract_notice(ocr_text)
    logger.info("Extraction complete")

    return notice.model_dump()


def process_notice(
    file_bytes: Optional[bytes] = None,
    filename: Optional[str] = None,
    plain_text: Optional[str] = None,
    is_handwritten: bool = False,
) -> dict[str, Any]:
    """Process any notice format (Scanned PDF, Digital PDF, Image, Plain text).

    Returns:
        Dictionary containing extracted fields, raw OCR/digital text, and source type.
    """
    ingestion_res = process_document(
        file_bytes=file_bytes,
        filename=filename,
        plain_text=plain_text,
        is_handwritten=is_handwritten,
    )

    notice = extract_notice(ingestion_res.raw_text)
    data = notice.model_dump()
    data["raw_text"] = ingestion_res.raw_text
    data["source_type"] = ingestion_res.source_type
    data["file_name"] = filename

    return data


def ask_notices(query: str) -> dict[str, Any]:
    """Ask a question grounded strictly on published university notices."""
    res = answer_question(query)
    return res.model_dump()


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    print("PUB NoticeLens system ready.")
    print("Usage: from main import process_photo, process_notice, ask_notices")

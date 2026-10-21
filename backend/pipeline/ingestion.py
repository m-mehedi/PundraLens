"""Document Ingestion module.

Supports:
1. Scanned PDFs (page-by-page rendering -> alignment -> denoising -> OCR)
2. Digital PDFs (native text extraction with automatic scanned fallback)
3. Photos of printed & handwritten notices (alignment -> preprocessing -> OCR)
4. Plain text input
"""

from __future__ import annotations

import io
import logging
from dataclasses import dataclass
from typing import List, Optional, Tuple

import pymupdf
from PIL import Image

from pipeline.align import align_image
from pipeline.ocr import run_ocr_on_image
from pipeline.preprocess import binarize_for_ocr, enhance_and_denoise_image

logger = logging.getLogger(__name__)


@dataclass
class IngestionResult:
    """Output of the ingestion stage."""
    raw_text: str
    source_type: str  # "photo", "scanned_pdf", "digital_pdf", "plain_text"
    preview_images: List[Image.Image]
    page_count: int = 1


def process_document(
    file_bytes: Optional[bytes] = None,
    filename: Optional[str] = None,
    plain_text: Optional[str] = None,
    is_handwritten: bool = False,
) -> IngestionResult:
    """Ingest a notice from file bytes (PDF, Image) or plain text.

    Args:
        file_bytes: Raw bytes of uploaded file.
        filename: Original filename (used to infer type).
        plain_text: Raw plain text if user pasted text.
        is_handwritten: Hint if notice is handwritten (prioritizes Gemini Vision OCR).

    Returns:
        IngestionResult with extracted raw text, source type, and preview images.
    """
    # Case 1: Plain text input
    if plain_text and plain_text.strip():
        logger.info("Processing plain text notice input")
        return IngestionResult(
            raw_text=plain_text.strip(),
            source_type="plain_text",
            preview_images=[],
            page_count=1,
        )

    if not file_bytes:
        raise ValueError("Either file_bytes or plain_text must be provided")

    filename_lower = (filename or "").lower()

    # Case 2: PDF Document
    if filename_lower.endswith(".pdf") or file_bytes[:4] == b"%PDF":
        logger.info("Processing PDF document")
        return _process_pdf(file_bytes, is_handwritten=is_handwritten)

    # Case 3: Image (Photo of printed/handwritten notice, scan)
    logger.info("Processing image document")
    return _process_image(file_bytes, is_handwritten=is_handwritten)


def _process_image(image_bytes: bytes, is_handwritten: bool = False) -> IngestionResult:
    """Process an image file through alignment, preprocessing, and OCR."""
    image = Image.open(io.BytesIO(image_bytes)).convert("RGB")
    logger.info(f"Loaded image size: {image.size}")

    # Stage 1: Document alignment (deskew / crop)
    aligned = align_image(image)

    # Stage 2: Noise removal and contrast enhancement
    preprocessed = enhance_and_denoise_image(aligned)

    # Stage 2.5: Binarization for better OCR
    ocr_image = binarize_for_ocr(preprocessed)

    # Stage 3: OCR
    text = run_ocr_on_image(ocr_image, force_gemini=is_handwritten)

    return IngestionResult(
        raw_text=text,
        source_type="photo",
        preview_images=[preprocessed],
        page_count=1,
    )


def _process_pdf(pdf_bytes: bytes, is_handwritten: bool = False) -> IngestionResult:
    """Process a PDF file — handles both digital PDFs and scanned PDFs."""
    doc = pymupdf.open(stream=pdf_bytes, filetype="pdf")
    num_pages = len(doc)
    logger.info(f"Opened PDF with {num_pages} page(s)")

    extracted_pages_text: List[str] = []
    preview_images: List[Image.Image] = []

    # First attempt: Try extracting digital text directly
    total_digital_chars = 0
    digital_texts: List[str] = []

    for page_num in range(num_pages):
        page = doc[page_num]
        p_text = page.get_text().strip()
        digital_texts.append(p_text)
        total_digital_chars += len(p_text)

    # Render first page as preview image regardless
    first_page = doc[0]
    pix = first_page.get_pixmap(dpi=150)
    first_preview = Image.frombytes("RGB", [pix.width, pix.height], pix.samples)
    preview_images.append(first_preview)

    # If the document has meaningful digital text (> 60 characters per page average)
    if total_digital_chars > 60:
        logger.info(f"Digital PDF detected ({total_digital_chars} chars extracted directly)")
        combined_text = "\n\n--- Page Break ---\n\n".join(
            t for t in digital_texts if t
        )
        doc.close()
        return IngestionResult(
            raw_text=combined_text,
            source_type="digital_pdf",
            preview_images=preview_images,
            page_count=num_pages,
        )

    # Otherwise, it is a Scanned PDF (image-based)
    logger.info("Scanned PDF detected (insufficient digital text). Running OCR on rendered pages.")
    all_ocr_texts: List[str] = []
    preview_images.clear()

    # Process up to 5 pages for scanned notices (notices are usually 1-3 pages)
    max_pages = min(num_pages, 5)
    for i in range(max_pages):
        page = doc[i]
        # Render high quality for OCR (200 DPI)
        pix = page.get_pixmap(dpi=200)
        page_img = Image.frombytes("RGB", [pix.width, pix.height], pix.samples)

        # Preprocess and OCR
        aligned_page = align_image(page_img)
        enhanced = enhance_and_denoise_image(aligned_page)
        ocr_page = binarize_for_ocr(enhanced)
        page_text = run_ocr_on_image(ocr_page, force_gemini=is_handwritten)

        if page_text:
            all_ocr_texts.append(f"--- Page {i + 1} ---\n{page_text}")
        preview_images.append(enhanced)

    doc.close()
    combined_ocr = "\n\n".join(all_ocr_texts)

    return IngestionResult(
        raw_text=combined_ocr,
        source_type="scanned_pdf",
        preview_images=preview_images,
        page_count=num_pages,
    )

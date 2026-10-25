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
from PIL import ImageOps

from pipeline.align import Point
from pipeline.align import align_image
from pipeline.align import warp_with_corners
from pipeline.ocr import OCR_UNAVAILABLE_TEXT
from pipeline.ocr import run_ocr_on_image
from pipeline.preprocess import binarize_for_ocr, enhance_and_denoise_image

logger = logging.getLogger(__name__)


@dataclass
class IngestionResult:
    """Output of the ingestion stage."""
    raw_text: str
    source_type: str  # "photo", "scanned_pdf", "digital_pdf", "plain_text", "images"
    preview_images: List[Image.Image]
    page_count: int = 1
    # How many pages were actually read; fewer than ``page_count`` when the
    # document was longer than the ceiling.
    pages_read: int = 1


# How many pages of a scanned document are read. The editor sends every
# page of the document as one PDF, and a notice can be several sheets long.
MAX_OCR_PAGES = 30


def render_pdf_pages(
    pdf_bytes: bytes, dpi: int = 200, max_pages: Optional[int] = None
) -> List[Tuple[int, int, int, bytes]]:
    """Render pages of a PDF to PNGs.

    Returns one ``(page number, width, height, png bytes)`` tuple per page.
    The same 200 DPI the OCR pipeline uses is the default, so a page that
    the editor shows is the page the reader actually sees.
    """
    pages, _ = render_pdf_pages_with_total(pdf_bytes, dpi, max_pages)
    return pages


def render_pdf_pages_with_total(
    pdf_bytes: bytes, dpi: int = 200, max_pages: Optional[int] = None
) -> Tuple[List[Tuple[int, int, int, bytes]], int]:
    """Render pages of a PDF, and say how many the document has in all.

    Returns the rendered pages and the total page count, so the caller can
    tell the reader that a long document was cut short.

    ``max_pages`` caps how many pages are rendered — a long document would
    otherwise turn into hundreds of megabytes of images.
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


def process_pages(
    pages: List[Tuple[bytes, Optional[List[Point]]]],
    is_handwritten: bool = False,
) -> IngestionResult:
    """Read several images as the pages of one notice.

    Each page is straightened with its own corners and read on its own; the
    texts are then joined so the model sees one continuous notice.

    Args:
        pages: ``(image bytes, corners)`` per page. Corners are pixel
            coordinates of the page rectangle, or None to leave the page
            as it is.
        is_handwritten: Prioritise the vision model over the OCR service.
    """
    texts: List[str] = []
    previews: List[Image.Image] = []

    for index, (page_bytes, corners) in enumerate(pages):
        image = Image.open(io.BytesIO(page_bytes)).convert("RGB")
        image = ImageOps.exif_transpose(image)

        if corners is not None:
            aligned = warp_with_corners(image, corners)
        else:
            aligned = image

        enhanced = enhance_and_denoise_image(aligned)
        ocr_image = binarize_for_ocr(enhanced)
        page_text = run_ocr_on_image(ocr_image, force_gemini=is_handwritten)

        # A page that could not be read contributes nothing rather than the
        # "unavailable" placeholder, which would reach the model as if it
        # were the notice.
        if page_text and page_text.strip() != OCR_UNAVAILABLE_TEXT:
            texts.append(f"--- Page {index + 1} ---\n{page_text}")
        previews.append(enhanced)

    return IngestionResult(
        raw_text="\n\n".join(texts),
        source_type="images",
        preview_images=previews,
        page_count=len(pages),
    )


def process_document(
    file_bytes: Optional[bytes] = None,
    filename: Optional[str] = None,
    plain_text: Optional[str] = None,
    is_handwritten: bool = False,
    corners: Optional[List[Point]] = None,
) -> IngestionResult:
    """Ingest a notice from file bytes (PDF, Image) or plain text.

    Args:
        file_bytes: Raw bytes of uploaded file.
        filename: Original filename (used to infer type).
        plain_text: Raw plain text if user pasted text.
        is_handwritten: Hint if notice is handwritten (prioritizes Gemini Vision OCR).
        corners: Optional list of 4 corner points (TL, TR, BR, BL) for manual perspective correction.
                 Only supported for image inputs, not PDFs.

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
        return _process_pdf(file_bytes, is_handwritten=is_handwritten, corners=corners)

    # Case 3: Image (Photo of printed/handwritten notice, scan)
    logger.info("Processing image document")
    return _process_image(file_bytes, is_handwritten=is_handwritten, corners=corners)


def _process_image(
    image_bytes: bytes,
    is_handwritten: bool = False,
    corners: Optional[List[Point]] = None,
) -> IngestionResult:
    """Process an image file through alignment, preprocessing, and OCR."""
    image = Image.open(io.BytesIO(image_bytes)).convert("RGB")
    logger.info(f"Loaded image size: {image.size}")

    # Apply EXIF transpose to correct orientation
    image = ImageOps.exif_transpose(image)

    # Stage 1: Document alignment (deskew / crop)
    if corners is not None:
        if len(corners) != 4:
            raise ValueError(f"Expected exactly 4 corners, got {len(corners)}")
        aligned = warp_with_corners(image, corners)
    else:
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


def _process_pdf(
    pdf_bytes: bytes,
    is_handwritten: bool = False,
    corners: Optional[List[Point]] = None,
) -> IngestionResult:
    """Process a PDF file — handles both digital PDFs and scanned PDFs."""
    if corners is not None:
        raise ValueError("Corners parameter not supported for PDF documents")

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

    # A notice can be several sheets long — the editor sends every page of
    # the document as one PDF — so all of them are read. Thirty is the same
    # ceiling the page renderer uses; past that the document is too long to
    # be one notice.
    max_pages = min(num_pages, MAX_OCR_PAGES)
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
        pages_read=max_pages,
    )
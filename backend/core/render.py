"""Render PDF pages to PNG images using PyMuPDF."""

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

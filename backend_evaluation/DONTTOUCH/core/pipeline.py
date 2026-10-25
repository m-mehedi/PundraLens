from service.core.extract import Extractor, extract_from_markdown
from service.core.ocr import ocr_to_markdown
from service.core.schema import ExtractionSchema


def process_file(data: bytes, filename: str, extractor: Extractor | None = None) -> ExtractionSchema:
    """Image/PDF bytes -> markdown (OCR) -> structured schema."""
    markdown = ocr_to_markdown(data, filename)
    return extract_from_markdown(markdown, extractor=extractor)


def process_text(text: str, extractor: Extractor | None = None) -> ExtractionSchema:
    """Raw text -> structured schema (no OCR)."""
    return extract_from_markdown(text, extractor=extractor)
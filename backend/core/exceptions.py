class CoreError(Exception):
    """Base class for all domain errors raised by the core layer."""


class UnsupportedFileType(CoreError):
    """The uploaded file type is not supported (only images and PDFs)."""


class OCRFailure(CoreError):
    """OCR conversion of an image/PDF failed."""


class ExtractionFailure(CoreError):
    """Structured extraction from text failed."""
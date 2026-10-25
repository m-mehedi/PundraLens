import os
import tempfile
from pathlib import Path

from datalab_sdk import DatalabClient

from core.exceptions import OCRFailure, UnsupportedFileType

SUPPORTED_IMAGE_EXTS = {".jpg", ".jpeg", ".png"}
SUPPORTED_PDF_EXTS = {".pdf"}
SUPPORTED_EXTS = SUPPORTED_IMAGE_EXTS | SUPPORTED_PDF_EXTS


def _datalab_client() -> DatalabClient:
    api_key = os.getenv("DATALAB_API_KEY")
    if not api_key:
        raise OCRFailure("DATALAB_API_KEY is not set")
    return DatalabClient(api_key=api_key)


def _ext_from_filename(filename: str) -> str:
    ext = Path(filename).suffix.lower()
    if ext not in SUPPORTED_EXTS:
        raise UnsupportedFileType(
            f"Unsupported file type '{ext or filename}'. "
            f"Supported: {', '.join(sorted(SUPPORTED_EXTS))}"
        )
    return ext


def ocr_to_markdown(data: bytes, filename: str) -> str:
    """Convert an image or PDF (as bytes) into markdown using Datalab.

    Datalab's SDK expects a file path, so the bytes are written to a temporary
    file (preserving the original extension for type detection) and cleaned up.
    """
    ext = _ext_from_filename(filename)
    client = _datalab_client()

    tmp_path = None
    try:
        with tempfile.NamedTemporaryFile(suffix=ext, delete=False) as tmp:
            tmp.write(data)
            tmp_path = tmp.name

        result = client.convert(tmp_path)
        return result.markdown
    except (UnsupportedFileType,):
        raise
    except Exception as e:
        raise OCRFailure(f"OCR failed for '{filename}': {e}") from e
    finally:
        if tmp_path and os.path.exists(tmp_path):
            os.unlink(tmp_path)

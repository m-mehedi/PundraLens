"""Datalab Cloud OCR wrapper — send an image to Datalab's API for OCR."""

from __future__ import annotations

import logging
import os
import tempfile
from pathlib import Path
from typing import TYPE_CHECKING

from PIL import Image

if TYPE_CHECKING:
    from datalab_sdk import DatalabClient

logger = logging.getLogger(__name__)

# Module-level client cache
_client: "DatalabClient | None" = None


def _get_client() -> "DatalabClient":
    """Get or create the Datalab API client (cached)."""
    global _client
    if _client is None:
        from datalab_sdk import DatalabClient

        api_key = os.environ.get("DATALAB_API_KEY")
        if not api_key:
            raise EnvironmentError(
                "DATALAB_API_KEY environment variable is not set. "
                "Get one at https://datalab.to"
            )
        _client = DatalabClient(api_key=api_key)
        logger.info("Datalab API client initialized")
    return _client


def run_ocr_on_image(image: Image.Image) -> str:
    """Run OCR on *image* using Datalab's cloud API and return the extracted text.

    Returns the markdown output from the API, which contains the recognized text
    in both Bengali and English.
    """
    client = _get_client()

    # Save image to a temporary file for the API
    with tempfile.NamedTemporaryFile(suffix=".png", delete=False) as tmp:
        tmp_path = Path(tmp.name)
        image.save(tmp_path, format="PNG")

    try:
        result = client.convert(str(tmp_path))
        if not result.success:
            error_msg = result.error or "Unknown error from Datalab API"
            logger.error(f"Datalab OCR failed: {error_msg}")
            raise RuntimeError(error_msg)

        # Return markdown text
        text = result.markdown or ""
        if not text:
            logger.warning("Datalab OCR returned empty text")
        return text

    finally:
        tmp_path.unlink(missing_ok=True)

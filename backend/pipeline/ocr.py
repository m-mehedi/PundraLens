"""OCR wrapper — supports Datalab Cloud OCR with Gemini Multimodal Vision fallback.

Extracts text from Bengali, English, and mixed-language notices,
including printed and handwritten text.
"""

from __future__ import annotations

import io
import logging
import os
import tempfile
from pathlib import Path
from typing import TYPE_CHECKING, Optional

from PIL import Image

if TYPE_CHECKING:
    from datalab_sdk import DatalabClient
    from langchain_google_genai import ChatGoogleGenerativeAI

logger = logging.getLogger(__name__)

_datalab_client: Optional[DatalabClient] = None
_gemini_client: Optional[ChatGoogleGenerativeAI] = None


def _get_datalab_client() -> Optional[DatalabClient]:
    """Get Datalab API client if configured."""
    global _datalab_client
    if _datalab_client is None:
        api_key = os.environ.get("DATALAB_API_KEY")
        if api_key:
            try:
                from datalab_sdk import DatalabClient
                _datalab_client = DatalabClient(api_key=api_key)
                logger.info("Datalab API client initialized")
            except Exception as e:
                logger.warning(f"Failed to initialize Datalab client: {e}")
    return _datalab_client


def _run_gemini_vision_ocr(image: Image.Image) -> str:
    """Run OCR directly via Gemini 2.0 Flash Vision (handles printed & handwritten Bengali/English)."""
    import base64
    from langchain_core.messages import HumanMessage
    from langchain_google_genai import ChatGoogleGenerativeAI

    api_key = os.environ.get("GOOGLE_API_KEY")
    if not api_key:
        raise EnvironmentError("GOOGLE_API_KEY environment variable is not set.")

    # Convert PIL Image to JPEG base64
    buffer = io.BytesIO()
    image.convert("RGB").save(buffer, format="JPEG", quality=90)
    image_b64 = base64.b64encode(buffer.getvalue()).decode("utf-8")

    llm = ChatGoogleGenerativeAI(
        model=os.environ.get("GEMINI_MODEL", "gemini-2.5-flash"),
        api_key=api_key,
        temperature=0.0,
    )

    prompt = (
        "Transcribe all text from this university notice document exactly as it appears. "
        "The document may contain Bengali (Bangla), English, or mixed text, and may be printed or handwritten. "
        "Preserve headings, dates, numbers, tables, lists, and signatures. "
        "Output ONLY the transcribed text in markdown format. Do not include commentary."
    )

    message = HumanMessage(
        content=[
            {"type": "text", "text": prompt},
            {
                "type": "image_url",
                "image_url": {"url": f"data:image/jpeg;base64,{image_b64}"},
            },
        ]
    )

    logger.info("Running OCR using Gemini 3.8 Flash Vision...")
    response = llm.invoke([message])
    return response.content.strip()


def run_ocr_on_image(image: Image.Image, force_gemini: bool = False) -> str:
    """Run OCR on *image* using Datalab API with automatic fallback to Gemini Vision.

    Args:
        image: PIL Image object.
        force_gemini: If True, bypasses Datalab and uses Gemini Vision directly.

    Returns:
        Transcribed text from the notice.
    """
    if not force_gemini:
        datalab = _get_datalab_client()
        if datalab:
            with tempfile.NamedTemporaryFile(suffix=".png", delete=False) as tmp:
                tmp_path = Path(tmp.name)
                image.save(tmp_path, format="PNG")

            try:
                result = datalab.convert(str(tmp_path))
                if result.success and result.markdown:
                    logger.info("Successfully extracted text via Datalab OCR")
                    return result.markdown.strip()
                else:
                    logger.warning(f"Datalab OCR returned empty or unsuccessful: {getattr(result, 'error', None)}")
            except Exception as e:
                logger.warning(f"Datalab OCR error: {e}. Falling back to Gemini Vision OCR.")
            finally:
                tmp_path.unlink(missing_ok=True)

    # Fallback to Gemini 2.0 Flash Vision
    return _run_gemini_vision_ocr(image)

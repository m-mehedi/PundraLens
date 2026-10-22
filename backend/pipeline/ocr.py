"""OCR wrapper — supports Datalab Cloud OCR with Gemini Multimodal Vision fallback.

Extracts text from Bengali, English, and mixed-language notices,
including printed and handwritten text.
"""

from __future__ import annotations

import io
import logging
import os
import tempfile
import time
from pathlib import Path
from typing import TYPE_CHECKING, Optional

from PIL import Image

if TYPE_CHECKING:
    from datalab_sdk import DatalabClient
    from langchain_google_genai import ChatGoogleGenerativeAI

logger = logging.getLogger(__name__)

# Returned when every OCR attempt failed, so the request still completes.
OCR_UNAVAILABLE_TEXT = "Not available right now"

# Seconds to wait between OCR attempts.
OCR_RETRY_DELAYS = (2, 5, 10)

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
    """Run OCR directly via Gemini Vision (handles printed & handwritten Bengali/English)."""
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

    model = os.environ.get("GEMINI_MODEL", "gemini-2.5-flash")
    llm = ChatGoogleGenerativeAI(
        model=model,
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

    logger.info(f"Running OCR using {model} Vision...")
    response = llm.invoke([message])
    # Gemini 3+ replies with a list of content blocks instead of a plain
    # string, so `response.content` is not a str. `AIMessage.text` flattens
    # every text block and skips reasoning ("thinking") blocks.
    return response.text.strip()


def _ocr_once(image: Image.Image, force_gemini: bool = False) -> str:
    """Run one OCR attempt: Datalab first, then the vision-model fallback."""
    if not force_gemini:
        datalab = _get_datalab_client()
        if datalab:
            with tempfile.NamedTemporaryFile(suffix=".png", delete=False) as tmp:
                tmp_path = Path(tmp.name)

            try:
                image.save(tmp_path, format="PNG")
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

    # Fallback to Gemini Vision
    return _run_gemini_vision_ocr(image)


def run_ocr_on_image(image: Image.Image, force_gemini: bool = False) -> str:
    """Run OCR on *image*, retrying before degrading to a placeholder.

    Attempts are made with 2s, 5s and 10s waits in between. When every
    attempt fails the pipeline continues with `OCR_UNAVAILABLE_TEXT` instead
    of raising, so a flaky OCR provider never fails the whole request.

    Args:
        image: PIL Image object.
        force_gemini: If True, bypasses Datalab and uses Gemini Vision directly.

    Returns:
        Transcribed text from the notice, or `OCR_UNAVAILABLE_TEXT`.
    """
    attempts = len(OCR_RETRY_DELAYS) + 1
    last_error: Optional[Exception] = None

    for attempt in range(attempts):
        try:
            text = _ocr_once(image, force_gemini=force_gemini)
            if text and text.strip():
                return text
            last_error = RuntimeError("OCR returned no text")
        except Exception as e:  # noqa: BLE001 - retried, then degraded
            last_error = e

        if attempt < len(OCR_RETRY_DELAYS):
            delay = OCR_RETRY_DELAYS[attempt]
            logger.warning(
                "OCR attempt %s/%s failed (%s); retrying in %ss",
                attempt + 1,
                attempts,
                last_error,
                delay,
            )
            time.sleep(delay)

    logger.error(
        "OCR unavailable after %s attempts (%s). Degrading to %r.",
        attempts,
        last_error,
        OCR_UNAVAILABLE_TEXT,
    )
    return OCR_UNAVAILABLE_TEXT

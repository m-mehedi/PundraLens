"""Text-to-Speech (TTS) module for Bengali and English notice summaries."""

from __future__ import annotations

import hashlib
import logging
from pathlib import Path
from typing import Optional

from gtts import gTTS

logger = logging.getLogger(__name__)

TTS_CACHE_DIR = Path(__file__).resolve().parent.parent / "data" / "tts_cache"


def generate_speech(text: str, lang: str = "bn") -> Optional[bytes]:
    """Generate audio bytes for a text snippet using Google TTS.

    Args:
        text: Text to synthesize.
        lang: 'bn' for Bengali, 'en' for English.

    Returns:
        MP3 audio bytes, or None if failed.
    """
    if not text or not text.strip():
        return None

    try:
        TTS_CACHE_DIR.mkdir(parents=True, exist_ok=True)
        # Compute hash for caching
        text_hash = hashlib.sha256(f"{lang}_{text.strip()}".encode("utf-8")).hexdigest()
        cache_file = TTS_CACHE_DIR / f"{text_hash}.mp3"

        if cache_file.exists():
            if cache_file.stat().st_size > 0:
                return cache_file.read_bytes()
            cache_file.unlink(missing_ok=True)

        tts = gTTS(text=text.strip(), lang=lang, slow=False, timeout=5)
        tts.save(str(cache_file))
        return cache_file.read_bytes()
    except Exception as e:
        logger.warning(f"TTS generation failed for lang={lang}: {e}")
        return None

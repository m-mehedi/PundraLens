"""Shared dependencies: reusable core objects constructed once per process."""

from functools import lru_cache

from service.core.extract import Extractor


@lru_cache(maxsize=1)
def get_extractor() -> Extractor:
    """Single shared extractor (holds the LLM chain + rate-limit state)."""
    return Extractor()
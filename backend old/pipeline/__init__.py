"""PundraNoticeLens pipeline — Photo to structured notice extraction."""

from pathlib import Path
from dotenv import load_dotenv

# Automatically load .env if present
env_file = Path(__file__).resolve().parent.parent / ".env"
if env_file.exists():
    load_dotenv(dotenv_path=env_file)

from pipeline.align import align_image
from pipeline.ocr import run_ocr_on_image
from pipeline.extract import extract_notice
from pipeline.models import NoticeExtract

__all__ = [
    "align_image",
    "run_ocr_on_image",
    "extract_notice",
    "NoticeExtract",
]

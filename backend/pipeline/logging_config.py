"""Shared logging configuration for PundraNoticeLens."""

import logging
import os


def configure_logging(level: str = "INFO") -> None:
    """Configure root logger once at the application entry point."""
    logging.basicConfig(
        level=getattr(logging, level.upper(), logging.INFO),
        format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S",
    )

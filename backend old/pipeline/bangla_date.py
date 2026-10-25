"""Bengali date and digit converter.

Converts Bengali digits (০-৯) and Bengali date strings (e.g. "১৫ অক্টোবর ২০২৬")
to ISO format (YYYY-MM-DD).
"""

from __future__ import annotations

import re
from datetime import datetime
from typing import Optional

# Bengali to English digit translation table
BANGLA_TO_ENG_DIGITS = str.maketrans("০১২৩৪৫৬৭৮৯", "0123456789")
ENG_TO_BANGLA_DIGITS = str.maketrans("0123456789", "০১২৩৪৫৬৭৮৯")

# Month name mapping in Bengali to month number (1-12)
BANGLA_MONTHS = {
    # Gregorian months in Bengali
    "জানুয়ারি": 1,
    "জানুয়ারি": 1,
    "ফেব্রুয়ারি": 2,
    "ফেব্রুয়ারি": 2,
    "মার্চ": 3,
    "এপ্রিল": 4,
    "মে": 5,
    "জুন": 6,
    "জুলাই": 7,
    "আগস্ট": 8,
    "আগষ্ট": 8,
    "সেপ্টেম্বর": 9,
    "অক্টোবর": 10,
    "নভেম্বর": 11,
    "ডিসেম্বর": 12,
    # English month names in case mixed
    "january": 1, "jan": 1,
    "february": 2, "feb": 2,
    "march": 3, "mar": 3,
    "april": 4, "apr": 4,
    "may": 5,
    "june": 6, "jun": 6,
    "july": 7, "jul": 7,
    "august": 8, "aug": 8,
    "september": 9, "sep": 9,
    "october": 10, "oct": 10,
    "november": 11, "nov": 11,
    "december": 12, "dec": 12,
}


def convert_bangla_digits(text: str) -> str:
    """Convert Bengali numerals (০-৯) in a string to English numerals (0-9)."""
    if not text:
        return ""
    return text.translate(BANGLA_TO_ENG_DIGITS)


def convert_to_bangla_digits(text: str) -> str:
    """Convert English numerals (0-9) in a string to Bengali numerals (০-৯)."""
    if not text:
        return ""
    return str(text).translate(ENG_TO_BANGLA_DIGITS)


def parse_bangla_date_to_iso(date_str: str) -> Optional[str]:
    """Parse a Bengali or mixed-language date string into standard ISO format (YYYY-MM-DD).

    Examples:
        - "১৫ অক্টোবর ২০২৬" -> "2026-10-15"
        - "১৫ই অক্টোবর, ২০২৬" -> "2026-10-15"
        - "১৫/১০/২০২৬" -> "2026-10-15"
        - "2026-10-15" -> "2026-10-15"
    """
    if not date_str or not isinstance(date_str, str):
        return None

    cleaned = date_str.strip()
    # Normalize digits
    cleaned = convert_bangla_digits(cleaned)

    # Check if already ISO format YYYY-MM-DD
    iso_match = re.search(r"\b(\d{4})-(\d{1,2})-(\d{1,2})\b", cleaned)
    if iso_match:
        y, m, d = int(iso_match.group(1)), int(iso_match.group(2)), int(iso_match.group(3))
        try:
            return datetime(y, m, d).strftime("%Y-%m-%d")
        except ValueError:
            pass

    # Check DD-MM-YYYY or DD/MM/YYYY
    slash_match = re.search(r"\b(\d{1,2})[\/\.-](\d{1,2})[\/\.-](\d{4})\b", cleaned)
    if slash_match:
        d, m, y = int(slash_match.group(1)), int(slash_match.group(2)), int(slash_match.group(3))
        try:
            return datetime(y, m, d).strftime("%Y-%m-%d")
        except ValueError:
            pass

    # Clean ordinals like '১৫ই', '১লা', '২রা', '৩রা', '৪ঠা', 'th', 'st', 'nd', 'rd'
    cleaned_tokens = re.sub(r"(\d+)(ই|লা|রা|ঠা|th|st|nd|rd)", r"\1", cleaned)

    # Check "Day Month Year" e.g. "15 অক্টোবর 2026"
    for month_name, month_num in BANGLA_MONTHS.items():
        pattern = rf"\b(\d{{1,2}})\s*(?:[\,\.\-]?\s*)({re.escape(month_name)})\s*(?:[\,\.\-]?\s*)(\d{{4}})\b"
        match = re.search(pattern, cleaned_tokens, re.IGNORECASE)
        if match:
            day = int(match.group(1))
            year = int(match.group(3))
            try:
                return datetime(year, month_num, day).strftime("%Y-%m-%d")
            except ValueError:
                continue

        # Check "Month Day, Year" e.g. "October 15, 2026"
        rev_pattern = rf"\b({re.escape(month_name)})\s+(\d{{1,2}})\s*(?:[\,\.\-]?\s*)(\d{{4}})\b"
        match2 = re.search(rev_pattern, cleaned_tokens, re.IGNORECASE)
        if match2:
            day = int(match2.group(2))
            year = int(match2.group(3))
            try:
                return datetime(year, month_num, day).strftime("%Y-%m-%d")
            except ValueError:
                continue

    return None

"""iCalendar (.ics) export generator for notice deadlines and events."""

from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import List, Optional

from pipeline.models import NoticeRecord


def generate_ics_calendar(notices: List[NoticeRecord], calendar_name: str = "PUB NoticeLens Deadlines") -> str:
    """Generate an RFC 5545 standard .ics file content for notice deadlines and events.

    Args:
        notices: List of NoticeRecord instances containing deadlines or event dates.
        calendar_name: Name of the exported calendar.

    Returns:
        String containing valid .ics file contents.
    """
    now_stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")

    lines = [
        "BEGIN:VCALENDAR",
        "VERSION:2.0",
        "PRODID:-//PUB NoticeLens//University Notice Intelligence//EN",
        f"X-WR-CALNAME:{calendar_name}",
        "CALSCALE:GREGORIAN",
        "METHOD:PUBLISH",
    ]

    for notice in notices:
        # 1. Add Deadlines
        if notice.deadlines:
            for dl in notice.deadlines:
                if not dl.date:
                    continue
                try:
                    # dl.date is in YYYY-MM-DD format
                    clean_date = dl.date.replace("-", "")
                    uid = f"deadline-{notice.id}-{uuid.uuid4().hex[:8]}@noticelens.pub"
                    summary = f"Deadline: {dl.description or notice.title}"
                    desc = f"Notice: {notice.title}\\nIssuing Office: {notice.issuing_office or 'University'}\\nRequired Action: {notice.required_action or 'Review notice'}"

                    lines.extend([
                        "BEGIN:VEVENT",
                        f"UID:{uid}",
                        f"DTSTAMP:{now_stamp}",
                        f"DTSTART;VALUE=DATE:{clean_date}",
                        f"DTEND;VALUE=DATE:{clean_date}",
                        f"SUMMARY:{_escape_ics(summary)}",
                        f"DESCRIPTION:{_escape_ics(desc)}",
                        f"LOCATION:{_escape_ics(notice.venue or 'University')}",
                        "STATUS:CONFIRMED",
                        "TRANSP:TRANSPARENT",
                        "END:VEVENT",
                    ])
                except Exception:
                    continue

        # 2. Add Event Date & Time
        if notice.event_date_time and notice.event_date_time.date:
            try:
                clean_date = notice.event_date_time.date.replace("-", "")
                uid = f"event-{notice.id}-{uuid.uuid4().hex[:8]}@noticelens.pub"
                summary = f"Event: {notice.title}"
                time_str = notice.event_date_time.time or ""
                desc = f"Event: {notice.title}\\nTime: {time_str}\\nVenue: {notice.venue or 'University'}\\nAction: {notice.required_action or ''}"

                lines.extend([
                    "BEGIN:VEVENT",
                    f"UID:{uid}",
                    f"DTSTAMP:{now_stamp}",
                    f"DTSTART;VALUE=DATE:{clean_date}",
                    f"DTEND;VALUE=DATE:{clean_date}",
                    f"SUMMARY:{_escape_ics(summary)}",
                    f"DESCRIPTION:{_escape_ics(desc)}",
                    f"LOCATION:{_escape_ics(notice.venue or 'Campus')}",
                    "STATUS:CONFIRMED",
                    "TRANSP:OPAQUE",
                    "END:VEVENT",
                ])
            except Exception:
                continue

    lines.append("END:VCALENDAR")
    return "\r\n".join(lines)


def _escape_ics(text: str) -> str:
    """Escape special characters for iCalendar format."""
    if not text:
        return ""
    return (
        text.replace("\\", "\\\\")
        .replace(";", "\\;")
        .replace(",", "\\,")
        .replace("\n", "\\n")
    )

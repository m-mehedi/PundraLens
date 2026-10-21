"""Pydantic models for the structured notice extraction output."""

from __future__ import annotations

from typing import Literal, Optional

from pydantic import BaseModel, Field


class Deadline(BaseModel):
    """A deadline extracted from a notice."""

    date: str = Field(description="Deadline date in ISO format (YYYY-MM-DD)")
    description: str = Field(description="What this deadline is for")


class EventDateTime(BaseModel):
    """Date and time of an event mentioned in a notice."""

    date: str = Field(description="Event date in ISO format (YYYY-MM-DD)")
    time: Optional[str] = Field(default=None, description="Event time (HH:MM)")


class TargetStudents(BaseModel):
    """Which students the notice applies to."""

    department: Optional[str] = Field(default=None, description="Target department")
    batch: Optional[str] = Field(default=None, description="Target batch/year")
    semester: Optional[str] = Field(default=None, description="Target semester")


class Fees(BaseModel):
    """Fee information extracted from a notice."""

    amount: float = Field(description="Fee amount")
    currency: str = Field(default="BDT", description="Currency code (e.g., BDT, USD)")


class NoticeExtract(BaseModel):
    """Structured extraction result from a notice image.

    This is the final output of the pipeline, produced by the LLM extraction step.
    """

    title: Optional[str] = Field(
        default=None, description="Title or heading of the notice"
    )
    issuing_office: Optional[str] = Field(
        default=None, description="Office or department that issued the notice"
    )
    date_of_issue: Optional[str] = Field(
        default=None,
        description="Date the notice was issued, in ISO format (YYYY-MM-DD). Convert Bengali dates to ISO.",
    )
    deadlines: Optional[list[Deadline]] = Field(
        default=None, description="List of deadlines mentioned in the notice"
    )
    event_date_time: Optional[EventDateTime] = Field(
        default=None, description="Date and time of an event, if mentioned"
    )
    venue: Optional[str] = Field(
        default=None, description="Venue or location mentioned in the notice"
    )
    target_students: Optional[TargetStudents] = Field(
        default=None, description="Which students this notice applies to"
    )
    required_action: Optional[str] = Field(
        default=None, description="What the student needs to do"
    )
    fees: Optional[Fees] = Field(
        default=None, description="Fee or payment information, if any"
    )
    contact: Optional[str] = Field(
        default=None, description="Contact person or office for inquiries"
    )
    category: Literal[
        "exam",
        "registration",
        "fee",
        "holiday",
        "event",
        "scholarship",
        "result",
        "general",
    ] = Field(
        default="general",
        description="Category of the notice",
    )
    summary_bengali: str = Field(
        description="Short summary of the notice in Bengali"
    )
    summary_english: str = Field(
        description="Short summary of the notice in English"
    )

from typing import List, Literal
from pydantic import BaseModel, Field


class ExtractionSchema(BaseModel):
    title: str = Field(
        description="Generate title by reading the body. Must be less than 8 words and in Bengali language only."
    )
    issuing_office: str = Field(
        description="Name of the office issuing the notice. Write in English."
    )
    date_of_issue: str = Field(
        description="Date the notice was issued in YYYY-MM-DD format."
    )
    category: Literal["exam", "registration", "admission", "fee", "holiday", "event", "scholarship", "result", "general"] = Field(
        description="Category of the notice. Must be exactly one of: exam, registration, admission, fee, holiday, event, scholarship, result, general. If unclear, use 'general'."
    )
    deadline: str = Field(
        description="Last date to complete the action mentioned in the notice (YYYY-MM-DD). If not mentioned, use 'NONE'."
    )
    event_date_and_time: str = Field(
        description="When the event will happen in UTC ISO 8601 format (YYYY-MM-DDTHH:MM:SSZ). If only date is known, use YYYY-MM-DDT00:00:00Z. If not mentioned, use 'NONE'."
    )
    venue: str = Field(
        description="Venue or location mentioned in the notice. Write in English. If not mentioned, use 'Pundra University of Science & Technology'."
    )
    departments: str = Field(
        description="Departments the notice applies to. Must be a comma-separated list using ONLY these exact codes: BBA, CSE, EEE, CVIL, PH, IS, ENG, LAW, BAN, DS, JMS. If notice applies to all departments or doesn't mentioned any department use 'all'"
    )
    batches: List[int] = Field(
        default_factory=lambda: [-1],
        description="Intake numbers the notice applies to. Use [-1] for all batches or if not mentioned any batches."
    )
    required_action: str = Field(
        description="What the student needs to do. Write in Bengali. If not mentioned, use 'NONE'."
    )
    fees: str = Field(
        description="Fee information exactly as written in the notice. If not mentioned, use 'NONE'."
    )
    contact: str = Field(
        description="Contact person or office for inquiries. Write in English. If not mentioned, use 'Pundra University of Science & Technology'."
    )
    notice_no: str = Field(
        description="The notice number exactly as written in the notice (preserve original language/mixed scripts). If not mentioned, use 'NONE'."
    )
    notice_summary_bn: str = Field(
        description="Summary of the notice body in Bengali language. Required field."
    )
    notice_summary_en: str = Field(
        description="Summary of the notice body in English language. Required field."
    )
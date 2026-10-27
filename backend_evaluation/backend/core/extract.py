import os
import time

from langchain_core.prompts import ChatPromptTemplate
from langchain_google_genai import ChatGoogleGenerativeAI

from service.core.exceptions import ExtractionFailure
from service.core.schema import ExtractionSchema

MODEL = os.getenv("EXTRACTION_MODEL", "gemini-3.5-flash-lite")
MAX_RETRIES = 3
RETRY_DELAY_SECONDS = 2

# Rate limiting: stay under the API's requests-per-minute cap.
# RPM=15 -> 60/15 = 4.0s minimum, plus a small margin for timing jitter/retries.
RPM_LIMIT = int(os.getenv("EXTRACTION_RPM_LIMIT", "15"))
SECONDS_BETWEEN_REQUESTS = (60.0 / RPM_LIMIT) + 0.5

SYSTEM_PROMPT = """You extract structured data from notices issued by Pundra University of \
Science & Technology (পুণ্ড্র ইউনিভার্সিটি অব সায়েন্স অ্যান্ড টেকনোলজি).

The notice text may contain a mix of Bengali and English.

Follow every field description in the output schema exactly, including:
- The required language for each field (Bengali vs English).
- The required date/time formats.
- Sentinel values for missing data: "NONE", -1, "all".
- The notice number must be preserved exactly as written (keep mixed scripts).
- Departments must use ONLY the allowed codes: BBA, CSE, EEE, CVIL, PH, IS, ENG, LAW, BAN, DS, JMS.

Return only the structured data. Do not invent information that is not present in the notice."""

HUMAN_PROMPT = """Extract the structured data from this notice:

<notice>
{notice}
</notice>"""


class Extractor:
    """Reusable extractor wrapping the LangChain + Gemini chain.

    Construct once and call `extract()` repeatedly; rate limiting is applied
    between successive calls.
    """

    def __init__(self, model: str = MODEL):
        llm = ChatGoogleGenerativeAI(model=model)
        structured_llm = llm.with_structured_output(ExtractionSchema)
        prompt = ChatPromptTemplate.from_messages([
            ("system", SYSTEM_PROMPT),
            ("human", HUMAN_PROMPT),
        ])
        self._chain = prompt | structured_llm
        self._last_request_at: float | None = None

    def _throttle(self) -> None:
        if self._last_request_at is not None:
            elapsed = time.perf_counter() - self._last_request_at
            remaining = SECONDS_BETWEEN_REQUESTS - elapsed
            if remaining > 0:
                time.sleep(remaining)

    def _invoke(self, text: str) -> ExtractionSchema:
        last_error = None
        for attempt in range(1, MAX_RETRIES + 1):
            self._throttle()
            try:
                result = self._chain.invoke({"notice": text})
                self._last_request_at = time.perf_counter()
                return result
            except Exception as e:
                self._last_request_at = time.perf_counter()
                last_error = e
                message = str(e).lower()
                is_rate_limit = "429" in message or "rate" in message or "quota" in message
                delay = RETRY_DELAY_SECONDS * attempt * (3 if is_rate_limit else 1)
                if attempt < MAX_RETRIES:
                    print(
                        f"    ⚠ Attempt {attempt}/{MAX_RETRIES} failed "
                        f"({'rate limit' if is_rate_limit else 'error'}): {e}"
                    )
                    print(f"    ⏳ Waiting {delay:.0f}s before retry...")
                    time.sleep(delay)
        raise ExtractionFailure(f"Extraction failed after {MAX_RETRIES} attempts: {last_error}")

    def extract(self, text: str) -> ExtractionSchema:
        if not text or not text.strip():
            raise ExtractionFailure("Cannot extract from empty text")
        return self._invoke(text)


def extract_from_markdown(text: str, extractor: Extractor | None = None) -> ExtractionSchema:
    """Convenience wrapper. Reuses a cached default extractor when none is given."""
    extractor = extractor or _default_extractor()
    return extractor.extract(text)


_default: Extractor | None = None


def _default_extractor() -> Extractor:
    global _default
    if _default is None:
        _default = Extractor()
    return _default

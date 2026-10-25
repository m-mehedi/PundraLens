import json
import time
from pathlib import Path

from dotenv import load_dotenv
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.prompts import ChatPromptTemplate

from schema import ExtractionSchema

load_dotenv()

MODEL = "gemini-3.5-flash-lite"
MAX_RETRIES = 3
RETRY_DELAY_SECONDS = 2

# Rate limiting: stay under the API's requests-per-minute cap.
# RPM=15 -> 60/15 = 4.0s minimum between requests, plus a small margin
# so timing jitter/retries don't trip the rolling window.
RPM_LIMIT = 15
SECONDS_BETWEEN_REQUESTS = (60.0 / RPM_LIMIT) + 0.5  # 4.5s for 15 RPM

SYSTEM_PROMPT = """You extract structured data from notices issued by Pundra University of \
Science & Technology (পুণ্ড্র ইউনিভার্সিটি অব সায়েন্স অ্যান্ড টেকনোলজি).

The notice text is given as markdown and may contain a mix of Bengali and English.

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


def build_chain():
    # Note: gemini-3.5-flash-lite uses fixed sampling defaults, so we do not
    # pass temperature (it would be ignored and emit a warning).
    llm = ChatGoogleGenerativeAI(model=MODEL)
    structured_llm = llm.with_structured_output(ExtractionSchema)
    prompt = ChatPromptTemplate.from_messages([
        ("system", SYSTEM_PROMPT),
        ("human", HUMAN_PROMPT),
    ])
    return prompt | structured_llm


def extract_one(chain, markdown: str) -> ExtractionSchema:
    """Run extraction with retries. Backs off longer on rate-limit (429) errors."""
    last_error = None
    for attempt in range(1, MAX_RETRIES + 1):
        try:
            return chain.invoke({"notice": markdown})
        except Exception as e:
            last_error = e
            message = str(e).lower()
            is_rate_limit = "429" in message or "rate" in message or "quota" in message
            delay = RETRY_DELAY_SECONDS * attempt * (3 if is_rate_limit else 1)
            print(f"    ⚠ Attempt {attempt}/{MAX_RETRIES} failed ({'rate limit' if is_rate_limit else 'error'}): {e}")
            if attempt < MAX_RETRIES:
                print(f"    ⏳ Waiting {delay:.0f}s before retry...")
                time.sleep(delay)
    raise last_error


def main():
    input_dir = Path("../output_clean")
    output_dir = Path("../extracted")
    output_dir.mkdir(exist_ok=True)

    chain = build_chain()

    md_files = sorted(input_dir.glob("*.md"), key=lambda p: p.stem)
    print(f"Found {len(md_files)} notice(s) to extract")

    total_start = time.perf_counter()
    statuses = []

    for idx, md_path in enumerate(md_files):
        stem = md_path.stem
        start = time.perf_counter()
        try:
            markdown = md_path.read_text(encoding="utf-8")
            if not markdown.strip():
                elapsed = time.perf_counter() - start
                print(f"  ⚠ {stem}: empty input, skipped ({elapsed:.1f}s)")
                statuses.append({"file": stem, "status": "skipped", "seconds": round(elapsed, 2)})
                continue

            result = extract_one(chain, markdown)

            output_path = output_dir / f"{stem}.json"
            output_path.write_text(
                result.model_dump_json(indent=2, ensure_ascii=False),
                encoding="utf-8",
            )
            elapsed = time.perf_counter() - start
            print(f"  ✓ {stem}: success in {elapsed:.1f}s -> {output_path}")
            statuses.append({"file": stem, "status": "success", "seconds": round(elapsed, 2)})

        except Exception as e:
            elapsed = time.perf_counter() - start
            print(f"  ✗ {stem}: failed in {elapsed:.1f}s — {e}")
            statuses.append({"file": stem, "status": "failed", "seconds": round(elapsed, 2), "error": str(e)})

        # Pace requests to respect the RPM limit (skip the wait after the last file)
        time.sleep(4)

    total_elapsed = time.perf_counter() - total_start
    succeeded = sum(1 for s in statuses if s["status"] == "success")
    failed = sum(1 for s in statuses if s["status"] == "failed")
    skipped = sum(1 for s in statuses if s["status"] == "skipped")

    # Write a run summary alongside the extracted output
    summary = {
        "model": MODEL,
        "rpm_limit": RPM_LIMIT,
        "total_files": len(md_files),
        "succeeded": succeeded,
        "failed": failed,
        "skipped": skipped,
        "total_seconds": round(total_elapsed, 2),
        "files": statuses,
    }
    (output_dir / "_run_summary.json").write_text(
        json.dumps(summary, indent=2, ensure_ascii=False),
        encoding="utf-8",
    )

    print(f"\nDone in {total_elapsed:.1f}s — {succeeded} succeeded, {failed} failed, {skipped} skipped")


if __name__ == "__main__":
    main()

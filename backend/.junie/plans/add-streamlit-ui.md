---
sessionId: session-261018-190926-13fp
---

# Requirements

### Overview & Goals
Build a Streamlit-based web UI in `ui.py` for the PundraNoticeLens pipeline — allowing users to upload a photo of a notice and view the extracted structured fields in a clean, readable format.

### Scope
**In Scope:**
- Image upload via Streamlit file uploader (PNG, JPG, JPEG)
- Running the full pipeline (`process_photo`) on the uploaded image
- Displaying each extracted field from `NoticeExtract` in a structured, human-readable layout
- Showing intermediate pipeline outputs (aligned image, OCR text) for debugging/verification
- Error handling with user-friendly messages (missing API keys, pipeline failures)
- Progress indicators for each pipeline stage (Align → OCR → Extract)

**Out of Scope:**
- Authentication, multi-user support, or persistence
- Download/export of results (beyond copyable text)
- Mobile-specific UI adjustments

### Functional Requirements
1. **Image Upload**: User selects or drags a notice image file; only image formats are accepted.
2. **Pipeline Execution**: On upload, the full 3-stage pipeline runs sequentially with visible progress.
3. **Result Display**: All `NoticeExtract` fields are displayed in labeled sections — title, issuing office, date, deadlines, event info, venue, target students, required action, fees, contact, category, and summaries (Bengali + English).
4. **Intermediate Outputs**: The aligned image and raw OCR text are shown in expandable sections so the user can verify each stage.
5. **Error Handling**: If the pipeline fails (e.g., missing `DATALAB_API_KEY` or `GOOGLE_API_KEY`), a clear error message is shown with instructions.
6. **Reset/Clear**: User can clear the current result and upload a new image without restarting the app.

### Non-Functional Requirements
- The UI must be **verbose and detailed** — every field, every stage output, and every error must be explicitly shown so the user can check every implementation detail.
- The UI should be responsive and not block during pipeline execution (use Streamlit progress bars and spinners).
- All comments in `ui.py` should be thorough, explaining what each section does.

# Technical Design

### Current Implementation
The project is a notice extraction pipeline with three stages:

1. **`pipeline/align.py`** — `align_image(image: Image.Image) -> Image.Image`: Uses DocAligner to detect document corners, dewarp, and crop the image. Falls back to the original image on failure.
2. **`pipeline/ocr.py`** — `run_ocr_on_image(image: Image.Image) -> str`: Sends the aligned image to Datalab's cloud OCR API. Requires `DATALAB_API_KEY` env var.
3. **`pipeline/extract.py`** — `extract_notice(ocr_text: str) -> NoticeExtract`: Sends OCR text to Google Gemini via LangChain for structured field extraction. Requires `GOOGLE_API_KEY` env var.

The entry point `main.py` exposes `process_photo(image_bytes: bytes) -> dict[str, Any]` which orchestrates all three stages and returns the `NoticeExtract` model as a dictionary.

The `NoticeExtract` model (`pipeline/models.py`) defines these fields:
- `title`, `issuing_office`, `date_of_issue` (strings)
- `deadlines` (list of `{date, description}`)
- `event_date_time` (`{date, time}`)
- `venue`, `required_action`, `contact` (strings)
- `target_students` (`{department, batch, semester}`)
- `fees` (`{amount, currency}`)
- `category` (enum: exam, registration, fee, holiday, event, scholarship, result, general)
- `summary_bengali`, `summary_english` (strings)

`ui.py` currently exists but is empty. `streamlit>=1.66.0` is already listed as a dependency in `pyproject.toml`.

### Key Decisions
- **Run pipeline stage-by-stage in the UI** rather than calling `process_photo()` as a black box. This allows showing intermediate results (aligned image, OCR text) at each stage — critical for the user's requirement to "check every implementation."
- **Use Streamlit's native components** (file uploader, expander, progress bar, columns, dataframes) for simplicity and consistency.
- **Display results in a structured card-like layout** using Streamlit columns and headers, with each field of `NoticeExtract` getting its own labeled section.
- **Show intermediate outputs in expandable sections** (`st.expander`) so the UI stays clean but the user can drill into details.

### Proposed Changes
All changes are in `ui.py` only. The file will be written as a complete Streamlit application:

1. **App header and description** — title, subtitle, and brief instructions.
2. **File uploader** — accept images, validate format, display the uploaded image preview.
3. **Pipeline execution with progress tracking** — run each stage (Align → OCR → Extract) with a `st.progress` bar and `st.spinner` for each stage.
4. **Intermediate results display** — show the aligned image and raw OCR text in expandable sections.
5. **Final structured results** — display all `NoticeExtract` fields in a well-organized layout with headers, columns, and tables (for deadlines).
6. **Error handling** — catch and display errors from each stage with actionable messages (e.g., "Set DATALAB_API_KEY environment variable").
7. **Session state management** — use `st.session_state` to persist results across reruns and allow clearing.

### File Structure
- **Modified:** `ui.py` — will be written as a complete Streamlit app (~250-350 lines, heavily commented)

### Architecture Diagram

``` mermaid
graph LR
    A[User uploads image] --> B[Streamlit UI ui.py]
    B --> C[Stage 1: align_image]
    C --> D[Show aligned image in expander]
    D --> E[Stage 2: run_ocr_on_image]
    E --> F[Show OCR text in expander]
    F --> G[Stage 3: extract_notice]
    G --> H[Display structured NoticeExtract fields]
    H --> I[Title, Office, Date, Deadlines, Event, Venue, Students, Action, Fees, Contact, Category, Summaries]
```

### Risks
- **Pipeline latency**: OCR and LLM calls can take 5-15 seconds each. Progress bars and spinners will keep the user informed.
- **API key errors**: If `DATALAB_API_KEY` or `GOOGLE_API_KEY` is not set, the error will be caught and displayed clearly with instructions.
- **Large images**: Very high-resolution images may slow down alignment. No resize is planned but the UI will show a preview.

# Delivery Steps

### ✓ Step 1: Implement Streamlit UI with image upload, pipeline execution, and intermediate results
Write the complete `ui.py` as a Streamlit application with image upload, stage-by-stage pipeline execution, and intermediate result display.

- Add app header with title, description, and usage instructions.
- Implement a file uploader (`st.file_uploader`) accepting PNG/JPG/JPEG images with a preview of the uploaded image.
- Run the pipeline stage by stage (not as a black box):
  - **Stage 1 — Align**: Call `align_image()`, show progress, display the aligned image in an `st.expander`.
  - **Stage 2 — OCR**: Call `run_ocr_on_image()`, show progress, display the raw OCR text in an `st.expander` with a code block.
  - **Stage 3 — Extract**: Call `extract_notice()`, show progress.
- Use `st.progress` bar that advances through the 3 stages and `st.spinner` for each stage with a descriptive label.
- Use `st.session_state` to store and persist the uploaded image and results across reruns.
- Add a "Clear" button to reset session state and allow a new upload.
- Wrap each pipeline stage in a try/except block to catch and display errors (missing API keys, network failures, etc.) with actionable messages.
- Add verbose inline comments throughout explaining every section and every Streamlit component used.
- Run with `if __name__ == "__main__"` guard is not needed for Streamlit; add a module docstring and comments instead.
- Validate that the app can be launched with `streamlit run ui.py`.

### ✓ Step 2: Implement structured results display for all NoticeExtract fields
Add the final results display section to `ui.py` that presents all extracted `NoticeExtract` fields in a detailed, readable layout.

- After successful extraction, display a "### Extraction Results" header.
- Show top-level fields in a two-column layout (`st.columns(2)`):
  - **Title** and **Category** (with emoji badge per category)
  - **Issuing Office** and **Date of Issue**
  - **Venue** and **Required Action**
  - **Contact** (full width if present)
- Display **Deadlines** as a table (`st.dataframe` or `st.table`) with columns: Date and Description. Show "No deadlines found" if empty.
- Display **Event Date & Time** in a labeled section with date and time side by side.
- Display **Target Students** as a labeled section showing department, batch, and semester.
- Display **Fees** with amount and currency formatted clearly (e.g., "৳ 500 BDT").
- Display **Summaries** in two expandable sections:
  - "Summary (Bengali)" — `summary_bengali`
  - "Summary (English)" — `summary_english`
- Add a final section showing the **raw JSON output** of the full `NoticeExtract` in a code block for complete transparency.
- Handle `None`/missing fields gracefully — skip empty fields or show "Not specified" rather than "None".
- Add verbose comments explaining the display logic for each field group.
- Ensure the complete `ui.py` is self-contained and runnable via `streamlit run ui.py`.
---
sessionId: session-261023-184748-8vup
---

# Requirements

### Overview
Add a `/api/warp` endpoint to `service/` and align the `frontend/` schema to the flat `ExtractionSchema` from `service/core/schema.py`. The `service/` keeps only the endpoints it already has (`/extract`, `/health`) plus the new `/api/warp`. Notice CRUD (save, delete, list, publish) is handled by the frontend's server actions — no backend DB or notice endpoints are needed.

### Key Schema Changes (Old → New)
| Old | New | Change |
|---|---|---|
| `deadlines: Deadline[]` | `deadline: string` | Array → single date |
| `event_date_time: {date, time}` | `event_date_and_time: string` | Object → ISO 8601 |
| `target_students: {dept, batch, sem}` | `departments: string` + `batches: number[]` | Object → CSV + int array |
| `fees: {amount, currency}` | `fees: string` | Object → free text |
| `summary_bengali` | `notice_summary_bn` | Renamed |
| `summary_english` | `notice_summary_en` | Renamed |
| *(new)* | `notice_no: string` | New field |

### Scope
- **In Scope:** Add `/api/warp` to `service/`, align all frontend types and components to `ExtractionSchema`
- **Out of Scope:** Notice CRUD endpoints in backend, backend DB, `/api/align`, `/api/render`, `/api/qa`, `/api/departments`, `/api/categories`, `/api/tts`, `/api/benchmark`, `/api/calendar/ics`
- **Route prefix:** `/api/*` kept the same — the frontend proxy at `frontend/app/api/pipeline/warp/route.ts` calls `/api/warp` on the backend URL

# Technical Design

### Current State
- **service/** has 2 endpoints: `POST /extract` and `GET /health` in `service/api/main.py`
- **backend/api.py** has `/api/warp` (lines 441-513): accepts an image + 4 corner percentages, warps via `warp_with_corners` from `backend/pipeline/align.py`, returns a JPEG data URL
- **frontend/** proxies to `/api/warp` via `frontend/app/api/pipeline/warp/route.ts` (calls `callBackend("/api/warp", formData)`)
- **frontend/** types (`notice-types.ts`, `upload-notice/types.ts`, `notice-actions.ts`) still use the old nested schema (`deadlines[]`, `event_date_time{}`, `target_students{}`, `fees{}`)

### Architecture
```
graph LR
  FE[frontend Next.js] -->|/api/warp| SV[service/api/main.py]
  FE -->|/extract| SV
  FE -->|/health| SV
  SV --> WR[warp endpoint]
  WR --> AL[core/align.py]
  FE -->|server actions| DB[(frontend SQLite)]
```

### Key Decisions
1. **Flat schema wins** — `ExtractionSchema` in `service/core/schema.py` is the source of truth for all frontend types
2. **Only `/api/warp` added to service/** — no notice CRUD, no DB, no other endpoints
3. **Port `warp_with_corners` from `backend/pipeline/align.py`** into `service/core/align.py` — the warp logic is self-contained
4. **Frontend notice CRUD stays as server actions** — `backend-server.ts` notice functions will be replaced by frontend server actions later (out of scope)

### Phase 1: Add `/api/warp` to service/
- Copy `warp_with_corners` and helpers (`_order_corners`, `_compute_output_size`) from `backend/pipeline/align.py` into new `service/core/align.py`
- Add `POST /api/warp` endpoint to `service/api/main.py`: accepts `file` (image) + `corners` (JSON string of 4 percentage points), returns `{success, data: {image, width, height}}` matching the backend's response shape
- Corner parsing helpers (`_parse_corner_points`, `_to_pixel_corners`) live alongside the endpoint in `main.py`

### Phase 2: Align Frontend Types
- `frontend/lib/notice-types.ts`: remove nested types (`NoticeDeadline`, `NoticeEventDateTime`, `NoticeTargetStudents`, `NoticeFees`), update `NoticeRecord`/`NoticePatch` with flat fields, add "admission" to `NoticeCategory`
- `frontend/components/upload-notice/types.ts`: flat `ExtractResult.data`, flat `NoticeFormValues`
- `frontend/lib/notice-actions.ts`: flat `SaveNoticeInput`, remove nested object construction

### Phase 3: Update Frontend Components
- `use-notice-form.ts`: map flat fields, remove deadline array/fee split/semester
- `notice-form.tsx`: single deadline date input, single event datetime, departments CSV, batches array, fees text
- `notice-list.tsx`: display `notice_summary_bn`, `deadline` string, `departments` string, `fees` string
- `notice-edit-form.tsx`: flat field editing, no nested objects
- `dashboard/page.tsx`: use `notice.deadline` (single string) instead of iterating `deadlines[]`
- `extract-panel.tsx`, `notice-sheet.tsx`, `deadline-stamp.tsx`: update field references

# Testing

### Validation
**Phase 1:** Start uvicorn on `service.api.main:app`, hit `POST /api/warp` with an image + 4 corner percentages — returns a JPEG data URL

**Phase 2:** `bun run typecheck` passes, `bun run lint` shows only baseline errors (2 problems)

**Phase 3:** Manual: upload → extract → see flat fields → save → publish → list. Dashboard shows deadlines correctly. Notice list shows `notice_summary_bn`. Edit form saves flat fields.

# Delivery Steps

### ✓ Step 1: Add `/api/warp` endpoint to service/
Add the warp (perspective correction) endpoint to `service/api/main.py` so the frontend's proxy route works against the new backend.

- Create `service/core/align.py` with `warp_with_corners`, `_order_corners`, and `_compute_output_size` ported from `backend/pipeline/align.py`
- Add `POST /api/warp` to `service/api/main.py`: accepts `file` (image) + `corners` (JSON string of 4 percentage points), validates image type and size, parses corners, converts to pixel coordinates, warps via `warp_with_corners`, returns `{success, data: {image, width, height}}` as a JPEG data URL
- Add corner parsing helpers (`_parse_corner_points`, `_to_pixel_corners`) in `main.py` (same logic as `backend/api.py`)
- Verify: start uvicorn on `service.api.main:app`, send `POST /api/warp` with a test image and 4 corners

### ✓ Step 2: Align Frontend Types to ExtractionSchema
Update all frontend type definitions to match the flat `ExtractionSchema` from `service/core/schema.py`.

- `frontend/lib/notice-types.ts`: remove nested types (`NoticeDeadline`, `NoticeEventDateTime`, `NoticeTargetStudents`, `NoticeFees`), update `NoticeRecord` with flat fields (`deadline` string, `event_date_and_time` string, `departments` string, `batches` number[], `fees` string, `notice_no` string, `notice_summary_bn`, `notice_summary_en`), add "admission" to `NoticeCategory`
- `frontend/components/upload-notice/types.ts`: flat `ExtractResult.data`, flat `NoticeFormValues` (`deadline` string, `eventDateTime` string, `departments` string, `batches` number[], `fees` string, `noticeNo` string, `noticeSummaryBn/En`)
- `frontend/lib/notice-actions.ts`: flat `SaveNoticeInput`, remove `target_students`/`event_date_time`/`fees` object construction
- Verify: `bun run typecheck` passes, `bun run lint` shows only baseline errors

### ✓ Step 3: Update Frontend Components for Flat Schema
Update all frontend components that read or write notice data to use the flat schema.

- `use-notice-form.ts`: map flat extraction fields in `valuesFromResult()`, emit flat `SaveNoticeInput` in `toSaveInput()`, remove deadline array management, fee amount/currency split, semester field
- `notice-form.tsx`: single deadline date input, single event datetime-local input, departments CSV text, batches number array, fees free text, notice_no input, summary fields renamed
- `notice-list.tsx`: display `notice_summary_bn`, `deadline` string, `departments` string, `fees` string
- `notice-edit-form.tsx`: flat field editing, remove nested object construction in `handleSave`, remove semester and feeAmount/feeCurrency split
- `dashboard/page.tsx`: use `notice.deadline` (single string) instead of iterating `deadlines[]`, show as single badge
- `category-badge.tsx`: add "admission" category entry
- `deadline-stamp.tsx`: unused dead code (never imported), left as-is
- Verify: `bun run typecheck` passes (0 errors), `bun run lint` shows only baseline errors (2 problems)
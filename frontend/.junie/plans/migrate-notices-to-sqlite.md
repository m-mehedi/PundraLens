---
sessionId: session-261023-193854-19if
---

# Problem & Solution

### Problem
`app/dashboard/page.tsx` calls `listNotices()` from `lib/backend-server.ts`, which fetches `BACKEND_URL/api/notices`. The `.env` sets `BACKEND_URL=http://localhost:3000` (the Next.js frontend itself), and no `/api/notices` route exists anywhere — the FastAPI backend only has `/health`, `/extract`, and `/api/warp`. This produces a 404 → 500 error on the dashboard.

### Solution
Move notices storage from the nonexistent remote API into the frontend's SQLite database (Drizzle ORM). Rewrite `lib/backend-server.ts` to query the local database instead of making HTTP requests.

### Changes Overview
1. **Add a `notice` table** to the Drizzle schema (`auth-schema.ts` → new `notice-schema.ts`)
2. **Rewrite `lib/backend-server.ts`** to use Drizzle queries instead of `fetch()`
3. **Export the new schema** from `schemas/index.ts`
4. **Remove `BACKEND_URL`/`API_KEY` dependency** from the notice functions (they remain for the OCR pipeline routes that still need the backend)

### What stays the same
- `lib/notice-actions.ts` — no changes needed, it already imports from `backend-server.ts`
- `lib/notice-types.ts` — types remain unchanged
- Dashboard pages — no changes needed, they import from `backend-server.ts`
- The OCR pipeline API routes (`/api/pipeline/*`) — still call the FastAPI backend

# Fix Pipeline Backend Routes

### Problem
The Next.js API route handlers under `app/api/pipeline/` proxy to backend paths that have changed. The backend (FastAPI at port 8000) now has only three endpoints:
- `GET /health` — health check
- `POST /extract` — extract notice data from image/PDF/text
- `POST /api/warp` — perspective warp an image

The proxy routes were pointing to old paths (`/api/health`, `/api/extract`, `/api/render`, `/api/align`, `/api/qa`, `/api/models`) and `BACKEND_URL` in `.env` pointed to port 3000 (the frontend) instead of 8000 (the backend).

### Solution
Fix the proxy paths for the endpoints that still exist on the backend and correct the `BACKEND_URL`.

### Changes
1. **`.env`**: Changed `BACKEND_URL` from `http://localhost:3000` to `http://localhost:8000`.
2. **`app/api/pipeline/health/route.ts`**: Changed proxy path from `/api/health` to `/health`.
3. **`app/api/pipeline/extract/route.ts`**: Changed proxy path from `/api/extract` to `/extract`.
4. **`app/api/pipeline/warp/route.ts`**: Already correct (`/api/warp`), no change needed.

### What stays broken (to be fixed later)
- `/api/pipeline/render` → `/api/render` — endpoint gone, used by PDF rendering in `lib/pdf-pages.ts`
- `/api/pipeline/align` → `/api/align` — endpoint gone, used by corner detection in `use-upload-notice.ts`
- `/api/pipeline/qa` → `/api/qa` — endpoint gone, used by LensBot in `app/dashboard/lensbot/page.tsx`
- `/api/pipeline/models` → `/api/models` — endpoint gone, used by model picker in `hooks/use-models.ts`

### Verification
- `bun run typecheck` passed with zero errors.
- `bun run lint` passed (only pre-existing warnings in unrelated files).

# Delivery Steps

### ✓ Step 1: Add notice Drizzle schema and push to SQLite
Create the notices table schema and apply it to the database.
- Create `lib/notice-schema.ts` with a Drizzle `sqliteTable` for `notice` mirroring the `NoticeRecord` interface (id as integer autoincrement, title, issuing_office, date_of_issue, category, deadline, event_date_and_time, venue, departments, batches as JSON text, required_action, fees, contact, notice_no, notice_summary_bn, notice_summary_en, raw_text, source_type, file_name, status, created_at, published_at, published_by, review_notes, version). Use the same patterns as `auth-schema.ts` (sqlite-core, integer with timestamp_ms mode, text columns, indexes on status and category).
- Export the new schema from `schemas/index.ts` alongside the auth schema.
- Run `bun run db:push` to create the table in `mydb.sqlite`.

### ✓ Step 2: Rewrite backend-server.ts to use Drizzle instead of HTTP
Replace all HTTP-based functions with local Drizzle queries.
- Import `db` from `db/index.ts` and the `notice` table from the new schema.
- Rewrite `listNotices(filters)` to use `db.select().from(notice)` with `and()`/`eq()`/`like()` clauses for status, category, department, batch, and search_query filters, plus `limit()` and `offset()`.
- Rewrite `getNotice(id)` to `db.select().from(notice).where(eq(notice.id, id)).limit(1)`.
- Rewrite `createNotice(record)` to `db.insert(notice).values(...)` and return the inserted id.
- Rewrite `publishNotice(id, publishedBy)` to `db.update(notice).set({ status: 'published', publishedBy, publishedAt: new Date() }).where(eq(notice.id, id))`.
- Rewrite `updateNotice(id, patch)` to `db.update(notice).set(patch).where(eq(notice.id, id))`.
- Rewrite `deleteNotice(id)` to `db.delete(notice).where(eq(notice.id, id))`.
- Replace `listDepartments()` with a hardcoded array of common Pundra departments (CSE, ECE, BBA, etc.) since no departments table exists — matches the current API contract.
- Replace `listCategories()` with a hardcoded array derived from `NoticeCategory` type.
- Replace `getHealth()` to return a static health object (no backend to check for notices).
- Keep `BACKEND_URL` and `API_KEY` constants and the `request()` helper for the OCR pipeline routes that still need them.
- Keep `BackendError` class for compatibility with `getNotice()` which catches it.

### ✓ Step 3: Verify with typecheck and lint
Validate the changes compile and pass linting.
- Run `bun run typecheck` to ensure no TypeScript errors.
- Run `bun run lint` to ensure no lint issues.
- Confirm the dashboard page no longer throws the 404 error when `listNotices()` is called (it will return an empty array since the table is fresh).
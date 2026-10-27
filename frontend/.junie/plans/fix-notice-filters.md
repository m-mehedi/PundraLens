---
sessionId: session-261027-051813-11k7
---

# Requirements

### Overview
Fix the department filter on the Notices page so it only shows notices matching the selected department, set the default department to the logged-in user's department, and add a batch filter that defaults to the user's batch.

### User Stories
1. As a student, when I open the Notices page, the department filter should default to my department so I see relevant notices first.
2. As a student, when I select a department, only notices that include that department should be shown (not notices for other departments like CSE).
3. As a student, the batch filter should default to my batch number so I see batch-specific notices.
4. As a student, I can filter notices by a specific batch number.

### Functional Requirements
- **Department filter default**: The department selector should default to the logged-in user's department (mapped from the user's department name to the department code).
- **Department filter exact match**: Selecting a department (e.g. "EEE") should only show notices where that department code appears in the comma-separated `departments` field — not notices for other departments.
- **Batch filter**: A new batch selector should be added to the filters bar.
- **Batch filter default**: The batch selector should default to the logged-in user's batch number.
- **Staff/Admin behavior**: If the user has no department or batch (e.g. staff/admin), the filters default to "All".

### Scope
**In Scope:**
- `app/dashboard/notices/page.tsx` — pass user's department/batch as defaults, pass batch filter to `listNotices`
- `components/dashboard/notice-filters.tsx` — accept default props, add batch selector
- `lib/backend-server.ts` — fix department filter to use exact code matching instead of substring `ilike`

**Out of Scope:**
- Changing how departments are stored in the database
- Changing the notice upload/edit forms

# Technical Design

### Current Implementation
- **`app/dashboard/notices/page.tsx`**: Reads `department` from URL search params, passes it to `listNotices()`. No batch filter is passed. No default department/batch from the user's session.
- **`components/dashboard/notice-filters.tsx`**: Client component with department, category, and search filters. Department defaults to `"all"`. No batch filter. No props for default values.
- **`lib/backend-server.ts`**: `listNotices` already supports `batch` in `NoticeFilters` interface (line 128) and the query (line 151-152). Department filter uses `ilike(notice.departments, '%${department}%')` (line 149) — substring match on comma-separated codes.

### Key Decisions
- **Department exact matching**: Replace `ilike('%CSE%')` with a pattern that matches the exact code in a comma-separated list. A notice with `departments = "CSE,EEE"` should match "CSE" and "EEE" but not "CVIL". The approach: match the code as a standalone token — start-of-string, end-of-string, or surrounded by commas. SQL: `(departments = $1 OR departments LIKE $2 OR departments LIKE $3 OR departments LIKE $4)` where `$1 = 'CSE'`, `$2 = 'CSE,%'`, `$3 = '%,CSE'`, `$4 = '%,CSE,%'`.
- **Department name → code mapping**: The user's `department` field stores the full name (e.g. "Computer Science & Engineering"). The page will call `listDepartments()` to find the matching code (e.g. "CSE") and pass it as the default.
- **Batch as string**: The user's `batch` is stored as a string (e.g. "29"). The backend `batch` filter casts the JSONB `batches` array to text and does `ilike`, so passing the batch as a string works.
- **Defaults via props**: `NoticeFilters` will accept `defaultDepartment` and `defaultBatch` props. The page computes these from the session and passes them down.

### Proposed Changes

#### 1. `lib/backend-server.ts` — Fix department filter to exact match
- Replace `ilike(notice.departments, '%${department}%')` with an `or` condition that matches the department code as a standalone token in the comma-separated string:
  ```ts
  if (department) {
    conditions.push(
      or(
        eq(notice.departments, department),
        sql`${notice.departments} LIKE ${department + ',%'}`,
        sql`${notice.departments} LIKE ${'%, ' + department}`,
        sql`${notice.departments} LIKE ${'%, ' + department + ',%'}`,
        sql`${notice.departments} LIKE ${'%' + department + ',%'}`,
      )
    )
  }
  ```
  This ensures "CSE" matches "CSE", "CSE,EEE", "EEE,CSE", and "EEE,CSE,PH" but not "CVIL".

#### 2. `app/dashboard/notices/page.tsx` — Pass user defaults and batch filter
- Extract user's department name and batch from `session.user` (following the pattern in `app/dashboard/page.tsx`).
- Map department name to code using `listDepartments()`.
- Parse batch to a string.
- Read `batch` from URL search params.
- Pass `batch` to `listNotices()`.
- Pass `defaultDepartment` (code) and `defaultBatch` (string) to `NoticeFilters`.

#### 3. `components/dashboard/notice-filters.tsx` — Add batch selector + defaults
- Accept `defaultDepartment` and `defaultBatch` props.
- When no URL param is present, use the default value instead of `"all"`.
- Add a batch `Select` dropdown. Since batches are free-form numbers, the options will be derived from the departments list (no — batches are user-specific). The batch selector will show the user's batch as the default, plus an "All batches" option. For simplicity, it will be a text input or a select with "All batches" and the user's batch. 
- Actually, to keep it simple and consistent with the department filter pattern: a `Select` with "All batches" as the default option, and the value defaults to the user's batch number. Since we don't have a predefined list of batches, the selector will show the default batch value and "All batches".

Wait — a Select needs predefined options. Since batches are arbitrary numbers (25, 26, 27, 28, 29, etc.), I'll use a different approach:
- The page queries distinct batches from the notices table and passes them to `NoticeFilters`.
- Or simpler: the batch filter is a text input where the user types their batch, defaulting to their batch.

**Revised approach**: The page will fetch distinct batch numbers from published notices (via a new `listDistinctBatches` helper or by passing the full notices list). Then `NoticeFilters` renders a `Select` with those batch numbers + "All batches". Default is the user's batch.

Actually, the simplest approach that matches the existing pattern: add a `listBatches` query to `backend-server.ts` that returns distinct batch numbers from the notices table. The page fetches this and passes it to `NoticeFilters`.

### File Structure
- **Modified:**
  - `lib/backend-server.ts` — fix department filter, add `listDistinctBatches`
  - `app/dashboard/notices/page.tsx` — pass user defaults, batch filter, fetch batches
  - `components/dashboard/notice-filters.tsx` — accept defaults, add batch selector

# Delivery Steps

### ✓ Step 1: Fix department filter exact matching in backend
Replace the substring `ilike` department filter with exact code matching in `lib/backend-server.ts`, and add a `listDistinctBatches` helper.
- Replace `ilike(notice.departments, '%${department}%')` with an `or` condition matching the department code as a standalone token (exact match, start, middle, end of comma-separated string).
- Add `export async function listDistinctBatches(): Promise<number[]>` that returns distinct batch numbers from the `notice` table (published notices only).

### ✓ Step 2: Add batch selector and defaults to NoticeFilters component
Update `components/dashboard/notice-filters.tsx` to accept default values and add a batch filter.
- Accept `defaultDepartment`, `defaultBatch`, and `batches` props.
- When no URL param is present for department/batch, use the provided default instead of "all".
- Add a batch `Select` dropdown with "All batches" option and the distinct batch numbers from the `batches` prop.
- Default the batch selector to `defaultBatch` when no URL param is set.

### ✓ Step 3: Wire user defaults and batch filter in Notices page
Update `app/dashboard/notices/page.tsx` to read user's department/batch from session and pass them as defaults.
- Extract `session.user.department` (full name) and `session.user.batch` (string) following the pattern in `app/dashboard/page.tsx`.
- Map department name to code using `listDepartments()`.
- Read `batch` from URL search params and pass it to `listNotices()`.
- Fetch distinct batches via `listDistinctBatches()` and pass to `NoticeFilters`.
- Pass `defaultDepartment` (code) and `defaultBatch` (string) to `NoticeFilters`.
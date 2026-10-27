---
sessionId: session-261027-060344-1isz
---

# Technical Design

### Overview
The notice detail page (`/dashboard/notices/[id]`) has two issues:
1. When `departments` is set to `"all"`, the department field is hidden entirely instead of showing "All departments".
2. When `batches` contains `-1` (meaning "all batches"), it renders a badge with the literal text `-1` instead of "All batches".

### Current Implementation
In `app/dashboard/notices/[id]/page.tsx`:
- **Departments** (lines 67-70): `departments` is set to `null` when `notice.departments === "all"`, so the `DetailItem` for departments is never rendered.
- **Batches** (lines 176-186): Each batch number is rendered as a Badge with `{batch}` directly, so `-1` shows as `-1`.

The audience controls component (`components/upload-notice/audience-controls.tsx`) already handles both cases correctly:
- `batch === -1 ? "All batches" : String(batch)` (line 126)
- `code === "all" ? "All departments" : code` (line 48)

### Proposed Changes
In `app/dashboard/notices/[id]/page.tsx`:
1. Change `departments` to show `"All departments"` when `notice.departments === "all"` instead of `null`.
2. Map `-1` to `"All batches"` in the batch Badge rendering, matching the pattern from `audience-controls.tsx`.

# Delivery Steps

### ✓ Step 1: Fix department and batches display in notice detail page
Update `app/dashboard/notices/[id]/page.tsx` to:
- **Show department when it's "all"**: Change the `departments` variable so that when `notice.departments === "all"`, it renders as the string `"All departments"` instead of `null`, so the Department detail item always appears.
- **Fix batches display for -1**: Update the batches rendering block (lines 176-186) to map `-1` to `"All batches"` in each Badge, matching the pattern already used in `components/upload-notice/audience-controls.tsx`.
- Keep the `hasDetails` check consistent so the details section still appears when batches is `[-1]` or departments is "all".
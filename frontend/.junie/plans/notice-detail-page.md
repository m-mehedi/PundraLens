---
sessionId: session-261025-210105-o651
---

# Requirements

### Overview
When a user clicks on a notice card in the notices list (`/dashboard/notices`), it should open a dedicated detail page showing all the notice's content.

### Functional Requirements
- Clicking a notice card navigates to a detail page at `/dashboard/notices/[id]`
- The detail page displays all available fields of the notice (title, summaries, metadata, etc.)
- The page requires authentication (any role can view)
- If the notice doesn't exist, show a 404 page

### Out of Scope
- Editing notices from the detail page (that's handled by the manage-notice flow)
- Comments or reactions on notices

# Technical Design

### Current Implementation
- `app/dashboard/notices/page.tsx` — server page listing notices via `NoticeList` component
- `components/dashboard/notice-list.tsx` — renders notice cards in a grid (not clickable)
- `lib/backend-server.ts` — `getNotice(id)` function already exists for fetching single notices
- `lib/notice-types.ts` — `NoticeRecord` interface with all notice fields
- `app/dashboard/manage-notice/[id]/page.tsx` — existing pattern for a single-notice page (staff-only)

### Proposed Changes
1. **Create `app/dashboard/notices/[id]/page.tsx`** — new server page that:
   - Requires session (any role)
   - Fetches the notice via `getNotice(id)`
   - Renders all fields using existing UI components (Card, Badge, CategoryBadge, etc.)
   - Shows a 404 if the notice is not found

2. **Update `components/dashboard/notice-list.tsx`** — make cards clickable:
   - Wrap each Card in a `Link` to `/dashboard/notices/[id]`
   - Add hover/cursor styles to indicate clickability

### Components Affected
- `components/dashboard/notice-list.tsx` (modify)
- `app/dashboard/notices/[id]/page.tsx` (create new)

# Delivery Steps

### ✓ Step 1: Create notice detail page
Create a new server page at `app/dashboard/notices/[id]/page.tsx` that fetches and displays all fields of a single notice. This page will be accessible to all authenticated users (no role requirement).

### ✓ Step 2: Make notice cards clickable in NoticeList
Update the `NoticeList` component to wrap each card in a Link to the notice detail page, so clicking a card opens the full notice.
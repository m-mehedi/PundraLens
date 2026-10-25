---
sessionId: session-261022-092538-1mlw
---

# Requirements

### ✓ Step 1: Extract nav items to shared module
### ✓ Step 2: Add dynamic page title and fix header
### ✓ Step 3: Fix getPageName matching order bug
### ✓ Step 4: Remove redundant hero sections from all dashboard pages

### Overview
Remove the redundant hero section (title + description) from every dashboard page. Since the sticky header now displays the page name via `PageTitle`, these sections duplicate information already visible to the user.

### Proposed Changes
Remove the `<div>` containing `<h1>` and `<p>` description from each page:

1. **`app/dashboard/page.tsx`** — Remove lines 87–92 (Overview title + description).
2. **`app/dashboard/notices/page.tsx`** — Remove lines 52–58 (Notices title + count description).
3. **`app/dashboard/lensbot/page.tsx`** — Remove lines 321–326 (LensBot title + description). Keep the `gap-6` on the outer wrapper.
4. **`app/dashboard/upload-notice/page.tsx`** — Remove lines 22–28 (Upload Notice title + description).
5. **`app/dashboard/manage-notice/page.tsx`** — Remove lines 63–68 (Manage Notice title + description).
6. **`app/dashboard/manage-students/page.tsx`** — Remove lines 33–38 (Manage Students title + description).
7. **`app/dashboard/manage-staffs/page.tsx`** — Remove lines 33–38 (Manage Staff title + description).
8. **`app/dashboard/manage-revoked/page.tsx`** — Remove lines 33–40 (Manage Revoked title + description).
9. **`app/dashboard/manage-notice/[id]/page.tsx`** — Remove lines 46–65 (back button, title with badge, and description). This page is slightly different with a back button and notice-specific info, but the title is redundant with the header.

All pages will retain their outer `<div className="flex flex-col gap-6">` wrapper and the remaining content (cards, tables, forms, etc.).

### Overview
Three small UX fixes for the dashboard layout header in `app/dashboard/layout.tsx`:

1. **Sticky header** — the `<header>` container should stick to the top when scrolling.
2. **Dynamic page title** — replace the hardcoded "Dashboard" text with the current page name (e.g. "Overview", "Notices", "LensBot", etc.).
3. **Remove LLM model chip** — remove the `LLMStatusChip` component from the header.

### Bug Fix: Page title always shows "Overview"
All dashboard subroutes (e.g. `/dashboard/manage-staffs`, `/dashboard/notices`) display "Overview" instead of the correct page name because `getPageName()` in `lib/dashboard-nav.ts` uses `Array.find()` which returns the first match. Since `/dashboard` (Overview) is the first item and every subroute starts with `/dashboard/`, "Overview" always wins.

### Proposed Changes
- Add `sticky top-0 z-50 bg-background` (or similar) classes to the `<header>` element.
- Create a small client component that uses `usePathname()` to resolve the current page name from the sidebar navigation item mappings, and render it in the header.
- Remove the `<LLMStatusChip />` and its import from the layout.
- Fix `getPageName()` to sort items by URL length descending so more specific routes match before shorter parent routes.


# Technical Design

### Current Implementation
- `app/dashboard/layout.tsx` is a Server Component that renders a `<header>` with a hardcoded `<h2>Dashboard</h2>` and `<LLMStatusChip />` on the right.
- `components/dashboard/sidebar-nav.tsx` defines navigation items (`navItems`, `adminItems`, `adminOnlyItems`) with `name` and `url` properties — these are the source of truth for page names.

### Key Decisions
- Extract the navigation item arrays into a shared module (`lib/dashboard-nav.ts`) so both the sidebar and the header can resolve page names from the same data.
- Use a lightweight client component (`components/dashboard/page-title.tsx`) with `usePathname()` to match the current path against the navigation items and render the matching name. Falls back to "Dashboard" for unknown routes.

### Proposed Changes

**1. `lib/dashboard-nav.ts`** — new shared module
- Export `navItems`, `adminItems`, `adminOnlyItems` arrays from `sidebar-nav.tsx` here.
- Export a `getPageName(pathname)` helper that returns the matching name.

**2. `components/dashboard/sidebar-nav.tsx`** — modify
- Import nav item arrays from `lib/dashboard-nav.ts` instead of defining them locally.

**3. `components/dashboard/page-title.tsx`** — new client component
- Uses `usePathname()` + `getPageName()` to render the current page name.

**4. `app/dashboard/layout.tsx`** — modify
- Add `sticky top-0 z-50 bg-background` classes to the `<header>`.
- Replace `<h2>Dashboard</h2>` with `<PageTitle />`.
- Remove `<LLMStatusChip />` and its import.
- Remove unused `LLMStatusChip` import.

**5. `lib/dashboard-nav.ts`** — fix `getPageName()` matching order (bug fix)
- Sort all items by URL length descending before `find()` so longer (more specific) routes like `/dashboard/manage-staffs` match before shorter parent routes like `/dashboard`.
- This ensures `/dashboard/notices` matches "Notices" instead of "Overview".

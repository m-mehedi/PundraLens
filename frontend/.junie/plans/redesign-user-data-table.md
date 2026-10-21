---
sessionId: session-261021-124723-165a
---

# Requirements

### Overview
Simplify `components/dashboard/user-data-table.tsx` by removing unnecessary visual elements and focusing on what matters: the user identity and the action they can take.

### What's Changing
- **Removed**: CardHeader with title and user count — redundant when the table speaks for itself.
- **Removed**: Role column — no clear decision-making value in this context.
- **Removed**: Email from the identity cell — it's a data-layer detail, not a display concern.
- **Fixed**: Actions button alignment — left-aligned to match the Actions header, not centered or right-aligned.
- **Simplified**: Identity cell now shows only Avatar and name, without secondary email text.

### Column Decisions
- **Kept**: Name (Avatar + name only), Actions. Two columns is minimal and scannable.
- **Dropped**: Email (data layer only), Role (no purpose stated).

### Out of Scope
- Search, sorting, or pagination.
- New columns or features.
- Changes to props, types, server actions, or form field names.

# Technical Design

### Current Implementation
`components/dashboard/user-data-table.tsx` currently renders a Card with CardHeader (title + count), CardContent with a Table of 3 columns (Name with Avatar+email, Role as Badge, Actions). The actions cell uses `flex justify-end` to right-align buttons.

### Proposed Changes

**File**: `components/dashboard/user-data-table.tsx` (modify in place)

1. **Remove CardHeader entirely** — drop the title and count description. The Card becomes a clean container with just the table.
2. **Remove Role column** — delete the `TableHead` and `TableCell` for Role. Remove the `roleBadgeVariants` mapping and Badge import.
3. **Simplify identity cell** — keep Avatar with initials and the name only. Remove the email `<p>` tag and the wrapper `div` around name+email.
4. **Left-align actions** — change the actions `TableCell` from `flex justify-end` to natural left flow. Left-align the Actions `TableHead`.
5. **Simplify `getInitials`** — use name only, remove email fallback parameter.
6. **Clean up imports** — remove Badge import.

### Key Decisions
- **No header**: The table is self-explanatory; the title and count add noise without adding value.
- **Name-only identity**: Email belongs to the data layer. Users recognize names and avatars.
- **Left-aligned actions**: Matches the Actions header alignment and feels more natural than right-aligned buttons in a left-aligned table.
- **Two columns**: Minimal and focused. Name + Action is all that's needed.

# Delivery Steps

### ✓ Step 1: Redesign user-data-table.tsx with professional SaaS styling
Already completed in the previous iteration.

### ✓ Step 2: Simplify the component by removing unnecessary elements
Clean up `components/dashboard/user-data-table.tsx`:

- Remove CardHeader (title, description, count text) entirely
- Remove the Role column: delete `TableHead`, `TableCell`, Badge usage, and `roleBadgeVariants`
- Remove Badge import
- Simplify the identity cell: keep Avatar with initials from name only, show name in `font-medium`, remove the email secondary text
- Update `getInitials` to use name only (remove email fallback)
- Left-align the Actions button: remove `flex justify-end`, use natural left flow
- Left-align the Actions `TableHead` to match the button alignment
- Keep Card wrapper, Table structure, AlertDialog for revoke, and Empty state intact
- Preserve all existing props, types, server actions, and form field names

### ✓ Step 3: Add Checkbox component and bulk server actions
- Install shadcn Checkbox component via `npx shadcn@latest add checkbox`
- Add `bulkRevokeUsers(formData)` server action to `lib/user-actions.ts` — reads `userIds` via `formData.getAll()`, loops through IDs setting role to `revoked` and revoking sessions
- Add `bulkRestoreUsers(formData)` server action to `lib/user-actions.ts` — reads `userIds` via `formData.getAll()`, loops through IDs restoring original role

### ✓ Step 4: Create client wrapper with search and selection state
- Create `components/dashboard/user-data-table-client.tsx` as a `"use client"` component
- Search input filters users by `id` (case-insensitive substring) or `name` (case-insensitive substring)
- Selection state tracks selected user IDs via `Set<string>`
- Passes filtered users and selection callbacks to `UserDataTable`

### ✓ Step 5: Update UserDataTable with selection support
- Add optional `selectedIds`, `onToggleSelect`, `onSelectAll`, `allSelected`, `someSelected`, `selectedCount`, `bulkAction`, and `actionLabel` props
- Add Checkbox column (first column) with row checkboxes and header checkbox for select-all
- Bulk action bar appears above table header when items are selected, showing count and bulk action button with AlertDialog confirmation
- Checkbox column and bulk bar only render when selection props are provided (backward compatible)
- Make `title` prop optional

### ✓ Step 6: Update caller pages to use client wrapper
- `app/dashboard/manage-staffs/page.tsx` — import `UserDataTableClient` and `bulkRevokeUsers`
- `app/dashboard/manage-students/page.tsx` — import `UserDataTableClient` and `bulkRevokeUsers`
- `app/dashboard/manage-revoked/page.tsx` — import `UserDataTableClient` and `bulkRestoreUsers`
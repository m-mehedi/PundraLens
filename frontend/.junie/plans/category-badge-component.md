---
sessionId: session-261022-093854-b9yi
---

# Requirements

### Overview
Replace the ad-hoc category rendering across the app with a single reusable CategoryBadge component that displays each of the 8 notice categories with an appropriate Hugeicons icon.

### In Scope
- Create a new CategoryBadge component that renders a category with its icon and display name
- Use the component in notice-filters.tsx, notice-list.tsx, notice-table.tsx, notice-edit-form.tsx, and notice-form.tsx
- Categories fixed to: exam, registration, fee, holiday, event, scholarship, result, general

### Out of Scope
- Changing the backend category API or data model
- Adding new categories beyond the 8 defined

# Technical Design

### Current State
Categories are rendered inconsistently:
- `notice-list.tsx` has a local CATEGORY_LABELS map and categoryLabel() helper, renders as Badge with text only
- `notice-table.tsx` imports categoryLabel from notice-list (bad cross-component dependency)
- `notice-filters.tsx` uses backend Category[] with emoji icon strings in SelectItem
- `notice-edit-form.tsx` has a local CATEGORIES string array, renders raw strings
- `notice-form.tsx` (upload) uses backend categories with CATEGORY_LABELS fallback from field-meta.ts

The NoticeCategory type in lib/notice-types.ts already defines the 8 categories. The project uses @hugeicons/react for icons.

### Design
- New file `components/dashboard/category-badge.tsx` with:
  - CATEGORY_ICONS map: each category → {label, IconComponent}
  - CategoryBadge component: renders a Badge with HugeiconsIcon + label
  - ALL_CATEGORIES array: for use in Select dropdowns
- Icon choices: exam→Document02Icon, registration→UserPlus02Icon, fee→MoneyCoinIcon, holiday→Calendar01Icon, event→PartyPopperIcon, scholarship→MedalFirstPlaceIcon, result→ChartSquareIcon, general→BellIcon

### Changes
- `notice-filters.tsx`: use ALL_CATEGORIES instead of backend categories, render icon in SelectItem
- `notice-list.tsx`: use CategoryBadge, remove CATEGORY_LABELS and categoryLabel export
- `notice-table.tsx`: import CategoryBadge instead of categoryLabel from notice-list
- `notice-edit-form.tsx`: use ALL_CATEGORIES with icon+label in SelectItem
- `notice-form.tsx`: use ALL_CATEGORIES for selector items
- `field-meta.ts`: keep CATEGORY_LABELS as-is (other code may depend on it), no changes needed

# Delivery Steps

### ✓ Step 1: Create CategoryBadge component
Create components/dashboard/category-badge.tsx with icon mapping, badge component, and category list.
- Define CATEGORY_ICONS mapping each of the 8 categories to a display label and a Hugeicons icon
- Export CategoryBadge component that renders a Badge with the icon and label for a given NoticeCategory
- Export ALL_CATEGORIES array with {value, label, Icon} entries for selectors

### ✓ Step 2: Update notice-filters, notice-list, and notice-table
Replace category rendering in the filters dropdown, notice cards, and management table.
- notice-filters.tsx: use ALL_CATEGORIES instead of backend categories, render HugeiconsIcon in each SelectItem
- notice-list.tsx: use CategoryBadge instead of Badge with categoryLabel, remove local CATEGORY_LABELS and categoryLabel export
- notice-table.tsx: import CategoryBadge from category-badge instead of categoryLabel from notice-list

### ✓ Step 3: Update edit form and upload form
Replace category rendering in the edit and upload notice forms.
- notice-edit-form.tsx: replace the local CATEGORIES string array with ALL_CATEGORIES, render icon+label in SelectItem
- notice-form.tsx: use ALL_CATEGORIES for building category selector items instead of the backend-driven list
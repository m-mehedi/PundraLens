---
sessionId: session-261023-200819-1j1t
---

# Requirements

### Overview
The Departments and Batches fields in the notice form are plain text inputs where users type comma-separated values. They need to be replaced with proper interactive controls:
- **Departments**: A multi-select Combobox where users can search and select multiple departments from the official list.
- **Batches**: A chips input where users type batch numbers and press Enter to add them as removable chips. A special "All batches" chip represents `-1`.

### Backend Contract
From `backend/core/schema.py`:
- **Departments**: Comma-separated string of codes: `BBA, CSE, EEE, CVIL, PH, IS, ENG, LAW, BAN, DS, JMS`. Use `"all"` for all departments.
- **Batches**: `List[int]` — e.g. `[13, 14, 15]`. Use `[-1]` to mean all batches.

### Current Problems
1. The frontend departments list in `backend-server.ts` (`CSE, ECE, EEE, ME, CE, BBA, BSS, LLB, MBA, MSS, MCA`) **does not match** the backend schema (`BBA, CSE, EEE, CVIL, PH, IS, ENG, LAW, BAN, DS, JMS`).
2. Users type free-form text for departments — no validation against the official codes.
3. Batches are typed as comma-separated text — error-prone and no visual feedback.
4. The `matchDepartment()` function in `use-notice-form.ts` tries to match names to codes but works on a single department, not a comma-separated list.

### Scope
**In Scope**:
- Align the frontend departments list with the backend schema.
- Replace the departments `Input` with a multi-select `Combobox` using `ComboboxChips`.
- Replace the batches `Input` with a chips input using `ComboboxChips` with integer entry.
- Update `NoticeFormValues` to store departments as `string[]` and batches as `number[]`.
- Update `use-notice-form.ts` to handle array types.
- Update `toSaveInput()` to serialize arrays back to the backend format.

**Out of Scope**:
- Backend changes.
- Changes to other form fields.
- The save/publish flow (unchanged).

# Technical Design

### Current Implementation

**`NoticeFormValues`** (`types.ts`): `departments: string` and `batches: string` — both stored as comma-separated strings.

**`notice-form.tsx`**: Both fields use plain `Input` with `onChange` setting the string value.

**`use-notice-form.ts`**:
- `valuesFromResult()`: Maps `result.departments` (string) through `matchDepartment()` which handles a single department. Maps `result.batches` (number[]) to `join(",")` string.
- `toSaveInput()`: Parses `values.batches` string by splitting on `,` and converting to numbers.
- `matchDepartment()`: Matches a single department name/code against the department list.

**`backend-server.ts`**: `listDepartments()` returns a hardcoded list that differs from the backend schema.

### Key Decisions

1. **Use `ComboboxChips` for both fields**: The newly installed `combobox.tsx` provides `ComboboxChips`, `ComboboxChip`, and `ComboboxChipsInput` — built-in multi-select with chips. This is the shadcn-recommended approach.

2. **Change `NoticeFormValues` to use arrays**: `departments: string[]` and `batches: number[]` instead of comma-separated strings. This eliminates parsing errors and makes the form state type-safe.

3. **Align departments list with backend schema**: Replace the hardcoded list in `backend-server.ts` with the official codes from `schema.py`: `BBA, CSE, EEE, CVIL, PH, IS, ENG, LAW, BAN, DS, JMS`.

4. **"All" special values**: Departments: `"all"` in the array means all departments. Batches: `-1` in the array means all batches. When "all" is selected, no other items can be added (mutual exclusion).

5. **Keep `Combobox` for departments with filtering**: Users can type to filter the 11 departments. Each selected department appears as a `ComboboxChip` with a remove button.

6. **Free-form integer entry for batches**: Users type a number and press Enter to add it as a chip. A special "All batches" option adds `-1`. The `ComboboxChipsInput` handles the input part; we'll add items on Enter.

### Proposed Changes

#### `backend-server.ts`
- Replace `listDepartments()` with the backend schema departments:
  ```ts
  export async function listDepartments(): Promise<Department[]> {
    return [
      { code: "BBA", name: "Bachelor of Business Administration" },
      { code: "CSE", name: "Computer Science & Engineering" },
      { code: "EEE", name: "Electrical & Electronic Engineering" },
      { code: "CVIL", name: "Civil Engineering" },
      { code: "PH", name: "Physics" },
      { code: "IS", name: "Information Science" },
      { code: "ENG", name: "English" },
      { code: "LAW", name: "Law" },
      { code: "BAN", name: "Bangla" },
      { code: "DS", name: "Data Science" },
      { code: "JMS", name: "Journalism & Mass Communication" },
    ]
  }
  ```

#### `types.ts`
- Change `NoticeFormValues`:
  ```ts
  export interface NoticeFormValues {
    // ... other fields unchanged
    departments: string[]   // was string
    batches: number[]       // was string
  }
  ```

#### `use-notice-form.ts`
- `valuesFromResult()`: Parse `result.departments` (comma-separated string) into `string[]`. Handle `"all"` as `["all"]`. Use `result.batches` directly as `number[]`.
- `matchDepartment()`: Update to handle comma-separated input and return `string[]`.
- `toSaveInput()`: Join `values.departments` to comma-separated string. Use `values.batches` directly as `number[] | null`.

#### `notice-form.tsx`
- **Departments field**: Replace `Input` with `Combobox` using `ComboboxChips`, `ComboboxChip`, `ComboboxChipsInput`, and `ComboboxContent` with `ComboboxItem` for each department. Show department code as primary text with full name as description.
- **Batches field**: Replace `Input` with `Combobox` using `ComboboxChips` for integer entry. Users type a number and press Enter to add. Show a special "All batches" option in the dropdown. Chips display the batch number or "All batches" for `-1`.

#### Architecture Diagram

``` mermaid
graph LR
  A[notice-form.tsx] -->|departments: string[]| B[Combobox multi-select]
  A -->|batches: number[]| C[Combobox chips input]
  B -->|selected codes| D[use-notice-form.ts]
  C -->|batch numbers| D
  D -->|serialize| E[toSaveInput]
  E -->|departments: string| F[SaveNoticeInput]
  E -->|batches: number[]| F
```

### Risks
- **Department name changes**: The full names for departments (e.g., "CVIL" → "Civil Engineering") are inferred from common abbreviations. If the actual department names differ, they should be corrected.
- **Backward compatibility**: Existing notices in the database store departments as comma-separated strings and batches as JSON arrays. The `toSaveInput()` serialization remains unchanged, so existing data is unaffected.

# Delivery Steps

### ✓ Step 1: Update types and form mapping
Replace `ExtractResult` with a flat type matching the new `ExtractionSchema`, then update `use-notice-form.ts` to map from the flat structure.
- In `types.ts`: replace `ExtractResult` interface with a flat 15-field type matching `ExtractionSchema` (title, issuing_office, date_of_issue, category, deadline, event_date_and_time, venue, departments, batches, required_action, fees, contact, notice_no, notice_summary_bn, notice_summary_en)
- In `use-notice-form.ts`: update `valuesFromResult()` to read from flat `ExtractResult` instead of `result.data` (e.g. `result?.title` instead of `data?.title`)
- Run `bun run typecheck` to surface all downstream breakage

### ✓ Step 2: Fix extraction calls in use-upload-notice.ts
Update the two extraction functions to match the new API contract and remove all references to deleted metadata fields.
- In `readDocument()`: remove `model` from FormData, parse response as flat `ExtractResult` instead of casting to `{ success, data }`
- In `readText()`: change `plain_text` to `text`, remove `model`, parse as flat `ExtractResult`
- In `extractText()`: remove references to `result.data.raw_text`, `result.data.file_name`, `result.data.source_type` when building `ItemResult`
- Run `bun run typecheck` to verify

### ✓ Step 3: Simplify extract-panel.tsx and notice-sheet.tsx
Remove all UI that depended on deleted metadata fields from the extraction response.
- In `extract-panel.tsx`: remove `previewImageSrc` computation, remove `ocr_unavailable` alert, remove `pages_read < page_count` alert, remove `potential_duplicates` alert, pass `null` for `rawText` and `previewImageSrc` to `NoticeSheet`, remove `raw_text`, `file_name`, `source_type` from `toSaveInput` call in `SaveNoticePanel`
- In `notice-sheet.tsx`: the component already handles `rawText` being null (the disclosure simply doesn't render) and `previewImageSrc` being null (falls back to `sourceUrl`), no structural changes needed
- Run `bun run typecheck` and `bun run lint` to verify

### ✓ Step 4: Align departments list and update types
Sync the frontend departments with the backend schema and change `NoticeFormValues` to use arrays.
- In `backend-server.ts`: replace `listDepartments()` with the backend schema departments (BBA, CSE, EEE, CVIL, PH, IS, ENG, LAW, BAN, DS, JMS)
- In `types.ts`: change `NoticeFormValues.departments` from `string` to `string[]` and `batches` from `string` to `number[]`
- Run `bun run typecheck` to surface downstream breakage

### ✓ Step 5: Update form mapping for array types
Update `use-notice-form.ts` to handle array types for departments and batches.
- In `valuesFromResult()`: parse `result.departments` (comma-separated string) into `string[]`, handling `"all"` as `["all"]`. Use `result.batches` directly as `number[]`.
- In `matchDepartment()`: update to handle comma-separated input and return `string[]`.
- In `toSaveInput()`: join `values.departments` to comma-separated string. Use `values.batches` directly as `number[] | null`.
- Run `bun run typecheck` to verify

### ✓ Step 6: Build departments multi-select combobox
Replace the departments text input with a multi-select Combobox in `notice-form.tsx`.
- Import `Combobox`, `ComboboxChips`, `ComboboxChip`, `ComboboxChipsInput`, `ComboboxContent`, `ComboboxList`, `ComboboxItem`, `ComboboxGroup`, `ComboboxEmpty` from `@/components/ui/combobox`
- Replace the departments `Input` with a `Combobox` that uses `ComboboxChips` as the trigger, showing selected departments as removable `ComboboxChip` elements
- The dropdown (`ComboboxContent`) lists all departments with code as value and full name as label
- Filter departments based on input text
- Handle "all" as a special option that clears other selections
- Run `bun run typecheck` to verify

### ✓ Step 7: Build batches chips input
Replace the batches text input with a chips-based Combobox in `notice-form.tsx`.
- Use `Combobox` with `ComboboxChips` as the trigger, showing selected batches as removable `ComboboxChip` elements
- Users type a number in `ComboboxChipsInput` and press Enter to add it as a chip
- A special "All batches" option in the dropdown adds `-1` to the array
- When "All batches" is selected, other batches are cleared (mutual exclusion)
- Chips display the batch number or "All batches" for `-1`
- Run `bun run typecheck` and `bun run lint` to verify

### ✓ Step 8: Update manage notice edit form
Apply the same departments and batches controls to `notice-edit-form.tsx` so the manage-notice page uses the same interactive controls.
- In `notice-edit-form.tsx`: replace the departments and batches `Input` fields with the same `DepartmentCombobox` and `BatchCombobox` components from `notice-form.tsx`
- Change the local state for departments from `string` to `string[]` and batches from `string` to `number[]`
- Update `handleSave` to serialize arrays back to the backend format
- Fetch the department list and pass it to the combobox
- Run `bun run typecheck` and `bun run lint` to verify
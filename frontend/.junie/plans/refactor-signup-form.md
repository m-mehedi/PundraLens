---
sessionId: session-261021-102634-1pph
---

# Technical Design

### Current Implementation
`components/signup-form.tsx` is a ~230-line React component with a multi-step signup form (account details + password). It uses `react-hook-form`, shadcn/ui components, and has several code smells.

### Code Smells Identified
1. **Duplicated password toggle UI** — The password visibility toggle (Eye/EyeOff icon + button) is copy-pasted for both `password` and `confirmPassword` fields.
2. **Duplicated error message pattern** — The `{errors.field && <p className="...">{errors.field.message}</p>}` pattern is repeated 6 times.
3. **Long component** — The entire `SignupForm` function is ~230 lines; should be broken down.
4. **Magic strings** — Department list is hardcoded inline; step strings ("account" | "password") are repeated.
5. **Untyped handlers** — `onSubmit` and `onError` use `any` types.
6. **Duplicated state** — `showPassword` and `showConfirmPassword` are separate booleans with identical logic.

### Proposed Changes
Following the refactor skill's principles (behavior preserved, small extractions, type safety):

1. **Extract `PasswordField` component** — Extract the password input with visibility toggle into a reusable component. Eliminates the duplicated toggle UI.
2. **Extract `FieldError` component** — Extract the error message rendering into a small component. Eliminates 6 duplications.
3. **Extract department constants** — Move the department list to a typed constant array outside the component.
4. **Add TypeScript types** — Replace `any` with proper `SignupFormData` interface and typed error handler.
5. **Extract `useSignupForm` hook** — Pull form logic (state, handlers, validation) into a custom hook. Reduces the component to ~50 lines of UI.

### Key Decisions
- Keep all changes in the same file (`signup-form.tsx`) — the component is self-contained and extracting to separate files would over-engineer.
- Preserve all existing behavior: same validation rules, same UI, same step flow.
- Follow the refactor skill's "Extract Method" and "Introducing Type Safety" patterns.

# Delivery Steps

### ✓ Step 1: Extract helper components and constants
Extract duplicated UI patterns into small components and move magic strings to typed constants.
- Create a `PasswordField` component that accepts `label`, `id`, `register` options, and `error` — encapsulates the input + visibility toggle button.
- Create a `FieldError` component that renders `errors?.message` with the destructive styling.
- Extract the department list to a `DEPARTMENTS` constant array with proper typing.
- Replace all 6 inline error message blocks with `<FieldError />`.
- Replace both password fields with `<PasswordField />`.

### ✓ Step 2: Add types and extract form logic hook
Improve type safety and reduce the component size by extracting form logic.
- Define a `SignupFormData` interface with all form fields (student_id, department, batch, semester, password, confirmPassword).
- Replace `any` types in `onSubmit` and `onError` with `SignupFormData` and `FieldErrors`.
- Extract form state and handlers into a `useSignupForm` custom hook that returns `{ form, step, setStep, showPassword, setShowPassword, showConfirmPassword, setShowConfirmPassword, passwordValue, handleNext, onSubmit, onError }`.
- Reduce the `SignupForm` component to a clean UI layer that consumes the hook.
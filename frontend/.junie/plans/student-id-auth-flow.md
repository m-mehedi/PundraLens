---
sessionId: session-261021-105628-1h5f
---

# Requirements

### Overview
Fix the `bun:sqlite` module error that crashes the auth API routes, and add toast notifications so users see visual feedback when signing in or signing up.

### Scope

**In Scope:**
- Replace `bun:sqlite` with `better-sqlite3` in `db/index.ts` so the database works in Next.js server routes.
- Install and configure `sonner` toast library for success/error notifications.
- Add toast calls to both login and signup forms on success and error.

**Out of Scope:**
- Navigation after successful login/signup.
- Password reset flow.
- Email verification.

### Functional Requirements
1. **Auth endpoints work** — The `bun:sqlite` module error is resolved; `/api/auth/sign-up/email` and `/api/auth/sign-in/email` no longer crash with a 500 error.
2. **Login toast feedback** — On successful sign in, a success toast appears (e.g., "Logged in successfully"). On error, an error toast appears with the error message.
3. **Signup toast feedback** — On successful sign up, a success toast appears (e.g., "Account created successfully"). On error, an error toast appears.
4. **Inline errors remain** — The existing inline `FieldError` below the submit button is kept for immediate visibility.

# Technical Design

### Current Implementation

| File | Current State |
|------|--------------|
| `db/index.ts` | Uses `bun:sqlite` (`import { Database } from 'bun:sqlite'`) — a Bun-only module that crashes in Next.js server routes. |
| `lib/auth.ts` | Better Auth config with Drizzle adapter pointing to `db/index.ts`. No changes needed. |
| `package.json` | Already has `better-sqlite3` (^13.0.3) and `@types/better-sqlite3` (^9.6.0) as dependencies. |
| `components/login-form.tsx` | Has inline `FieldError` but no toast on success or error. |
| `components/signup-form/use-signup-form.ts` | Has inline `error` state but no toast. |
| `app/layout.tsx` | Root layout with `ThemeProvider`; no toast provider. |

### Root Cause of `bun:sqlite` Error
`bun:sqlite` is a built-in Bun module that only exists when code runs inside the Bun runtime. Next.js server routes run in Node.js (or Turbopack's server environment), which cannot resolve `bun:sqlite`. The project already has `better-sqlite3` installed — a Node.js-compatible SQLite driver — so we just need to switch to it.

### Key Decisions
- **`better-sqlite3` instead of `bun:sqlite`** — it's already installed, works in Node.js/Next.js, and is fully compatible with Drizzle's `better-sqlite3` adapter.
- **`sonner` for toasts** — it's the most lightweight and widely used toast library in the Next.js/shadcn ecosystem. It requires only a `<Toaster />` provider in the layout and `toast()` calls in components.
- **Toasts in addition to inline errors** — inline `FieldError` stays for immediate form-level feedback; toasts provide a non-intrusive notification that doesn't require the user to look at the form.

### Proposed Changes

#### 1. Replace `bun:sqlite` with `better-sqlite3` in `db/index.ts`
- Change `import { drizzle } from 'drizzle-orm/bun-sqlite'` to `import { drizzle } from 'drizzle-orm/better-sqlite3'`.
- Change `import { Database } from 'bun:sqlite'` to `import Database from 'better-sqlite3'`.
- Update `drizzle()` call to use `client: sqlite` (the `better-sqlite3` adapter uses the same `client` key).

#### 2. Install and configure `sonner`
- Run `npm install sonner` to add the dependency.
- Add `<Toaster />` from `sonner` to `app/layout.tsx` inside `<ThemeProvider>`.

#### 3. Add toast notifications to login form
- In `components/login-form.tsx`: import `toast` from `sonner`.
- On successful sign in: `toast.success("Logged in successfully")`.
- On error: `toast.error(err.message || "Failed to sign in")` in addition to the inline `FieldError`.

#### 4. Add toast notifications to signup form
- In `components/signup-form/use-signup-form.ts`: import `toast` from `sonner`.
- On successful sign up: `toast.success("Account created successfully")`.
- On error: `toast.error(err.message || "Failed to create account")` in addition to the inline error state.

# Delivery Steps

### ✓ Step 1: Add studentIdToEmail helper to lib/auth-client.ts
Add the configurable domain constant and helper function to the auth client module.
- Add `STUDENT_EMAIL_DOMAIN` constant (default: `"@student.university.edu"`).
- Add `studentIdToEmail(studentId: string): string` that returns `${studentId}${STUDENT_EMAIL_DOMAIN}`.
- Export both so login and signup components can import them.

### ✓ Step 2: Wire signup form to Better Auth signUp.email()
Update the signup form hook and component to call Better Auth on submit.
- In `use-signup-form.ts`: import `authClient` and `studentIdToEmail`, add `isLoading`/`error` state, replace `onSubmit` to call `authClient.signUp.email({ email: studentIdToEmail(data.student_id), password: data.password, name: data.student_id })`.
- In `index.tsx`: destructure `isLoading` and `error`, disable submit button when loading, display error message.

### ✓ Step 3: Wire login form to Better Auth signIn.email()
Convert the static login form into a functional form connected to Better Auth.
- In `login-form.tsx`: add `useState` for `studentId`, `password`, `isLoading`, `error`.
- Add `onSubmit` handler calling `authClient.signIn.email({ email: studentIdToEmail(studentId), password })`.
- Show loading state on the button and error message below the form.
- Keep existing labels ("Enter your ID") and placeholders intact.

### ✓ Step 4: Fix API route handler filename (auth.ts → route.ts)
Rename the route handler file so Next.js recognizes it, fixing the 404 error.
- Rename `app/api/auth/[...all]/auth.ts` to `app/api/auth/[...all]/route.ts`.
- No content changes needed — the existing `toNextJsHandler(auth)` export is correct.
- After renaming, all Better Auth endpoints (`/api/auth/sign-up/email`, `/api/auth/sign-in/email`, etc.) will be served correctly.

### ✓ Step 5: Improve visual feedback in both forms
Make loading and error states more visible and consistent across both forms.
- In `login-form.tsx`: import `FieldError` from the signup form and use it for error display instead of a plain `<p>` tag.
- In `signup-form/index.tsx`: ensure the `FieldError` below the submit button has adequate spacing (`mt-2`).
- Both forms already show loading text on the button ("Logging in..." / "Creating Account...") and disable the button — keep this behavior.

### ✓ Step 6: Replace bun:sqlite with better-sqlite3 in db/index.ts
Fix the database driver so auth API routes no longer crash with a module-not-found error.
- In `db/index.ts`: replace `import { drizzle } from 'drizzle-orm/bun-sqlite'` with `import { drizzle } from 'drizzle-orm/better-sqlite3'`.
- Replace `import { Database } from 'bun:sqlite'` with `import Database from 'better-sqlite3'`.
- The `drizzle()` call structure remains the same — `drizzle({ client: sqlite })`.

### ✓ Step 7: Install sonner and add Toaster provider
Add toast notification capability to the app.
- Run `npm install sonner` to add the dependency.
- In `app/layout.tsx`: import and add `<Toaster />` inside `<ThemeProvider>` so toasts render globally.

### ✓ Step 8: Add toast notifications to login and signup forms
Show success/error toasts in both auth forms.
- In `components/login-form.tsx`: import `toast` from `sonner`; call `toast.success("Logged in successfully")` on success and `toast.error(...)` on error.
- In `components/signup-form/use-signup-form.ts`: import `toast` from `sonner`; call `toast.success("Account created successfully")` on success and `toast.error(...)` on error.
- Keep the existing inline `FieldError` for immediate form-level feedback.
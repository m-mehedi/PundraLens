---
sessionId: session-261021-112227-fg4k
---

# Requirements

### Overview
Implement role-based access control (RBAC) with Better Auth for a single organization with three roles: `admin` > `staff` > `student`. New users default to `student`; roles cannot be self-assigned during registration.

### Scope

**In Scope:**
- Add a `role` field to the Better Auth user schema (server + DB + client)
- Create a server-side guard utility (`requireRole`) with role weighting
- Create a seed script to provision the initial admin account

**Out of Scope:**
- Organization plugin (this is a single-org setup)
- Role assignment UI
- Permission granularity beyond role hierarchy

### Functional Requirements
1. **User registration** — all new users receive `role: "student"` by default
2. **Role field** — `input: false` prevents users from self-assigning roles during signup
3. **Role guard** — `requireRole(minimumRole)` verifies the current user meets or exceeds the required role level (student: 1, staff: 2, admin: 3)
4. **Admin seed** — `scripts/create-admin.ts` creates an admin user server-side, bypassing the client restriction

# Technical Design

### Current Implementation
- **`lib/auth.ts`** — `betterAuth()` with `emailAndPassword` plugin and `drizzleAdapter` (SQLite). No `user.additionalFields` configured.
- **`auth-schema.ts`** — Drizzle SQLite schema with `user`, `session`, `account`, `verification` tables. No `role` column on `user`.
- **`lib/auth-client.ts`** — `createAuthClient` from `better-auth/react`. No plugins or type inference for additional fields.
- **`db/index.ts`** — `better-sqlite3` + drizzle-orm. DB file: `mydb.sqlite`.
- **`drizzle.config.ts`** — schema at `schemas/index.ts` (re-exports `auth-schema.ts`), dialect `sqlite`.
- **Better Auth version:** `1.7.0-rc.6`

### Proposed Changes

**1. `lib/auth.ts` — Add `user.additionalFields`**
```ts
user: {
  additionalFields: {
    role: {
      type: "string",
      required: true,
      defaultValue: "student",
      input: false,
    },
  },
}
```

**2. `auth-schema.ts` — Add `role` column to `user` table**
```ts
role: text("role").default("student").notNull(),
```
Then run `npm run db:push` to migrate.

**3. `lib/auth-client.ts` — Add `inferAdditionalFields` plugin**
```ts
import { inferAdditionalFields } from "better-auth/client/plugins"
// In createAuthClient:
plugins: [inferAdditionalFields<typeof auth>()]
```
This makes TypeScript recognize `session.user.role`.

**4. `lib/auth-guard.ts` — New server-side guard utility**
- `requireRole(minimumRole)` — calls `auth.api.getSession()`, checks the user's role weight against the minimum required weight.
- Role weights: `{ student: 1, staff: 2, admin: 3 }`
- On failure: redirects to `/unauthorized` (or throws a 403 in API routes).

**5. `scripts/create-admin.ts` — New seed script**
- Uses `auth.api.createUser` (server-side API) to create a user with `role: "admin"`, bypassing the `input: false` client restriction.
- Accepts email/password from environment variables or CLI args.
- Idempotent: checks if an admin already exists.

### File Structure
```
lib/auth.ts              (modified — add user.additionalFields)
auth-schema.ts           (modified — add role column)
lib/auth-client.ts       (modified — add inferAdditionalFields plugin)
lib/auth-guard.ts        (new — server-side role guard)
scripts/create-admin.ts  (new — admin seed script)
```

# Delivery Steps

### ✓ Step 1: Update auth config and database schema with role field
Add the `role` additional field to Better Auth server config and the Drizzle schema, then push the migration.
- Modify `lib/auth.ts`: add `user.additionalFields` with `role` (type: string, required: true, defaultValue: "student", input: false).
- Modify `auth-schema.ts`: add `role: text("role").default("student").notNull()` to the `user` table.
- Run `npm run db:push` to apply the schema change to `mydb.sqlite`.

### ✓ Step 2: Update auth client with type inference for role field
Make the client SDK aware of the `role` field so TypeScript recognizes `session.user.role`.
- Modify `lib/auth-client.ts`: import `inferAdditionalFields` from `better-auth/client/plugins` and pass `inferAdditionalFields<typeof auth>()` into the `plugins` array of `createAuthClient`.

### ✓ Step 3: Create server-side role guard utility
Implement `lib/auth-guard.ts` with role-based access control logic.
- Create `lib/auth-guard.ts` with:
  - `ROLE_WEIGHTS` constant: `{ student: 1, staff: 2, admin: 3 }`
  - `requireRole(minimumRole)` function that calls `auth.api.getSession()`, compares the current user's role weight against the minimum, and redirects/throws on failure.
  - Type-safe role parameter: `"admin" | "staff" | "student"`.

### ✓ Step 4: Create admin seed script
Write `scripts/create-admin.ts` to provision the initial admin account.
- Create `scripts/create-admin.ts` that:
  - Imports `auth` from `lib/auth.ts`.
  - Calls `auth.api.createUser` server-side with `role: "admin"` (bypassing `input: false`).
  - Reads email/password from env vars (`ADMIN_EMAIL`, `ADMIN_PASSWORD`) or CLI args.
  - Is idempotent: checks if an admin already exists before creating.
- Add a `scripts:create-admin` npm script in `package.json` for easy execution.
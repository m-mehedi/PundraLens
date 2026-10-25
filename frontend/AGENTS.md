<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Project

PundraLens frontend — Next.js 16 (App Router) + React 19 + Tailwind v4 +
shadcn/ui, Better Auth (email/password + admin plugin), Drizzle ORM over
SQLite. Single app; git root is the **repo root** (one level up), which also
contains `backend/`.

## Commands

Package manager is **bun** (`bun.lock` is the only lockfile).

- `bun run dev` / `bun run build` / `bun run start`
- `bun run lint` — ESLint (flat config, next core-web-vitals + typescript)
- `bun run typecheck` — `tsc --noEmit`
- `bun run format` — Prettier
- `bun run db:push` — push Drizzle schema to Supabase Postgres
- `bun run db:generate` — emit a migration folder under `drizzle/`
- `bun run db:migrate` — replay migrations against `DATABASE_URL`
- `bun run db:studio`
- `bun run scripts:create-admin` — seeds admin from env (idempotent)
- `bun run scripts:seed-users` — dev seed: admin + 2 staff + 10 students
- `bun run scripts:migrate-users` — one-off data repair (legacy roles,
  broken restore points). Idempotent; safe to re-run.
- `bun run scripts:backfill-supabase` — one-off: copy the old SQLite into
  Postgres (idempotent).
- `bun run scripts:index-notices` — embed every published notice into
  `notice_chunk` for LensBot.

No test suite exists. Verify changes with `typecheck` then `lint`.

## Auth & roles (non-obvious)

Roles: `student` < `staff` < `admin`, plus the non-hierarchical `revoked` ban
role. All four are declared once in `lib/roles.ts` (isomorphic constants) and
registered with Better Auth's admin plugin in `lib/auth.ts`.

- **`admin({ defaultRole: "student", roles: {…} })` is load-bearing.** The admin
  plugin declares its own `role` field, which overrides anything in
  `user.additionalFields`; without `defaultRole` every self-signup used to land
  as the plugin's default `"user"` — a role no screen recognised. Declaring
  `roles` is also what lets `setRole` accept `staff`/`revoked` at all.
- `role` is **not** in `additionalFields` — adding it there is dead config.
- **Login accepts a Student ID *or* an email** (`resolveLoginIdentifier`,
  `lib/user-id.ts`). Students get `id@user.pundra`; staff/admins sign in with
  the address an administrator created. `app/revoked/page.tsx` is the ban
  landing page.
- **Signup is students-only.** `role` is `input: false`, so the client cannot
  set it. Staff accounts are provisioned by an admin from Manage Staffs
  (`createStaffUser` → `auth.api.createUser`); admins come from
  `scripts:create-admin` (or promote via the row menu).
- `requireRole(min)` / `requireStaff()` / `requireAdmin()` in `lib/auth-guard.ts`
  is the single guard — it redirects to `/login`, `/revoked` or `/unauthorized`.
  Route handlers use `apiSession(min)` (`lib/api-auth.ts`) instead, because they
  return a 401/403 response rather than redirecting.
- **Who can manage whom.** Staff manage the **student** roster (Manage Students:
  revoke, reset password). Only admins may change roles, create staff accounts,
  or use Manage Staffs / Manage Revoked.
  Because Better Auth's permission statements are global, `staff` is granted
  `list/get/set-role/set-password` in `lib/auth.ts`, and the *"students only"*
  restriction is enforced in **two** places that must be kept in sync:
  `lib/user-actions.ts` (`canManage`) for the server actions, and
  `app/api/auth/[...all]/route.ts` (`staffMayManage`) for direct calls to the
  `/api/auth/admin/*` endpoints, which are otherwise reachable by anyone with a
  session and bypass the server actions entirely.
- Row actions in `lib/user-actions.ts` stash the pre-ban role in
  `user.originalRole`; revoking an already-revoked account no longer clobbers
  that restore point.
- The profile lives at `/dashboard/profile` (reached from the account menu):
  name, avatar upload, phone, role-specific fields, and change-password. Avatar
  uploads are written to `public/uploads/avatars/` (gitignored) by
  `app/api/profile/avatar/route.ts`.

## Data layer

- **Supabase Postgres, not SQLite.** `db/index.ts` builds a Drizzle client over
  `postgres.js` from `DATABASE_URL` (the Supabase pooler string). `drizzle.config.ts`
  is `dialect: "postgresql"`; `drizzle/` holds committed **Postgres** migrations
  (the old SQLite ones are archived under `scripts/legacy/drizzle-sqlite`).
- `auth-schema.ts` (Better Auth tables) and `lib/notice-schema.ts` (notices +
  `notice_chunk`) are both `pg-core` and **maintained by hand**.
  `schemas/index.ts` re-exports them. The `drizzleAdapter` in `lib/auth.ts` uses
  `provider: "pg"`.
- `notice.batches` is `jsonb` (a number array), `createdAt`/`publishedAt` are
  real timestamps — the old SQLite JSON-string/epoch-ms forms are gone. Any code
  that did `JSON.parse(row.batches)` is a bug now.
- `lib/notice-lookups.ts` holds the hardcoded department/category lists and is
  **client-safe** (no db import). Client components import from there, not from
  `lib/backend-server.ts`, which is now `server-only` (it pulls in the Postgres
  driver).
- `DB_FILE_NAME` still points at the **old local SQLite file**, read only by the
  one-off `scripts/backfill-supabase.ts`. Nothing else uses it.
- Migration path for an existing deployment: `bun run db:migrate` (create the pg
  tables) → `bun run scripts:backfill-supabase` (copy rows in) →
  `bun run scripts:index-notices` (embed published notices).
- Env vars: `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `DATABASE_URL`,
  `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `ADMIN_NAME` (optional), `SEED_PASSWORD`,
  `GROQ_API_KEY`, `GROQ_MODEL`, `GOOGLE_API_KEY`, `EMBEDDING_MODEL`. `.env` is
  gitignored and never committed.
- `NEXT_PUBLIC_BETTER_AUTH_URL` is optional and only needed when the auth API is
  on a different origin; otherwise the client is same-origin.

## LensBot (RAG chatbot)

- `app/dashboard/lensbot/page.tsx` posts `{ query }` to `POST /api/lensbot`
  (`app/api/lensbot/route.ts`), which embeds the question and retrieves chunks.
- The pipeline lives in `lib/lensbot/`: `retrieve.ts` (pgvector cosine search
  over `notice_chunk`, published notices only) → `answer.ts` (Groq grounded
  answer, language-matched, with citations) → `config.ts` (models).
- **Groq generates, Gemini embeds.** `groq-sdk` answers with
  `GROQ_MODEL` (`openai/gpt-oss-120b`); embeddings come from Gemini
  `gemini-embedding-001` at **768 dims** (`GOOGLE_API_KEY`). The dimension is
  pinned in `lib/notice-schema.ts` (`EMBEDDING_DIMENSIONS`) and must match the
  `vector(768)` column and the `outputDimensionality` in `lib/lensbot/embeddings.ts`.
- Vectors are (re)built by `lib/lensbot/index-all.ts`: `reindexNoticeById` is
  called from `lib/notice-actions.ts` after every save/publish/update, and
  `unindexNotice` after a delete. Failures are swallowed so indexing never
  blocks a save. Only **published** notices are searchable.
- The pgvector extension + HNSW index are emitted by hand into the generated
  migration (`CREATE EXTENSION IF NOT EXISTS vector`, `USING hnsw (… vector_cosine_ops)`)
  because drizzle-kit does not generate them.

## Profile fields

`lib/profile-fields.ts` is the single source of truth for which fields each role
has and whether the owner may edit them. The signup form, profile page and
"add staff member" form all read from it.

## UI conventions

- shadcn style `base-maia`, base color `mist`, **icons are hugeicons**
  (`@hugeicons/react` + `@hugeicons/core-free-icons`) — not lucide.
- Prettier: no semicolons, double quotes, Tailwind class sorting +
  `cn`/`cva` class functions. Run `bun run format` before committing.
- Path alias `@/*` -> repo root.
- `lensbot` is now a **live RAG chat** (see above), not the old static mock.

## Config

- `CLAUDE.md` re-exports this file via `@AGENTS.md`.

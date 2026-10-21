<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Project

PundraLens frontend — Next.js 16 (App Router) + React 19 + Tailwind v4 +
shadcn/ui, Better Auth (email/password + admin plugin), Drizzle ORM over
SQLite. Single app; git root is this `frontend/` dir. Sibling `../backend`
is not part of this workspace.

## Commands

Package manager is **bun** (`bun.lock` is the lockfile; `package-lock.json`
is stale — ignore it).

- `bun run dev` / `bun run build` / `bun run start`
- `bun run lint` — ESLint (flat config, next core-web-vitals + typescript)
- `bun run typecheck` — `tsc --noEmit`
- `bun run format` — Prettier
- `bun run db:push` — push Drizzle schema to SQLite
- `bun run db:studio`
- `bun run scripts:create-admin` — seeds admin from env (idempotent)

No test suite exists. Verify changes with `typecheck` then `lint`.

## Auth & roles (non-obvious)

Roles: `student` < `staff` < `admin`, weighted in `lib/auth-guard.ts`.
`requireRole(min)` redirects to `/login` or `/unauthorized`. `revoked` is an
extra non-hierarchical role used to ban users.

- Students log in with a **Student ID**, not email. `studentIdToEmail()`
  (`lib/auth-client.ts`) maps `id` -> `id@user.pundra`; keep the domain in
  sync with `STUDENT_EMAIL_DOMAIN`.
- `role` is a Better Auth `additionalFields` field with `input: false`
  (`lib/auth.ts`), so it cannot be set from the client at signup.
- Admin actions (`lib/user-actions.ts`) stash the prior role in
  `user.originalRole` before setting `revoked`, then restore it.
- `app/revoked/page.tsx` is the ban landing page.

## Data layer

- Drizzle schema is **generated from Better Auth** into `auth-schema.ts`
  (`user`, `session`, `account`, `verification`); `schemas/index.ts` just
  re-exports it. `drizzle/` holds committed migrations.
- `DB_FILE_NAME` in `.env` points at `mydb.sqlite` (committed).
- Env vars: `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `DB_FILE_NAME`,
  `ADMIN_EMAIL`, `ADMIN_PASSWORD`. `.env` is committed despite `.gitignore`.

## UI conventions

- shadcn style `base-maia`, base color `mist`, **icons are hugeicons**
  (`@hugeicons/react` + `@hugeicons/core-free-icons`) — not lucide (lucide
  only remains in `login-form.tsx`).
- Prettier: no semicolons, double quotes, Tailwind class sorting +
  `cn`/`cva` class functions. Run `bun run format` before committing.
- Path alias `@/*` -> repo root.
- `lensbot` chat UI is currently a **static mock** using `createChat()`
  from `@shadcn/helpers/ai-sdk`; the AI SDK wiring is not yet live.

## Config

- `CLAUDE.md` re-exports this file via `@AGENTS.md`.
- `.junie/plans/*.md` documents the feature history (auth flow, RBAC,
  revoke flow, lensbot) — useful context when picking up work.

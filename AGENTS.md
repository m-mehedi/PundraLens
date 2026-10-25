# PundraNoticeLens — Agent Guide

Notice intelligence for Pundra University: photos / scanned PDFs / text (Bangla or
English) → structured, citable notices (deadlines, fees, venues) plus grounded QA.

## Repo shape

- The **git root is this directory**. Two apps that deploy separately and are **not
  wired together** — the frontend never calls the backend API.
- `backend/` — Python 3.12, FastAPI (`api.py`) + Streamlit portal (`ui.py`), SQLite at
  `backend/data/notices.db`. Pipeline: ingest → align/preprocess → OCR → LLM extraction
  → staff review → publish.
- `frontend/` — Next.js 16.4 (App Router), React 19, Tailwind v4, shadcn/ui,
  Better Auth, Drizzle over SQLite (`frontend/mydb.sqlite`).
- Frontend conventions live in `frontend/AGENTS.md` — read it before touching
  `frontend/` (it is auto-loaded when working there). `frontend/CLAUDE.md` re-exports it.
- Backend background: `backend/README.md` (features, pipeline, roles) and
  `backend/PLAN.md` (remediation checklist — **partly stale**, see below).
- `handover.md` — the **notice workbench** (the Upload Notice screen): the Edit
  and Extract panels, the data model, the backend contract and the things that
  will break it. Read it before touching `frontend/components/upload-notice/`.

## Commands

Backend — run from `backend/`. Pytest resolves `from pipeline... import ...` only via
`pythonpath = ["."]` in `backend/pyproject.toml` (there is no `conftest.py`), so pytest
must run inside `backend/`.

```bash
uv sync                                           # install
uv run uvicorn api:app --reload --port 8000       # REST API :8000
uv run streamlit run ui.py                        # Streamlit portal :8501
uv run pytest -v                                  # full suite
uv run pytest tests/test_all.py::test_bangla_digits_and_dates -v   # one test
uv run python -m evaluation.evaluate              # benchmark: 32 live Gemini calls
```

Frontend — run from `frontend/`. **bun is the only package manager** (`bun.lock` is the
only lockfile).

```bash
bun install
bun run dev                 # :3000
bun run typecheck           # tsc --noEmit
bun run lint                # eslint
bun run format              # prettier --write
bun run db:push             # drizzle-kit push -> SQLite schema
bun run scripts:create-admin
```

There is no frontend test suite. Verify frontend work with `typecheck` then `lint`.

## Known-failing baseline (do not mistake it for a regression)

`uv run pytest -v` → **5 passed, 3 failed**
- `test_calendar_generation`, `test_duplicate_detection_and_diff` — the tests build a
  `NoticeRecord` without `summary_bengali` / `summary_english`, which `NoticeExtract`
  (`backend/pipeline/models.py:89`) makes **required**.
- `test_benchmark_evaluation` — needs `GOOGLE_API_KEY`; it calls the live Gemini API.

`bun run lint` → **2 problems (1 error, 1 warning)**
- error: `hooks/use-mobile.ts` (`react-hooks/set-state-in-effect`).
- warning: `components/signup-form/use-signup-form.ts` (`react-hooks/incompatible-library`,
  from `react-hook-form`'s `watch()`).

`bun run typecheck` passes. Compare against these numbers before blaming your diff.
Note: a stale `.next/types/validator.ts` from an older build can make `typecheck`
report phantom errors about routes that no longer exist; `rm -rf .next/types`
and re-run before investigating.

Backend-suite side effects: it inserts then deletes a row in `backend/data/notices.db`
(gitignored) and the TTS test hits the network.

## Env & setup gotchas

- `backend/.env` is loaded as an **import side effect** of `pipeline/__init__.py`; every
  entry point does `import pipeline  # Loads .env`. Keys: `GOOGLE_API_KEY` (required for
  extraction, QA, Gemini-vision OCR), `DATALAB_API_KEY` (optional; Gemini vision is the
  OCR fallback), `GEMINI_MODEL` (default `gemini-2.5-flash`), `API_KEY` (optional — when
  unset the API runs **open**; when set, protected routes require an `X-API-Key` header).
- Frontend `.env`: `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `DB_FILE_NAME`,
  `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `ADMIN_NAME` (optional), `SEED_PASSWORD`.
  `DB_FILE_NAME` is used verbatim as a path relative to
  `frontend/` (`frontend/db/index.ts`).
- Both SQLite files are gitignored, so a fresh checkout has **no database**:
  backend creates `backend/data/notices.db` via `init_db()` on `api.py` import; frontend
  needs `bun run db:push` **then** `bun run scripts:create-admin` before the first login.
  Databases created before the role model was fixed also want
  `bun run scripts:migrate-users` (see `frontend/AGENTS.md`).

## Backend gotchas

- `storage/db.py:21` hardcodes `DB_PATH = backend/data/notices.db`; `init_db()` runs at
  import of `api.py`, not at app startup.
- `backend/ui.py`'s role switcher is cosmetic — **no authentication**. Anyone who can
  reach the Streamlit portal can act as staff or admin; the backend has no user accounts
  at all.
- `backend/PLAN.md` is a remediation checklist and is **partly stale**: the `rapidfuzz`
  dependency, the `qa.py` `NoticeRecord` import, upload size/MIME validation and rate
  limiting are already fixed. Verify in code before treating an item as open.
- `evaluation/evaluate.py` calls Gemini once per notice — the full benchmark is 32 live
  API calls.

## Frontend gotchas

- Roles live in `frontend/lib/roles.ts`; `requireRole` / `requireStaff` /
  `requireAdmin` (`frontend/lib/auth-guard.ts`) are the only guards, used by every
  dashboard page and server action. Route handlers use `apiSession()` instead.
- `frontend/lib/auth.ts` **must** keep `admin({ defaultRole: "student", roles })`:
  the admin plugin owns the `role` field, so without it self-signups land as `"user"`.
- Login accepts a Student ID **or** an email (`resolveLoginIdentifier`). Signup is
  students-only; staff accounts are created by an admin from Manage Staffs, admins by
  `bun run scripts:create-admin`.
- `auth-schema.ts` is the Drizzle schema and there is **no wired codegen script** — it is
  maintained by hand (it carries `originalRole` and the profile columns, none of which are
  Better Auth core fields). `drizzle/` holds the committed migrations, one folder each.
- User avatar uploads go to `frontend/public/uploads/avatars/` (gitignored).
- Prettier: no semicolons, double quotes, 80 columns; icons are **hugeicons**
  (`@hugeicons/react`), not lucide.

## Git & landing

- `origin` → `https://github.com/m-mehedi/PundraLens.git`, default branch `main`.
- No CI workflows, no git hooks, no branch protection → landing is a direct
  fast-forward push: `git push origin HEAD:main`. Never force-push or rewrite history.
- `.agents/skills/land` documents the full landing procedure (including the baselines
  above). Other repo skills: `fastapi`, `frontend-design`, `motion`, `shadcn`.
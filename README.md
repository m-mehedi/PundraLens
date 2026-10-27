# PundraLens

Notice intelligence for Pundra University. PundraLens turns university notices
— photos, scanned PDFs, digital PDFs, or plain text, in Bangla or English — into
structured, searchable, citable data: deadlines, fees, venues, and answers
grounded in the source text.


Demo Video link: (Will be published as soon as possible before the deadline)

## Layout

| Path | What it is | Stack |
| --- | --- | --- |
| `backend/` | Ingestion, OCR, field extraction, grounded QA, calendar export, TTS | Python 3.12, FastAPI, Streamlit, SQLite |
| `frontend/` | The web app: student portal, staff/publisher workflow, admin | Next.js 16 (App Router), React 19, Tailwind v4, shadcn/ui, Better Auth, Drizzle |

The two deploy separately. `backend/` serves a REST API (FastAPI) and a
standalone Streamlit portal; `frontend/` is the production UI. **They are not
wired together yet** — the frontend's LensBot chat is still a static mock
(see `frontend/AGENTS.md`).

## Quickstart

### Backend

```bash
cd backend
uv sync
```

Create `backend/.env`:

```env
GOOGLE_API_KEY="your-gemini-api-key"
DATALAB_API_KEY="your-datalab-api-key"  # optional; Gemini vision OCR is the fallback
```

```bash
uv run uvicorn api:app --reload --port 8000   # REST API
```

### Frontend

```bash
cd frontend
bun install
```

Create `frontend/.env`:

```env
BETTER_AUTH_SECRET="..."
BETTER_AUTH_URL="http://localhost:3000"
DB_FILE_NAME="mydb.sqlite"
ADMIN_EMAIL="..."
ADMIN_PASSWORD="..."
```

```bash
bun run db:push                 # create the SQLite schema
bun run scripts:create-admin    # seed the admin account
bun run dev                     # http://localhost:3000
```

The database is gitignored, so a fresh checkout starts with none — run
`db:push` and `scripts:create-admin` before the first login.

## Docs

- `backend/README.md` — feature overview, pipeline architecture, roles walkthrough
- `backend/PLAN.md` — open remediation checklist from the backend code review
- `frontend/AGENTS.md` — frontend commands, auth/role model, UI conventions
- `backend/tests/` — unit and integration tests (`uv run pytest -v`)

## API key

Protected backend routes expect an `X-API-Key` header when `API_KEY` is set in
`backend/.env`. With no `API_KEY` configured, the API runs open (development
mode) — do not expose it publicly in that state.

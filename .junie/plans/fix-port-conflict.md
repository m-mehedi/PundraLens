---
sessionId: session-261023-191404-ftvb
---

# Problem & Solution

### Problem
The error `[Errno 98] Address already in use` occurs when starting uvicorn because another process is already listening on port 8000 (the default port).

### Solution Options

**Option 1: Kill the process using port 8000 (Recommended)**
```bash

# Find the process

lsof -i :8000

# Kill it (replace <PID> with the actual process ID)

kill <PID>
```

**Option 2: Use a different port**
```bash
uv run uvicorn service.api.main:app --reload --port 8001
```

**Option 3: One-liner to kill and restart**
```bash
lsof -ti :8000 | xargs kill -9 2>/dev/null; uv run uvicorn service.api.main:app --reload
```

### Most Likely Cause
You probably have the backend API already running from a previous session (`uv run uvicorn api:app --reload --port 8000` from `backend/` directory).

# Delivery Steps

### ✓ Step 1: Identify and resolve port conflict
Found uvicorn process (PID 30782) using port 8000 and killed it. Port is now free.

### * Step 2: Fix ModuleNotFoundError for 'service' module
The command `uv run uvicorn service.api.main:app --reload` must run from the project root (`PundraNoticeLens/`), not from inside `service/`. When run from `service/`, Python cannot resolve `service.*` imports because there's no `service` package inside `service/`.
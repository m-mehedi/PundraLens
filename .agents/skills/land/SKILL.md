---
name: land
description: >-
  Land the current thread's changes into the PundraLens main branch. Use only when the
  user has explicitly asked to land, push, or merge this change — not for review, for
  preparing commits, for running checks, or for installing tooling. Verifies the project
  checks, fast-forwards main, pushes to origin, and syncs the local checkout.
disable-model-invocation: true
metadata:
  delta-action: land
---

# Land changes

Carry out an explicit landing request for this repository: take the change the user
is asking to land, verify it, and publish it to the `main` branch of the upstream
remote. The invocation already carries the intent to land — do not stop to ask
whether the user wants it merged.

## How this repository lands

- Upstream is `origin` → `https://github.com/m-mehedi/PundraLens.git` (public), default
  branch `main`. `main` has no branch-protection rules, and the repo has no CI
  workflows, no git hooks, and no PR template — so landing is a direct push.
- `local` → `~/Development/PundraNoticeLens`, the user's primary checkout, which is the
  working copy they use day to day. It normally tracks `main`.
- Applicable repo instructions: `frontend/AGENTS.md` (frontend commands, auth model,
  UI conventions). There is no root `AGENTS.md`, `CONTRIBUTING.md`, or release script.

## 1. Identify what will land

Run in the worktree the request was made in:

```bash
git status --short
git log --oneline origin/main..HEAD
git merge-base --is-ancestor origin/main HEAD && echo "fast-forward is possible"
```

- If the worktree has uncommitted changes, stop and report them; landing must not
  discard or sweep up unrelated work.
- If `merge-base --is-ancestor` fails, `main` has moved and this is not a
  fast-forward — go to step 4.
- Land exactly the commits listed above. Do not add, amend, or invent changes.

## 2. Verify before landing

The project has a known-failing baseline. Compare against it rather than treating
any failure as a blocker.

Backend — `uv run pytest -v` (defined in `backend/README.md` § Testing & Evaluation;
pytest config in `backend/pyproject.toml`):

- Expected baseline: **5 passed, 3 failed**. The three failures are pre-existing:
  `test_calendar_generation` and `test_duplicate_detection_and_diff` fail because
  `NoticeRecord` requires `summary_bengali` / `summary_english`, and
  `test_benchmark_evaluation` fails when `GOOGLE_API_KEY` is not set.

Frontend — `bun run typecheck` and `bun run lint` (scripts in `frontend/package.json`;
documented in `frontend/AGENTS.md` § Commands):

- `bun run typecheck` must pass with no errors.
- `bun run lint` expected baseline: **12 problems (6 errors, 6 warnings)**, in
  `frontend/hooks/use-mobile.ts` and `frontend/lib/user-actions.ts`.

Rules:

- Block the landing on any failure beyond the baseline, on a `typecheck` error, or on a
  check that cannot run (missing dependency, missing API key). Say what did not run.
- Never treat a skipped, pending, or unverified check as a pass.

## 3. Push to main

```bash
git push origin HEAD:main
```

- This is a fast-forward push to the unprotected `main`; no PR is needed.
- If the push is rejected as non-fast-forward, go to step 4. Never use `--force`.
- Never rewrite history, amend published commits, or rebase onto `main` to force a
  landing. If a sensitive file must be purged from an earlier commit, that is a
  separate, explicitly authorized operation — report it, do not perform it.

## 4. Conflicts: stop and ask

The user has chosen to decide conflicts themselves. When `main` has moved and the
land is not a fast-forward, or a push is rejected, or a merge produces conflicts:

- Stop. Report exactly what conflicted: the commit that moved `main`, the files
  involved, and the conflicting hunks on both sides.
- Wait for the user's decision. Do not auto-resolve, do not pick a side, do not
  force-push, and do not silently retry with a different strategy.

## 5. Sync the local checkout

After `origin/main` carries the change, bring the primary checkout up to date:

```bash
git -C ~/Development/PundraNoticeLens status --short
git -C ~/Development/PundraNoticeLens pull --ff-only
```

- Only run the pull when that working tree is clean. If it has local changes, leave
  it untouched and report that it needs attention.
- A non-fast-forward here means the checkout has diverged; report it instead of
  forcing.

## 6. Confirm the landing

```bash
git ls-remote origin refs/heads/main
git rev-parse HEAD
git -C ~/Development/PundraNoticeLens rev-parse HEAD
```

The three SHAs must match the landed commit. If any of them disagrees, the change
has not landed — say so plainly and describe the state.

Then report to the user: the commits landed, the destination branch and remote, the
verification results (including anything skipped), and the resulting state of the
local checkout.

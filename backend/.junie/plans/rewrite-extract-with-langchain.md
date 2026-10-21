---
sessionId: session-261018-185307-x8gl
---

# Requirements

### Overview
Replace the `openai` package in `pipeline/extract.py` with LangChain (`langchain` + `langchain-google-genai`) using Google's **Gemini Flash** model for LLM-based structured extraction. The Pydantic models in `pipeline/models.py` remain unchanged.

### Scope
- **In Scope:** Rewrite `pipeline/extract.py` to use LangChain's `ChatGoogleGenerativeAI` with `gemini-2.0-flash` model and structured output support. Keep the same system prompt and return type.
- **Out of Scope:** Changing `pipeline/models.py`, `pipeline/align.py`, `pipeline/ocr.py`, or `main.py`.

### Key Acceptance Criteria
- The `extract_notice()` function signature and return type (`NoticeExtract`) remain unchanged.
- Supports `GOOGLE_API_KEY` environment variable for Gemini API authentication.
- Returns a validated `NoticeExtract` Pydantic model.
- Uses LangChain's `with_structured_output()` to ensure output matches the schema.

# Technical Design

### Current Implementation
`pipeline/extract.py` uses the `openai` package directly:
- `_get_client()` creates an `OpenAI` client (cached).
- `extract_notice()` calls `client.chat.completions.create()` with `response_format={"type": "json_object"}`.
- Parses raw JSON and validates against `NoticeExtract` Pydantic model.

### Proposed Changes
Replace the `openai` client with LangChain's `ChatGoogleGenerativeAI`:
- `_get_client()` returns a `ChatGoogleGenerativeAI` instance (cached), configured with `GOOGLE_API_KEY`.
- `extract_notice()` uses `chat_model.with_structured_output(NoticeExtract, method="json_schema")` to get typed output directly — no manual JSON parsing needed.
- Keeps the same `SYSTEM_PROMPT` but changes model to `gemini-2.0-flash`.
- Environment variable changes from `OPENAI_API_KEY`/`OPENAI_BASE_URL` to `GOOGLE_API_KEY`.

### Packages to Install
User runs:
```
uv add langchain langchain-google-genai
```

### Files Modified
- `pipeline/extract.py` — full rewrite of LLM client and extraction logic.
- `pyproject.toml` — dependencies added by `uv add` (user runs it).

# Delivery Steps

### ✓ Step 1: Rewrite pipeline/extract.py with LangChain and Gemini Flash
Replace the `openai` package with LangChain's `ChatGoogleGenerativeAI` and structured output in `pipeline/extract.py`.
- Replace `_get_client()` to return a cached `ChatGoogleGenerativeAI` instance instead of `OpenAI`.
- Configure with `GOOGLE_API_KEY` environment variable (remove `OPENAI_API_KEY` and `OPENAI_BASE_URL`).
- Replace `extract_notice()` to use `with_structured_output(NoticeExtract, method="json_schema")` for typed extraction.
- Change model from `gpt-4o` to `gemini-2.0-flash`.
- Keep the same `SYSTEM_PROMPT` and temperature.
- Remove manual JSON parsing — LangChain handles validation against the Pydantic schema.
- Update imports: remove `openai`, add `langchain_google_genai.ChatGoogleGenerativeAI`.
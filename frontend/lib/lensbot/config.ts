/**
 * LensBot — retrieval-augmented question answering over published notices.
 *
 * The notice rows live in Supabase Postgres (`frontend/lib/notice-schema.ts`);
 * each published notice is split into chunks, embedded with Gemini
 * (`gemini-embedding-001`) and stored in `notice_chunk` with a pgvector
 * column. A student's question is embedded the same way, the nearest chunks
 * are retrieved by cosine distance, and Groq answers strictly from them —
 * returning citations that point back at the notice rows.
 */

export const EMBEDDING_MODEL =
  process.env.EMBEDDING_MODEL ?? "gemini-embedding-001"

/** Must match `EMBEDDING_DIMENSIONS` in `lib/notice-schema.ts`. */
export const EMBEDDING_DIMENSIONS = 768

export const GROQ_MODEL = process.env.GROQ_MODEL ?? "openai/gpt-oss-120b"

export const GROQ_BASE_URL =
  process.env.GROQ_BASE_URL ?? "https://api.groq.com/openai/v1"

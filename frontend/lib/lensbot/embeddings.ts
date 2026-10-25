import { EMBEDDING_DIMENSIONS, EMBEDDING_MODEL } from "./config"

const GEMINI_BASE =
  process.env.GEMINI_BASE_URL ??
  "https://generativelanguage.googleapis.com/v1beta"

interface EmbedResponse {
  embedding: { values: number[] }
}

/**
 * Embed a single piece of text with Gemini's `embed` endpoint, truncated to
 * `EMBEDDING_DIMENSIONS` so the vectors fit the pgvector column.
 */
export async function embedText(text: string): Promise<number[]> {
  const apiKey = process.env.GOOGLE_API_KEY
  if (!apiKey) {
    throw new Error("GOOGLE_API_KEY is not set — needed for embeddings")
  }

  const res = await fetch(
    `${GEMINI_BASE}/models/${EMBEDDING_MODEL}:embedContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: `models/${EMBEDDING_MODEL}`,
        content: { parts: [{ text }] },
        outputDimensionality: EMBEDDING_DIMENSIONS,
      }),
    }
  )

  if (!res.ok) {
    const detail = await res.text()
    throw new Error(`Embedding failed (${res.status}): ${detail.slice(0, 300)}`)
  }

  const data = (await res.json()) as EmbedResponse
  const values = data.embedding?.values
  if (!values?.length) {
    throw new Error("Embedding response contained no vector")
  }
  return values
}

/**
 * Embed many texts, batching them into `/batchEmbedContents` requests to keep
 * the number of round trips down when indexing the whole notice corpus.
 */
export async function embedBatch(
  texts: string[],
  batchSize = 20
): Promise<number[][]> {
  const apiKey = process.env.GOOGLE_API_KEY
  if (!apiKey) {
    throw new Error("GOOGLE_API_KEY is not set — needed for embeddings")
  }

  const out: number[][] = []
  for (let i = 0; i < texts.length; i += batchSize) {
    const slice = texts.slice(i, i + batchSize)
    const res = await fetch(
      `${GEMINI_BASE}/models/${EMBEDDING_MODEL}:batchEmbedContents?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requests: slice.map((text) => ({
            model: `models/${EMBEDDING_MODEL}`,
            content: { parts: [{ text }] },
            outputDimensionality: EMBEDDING_DIMENSIONS,
          })),
        }),
      }
    )

    if (!res.ok) {
      const detail = await res.text()
      throw new Error(
        `Batch embedding failed (${res.status}): ${detail.slice(0, 300)}`
      )
    }

    const data = (await res.json()) as {
      embeddings: { values: number[] }[]
    }
    for (const embedding of data.embeddings) {
      out.push(embedding.values)
    }
  }
  return out
}

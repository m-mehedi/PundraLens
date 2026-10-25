import { sql } from "drizzle-orm"
import { db } from "@/db"
import { embedText } from "./embeddings"

export interface RetrievedChunk {
  notice_id: number
  notice_title: string
  category: string
  deadline: string | null
  content: string
  distance: number
}

function toVectorLiteral(vector: number[]): string {
  return `[${vector.join(",")}]`
}

/**
 * Embed the question and return the `topK` nearest notice chunks by cosine
 * distance, newest first on a tie. Only published notices are searchable.
 */
export async function retrieve(
  query: string,
  topK = 6
): Promise<RetrievedChunk[]> {
  const vector = await embedText(query)
  const literal = toVectorLiteral(vector)

  const rows = await db.execute(sql`
    SELECT
      n.id            AS notice_id,
      COALESCE(n.title, n.notice_no, 'Notice') AS notice_title,
      n.category      AS category,
      n.deadline      AS deadline,
      c.content       AS content,
      (c.embedding <=> ${literal}::vector) AS distance
    FROM notice_chunk c
    JOIN notice n ON n.id = c.notice_id
    WHERE n.status = 'published'
    ORDER BY c.embedding <=> ${literal}::vector
    LIMIT ${topK}
  `)

  return (rows as unknown as RetrievedChunk[]).map((row) => ({
    ...row,
    distance: Number(row.distance),
  }))
}

import { eq } from "drizzle-orm"
import { db } from "@/db"
import { EMBEDDING_DIMENSIONS, noticeChunk } from "@/lib/notice-schema"
import type { NoticeRecord } from "@/lib/notice-types"
import { chunkNotice } from "./chunk"
import { embedBatch } from "./embeddings"

import { createHash } from "node:crypto"

function hash(content: string): string {
  return createHash("sha256").update(content).digest("hex")
}

/**
 * Replace every chunk of a notice with freshly embedded ones.
 *
 * Re-indexing is safe to call repeatedly: the chunks are deleted and rewritten
 * inside one transaction, so a failure leaves the previous vectors in place.
 */
export async function indexNotice(notice: NoticeRecord): Promise<number> {
  if (notice.id == null) {
    throw new Error("Cannot index a notice without an id")
  }
  if (notice.status !== "published") {
    // Drafts are not searchable; make sure no stale chunks survive publishing
    // then archiving.
    await db.delete(noticeChunk).where(eq(noticeChunk.noticeId, notice.id))
    return 0
  }

  const chunks = chunkNotice(notice)
  const vectors = await embedBatch(chunks)

  if (vectors.some((v) => v.length !== EMBEDDING_DIMENSIONS)) {
    throw new Error(
      `Embedding dimension mismatch: expected ${EMBEDDING_DIMENSIONS}`
    )
  }

  await db.transaction(async (tx) => {
    await tx.delete(noticeChunk).where(eq(noticeChunk.noticeId, notice.id!))
    await tx.insert(noticeChunk).values(
      chunks.map((content, index) => ({
        noticeId: notice.id!,
        chunkIndex: index,
        content,
        contentHash: hash(content),
        embedding: vectors[index],
      }))
    )
  })

  return chunks.length
}

/** Remove a notice's vectors (used when a notice is deleted). */
export async function unindexNotice(noticeId: number): Promise<void> {
  await db.delete(noticeChunk).where(eq(noticeChunk.noticeId, noticeId))
}

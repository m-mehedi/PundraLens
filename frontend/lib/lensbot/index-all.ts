import { eq } from "drizzle-orm"
import { db } from "@/db"
import { notice } from "@/lib/notice-schema"
import type { NoticeRecord, NoticeStatus } from "@/lib/notice-types"
import { indexNotice, unindexNotice } from "./index-notice"

function rowToRecord(row: typeof notice.$inferSelect): NoticeRecord {
  return {
    id: row.id,
    title: row.title,
    issuing_office: row.issuingOffice,
    date_of_issue: row.dateOfIssue,
    category: row.category as NoticeRecord["category"],
    deadline: row.deadline,
    event_date_and_time: row.eventDateAndTime,
    venue: row.venue,
    departments: row.departments,
    batches: row.batches ?? null,
    required_action: row.requiredAction,
    fees: row.fees,
    contact: row.contact,
    notice_no: row.noticeNo,
    notice_summary_bn: row.noticeSummaryBn,
    notice_summary_en: row.noticeSummaryEn,
    raw_text: row.rawText,
    source_type: row.sourceType,
    file_name: row.fileName,
    status: row.status as NoticeStatus,
    created_at: row.createdAt?.toISOString() ?? null,
    published_at: row.publishedAt?.toISOString() ?? null,
    published_by: row.publishedBy,
    review_notes: row.reviewNotes,
    version: row.version,
  }
}

/** Re-embed every published notice. Used by `scripts:index-notices`. */
export async function indexAllPublishedNotices(): Promise<{
  notices: number
  chunks: number
}> {
  const rows = await db
    .select()
    .from(notice)
    .where(eq(notice.status, "published"))

  let chunks = 0
  for (const row of rows) {
    chunks += await indexNotice(rowToRecord(row))
  }

  return { notices: rows.length, chunks }
}

/**
 * Re-read one notice from the database and refresh its vectors. Called after
 * a notice is created, published, edited or archived so search never serves a
 * stale chunk. Failures are swallowed — indexing must never block a save.
 */
export async function reindexNoticeById(noticeId: number): Promise<void> {
  try {
    const [row] = await db
      .select()
      .from(notice)
      .where(eq(notice.id, noticeId))
      .limit(1)
    if (!row) {
      await unindexNotice(noticeId)
      return
    }
    await indexNotice(rowToRecord(row))
  } catch (error) {
    console.error(`Failed to index notice ${noticeId}:`, error)
  }
}

export { indexNotice, unindexNotice }

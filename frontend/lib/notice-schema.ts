import {
  pgTable,
  text,
  integer,
  jsonb,
  timestamp,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core"
import { vector } from "drizzle-orm/pg-core/columns/vector_extension/vector"

/** Embedding dimensions for Gemini `gemini-embedding-001` truncated output. */
export const EMBEDDING_DIMENSIONS = 768

export const notice = pgTable(
  "notice",
  {
    id: integer("id").primaryKey().generatedByDefaultAsIdentity(),
    title: text("title"),
    issuingOffice: text("issuing_office"),
    dateOfIssue: text("date_of_issue"),
    category: text("category").default("general").notNull(),
    deadline: text("deadline"),
    eventDateAndTime: text("event_date_and_time"),
    venue: text("venue"),
    departments: text("departments"),
    batches: jsonb("batches").$type<number[] | null>(),
    requiredAction: text("required_action"),
    fees: text("fees"),
    contact: text("contact"),
    noticeNo: text("notice_no"),
    noticeSummaryBn: text("notice_summary_bn"),
    noticeSummaryEn: text("notice_summary_en"),
    rawText: text("raw_text"),
    sourceType: text("source_type").default("photo").notNull(),
    fileName: text("file_name"),
    status: text("status").default("draft").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).$defaultFn(
      () => new Date()
    ),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    publishedBy: text("published_by"),
    reviewNotes: text("review_notes"),
    version: integer("version").default(1).notNull(),
  },
  (table) => [
    index("notice_status_idx").on(table.status),
    index("notice_category_idx").on(table.category),
  ]
)

/**
 * One embedded chunk of a notice. A notice is split into overlapping chunks so
 * a long notice can still be retrieved by any of its sections; each chunk holds
 * its own vector for cosine similarity search via pgvector.
 */
export const noticeChunk = pgTable(
  "notice_chunk",
  {
    id: integer("id").primaryKey().generatedByDefaultAsIdentity(),
    noticeId: integer("notice_id")
      .notNull()
      .references(() => notice.id, { onDelete: "cascade" }),
    chunkIndex: integer("chunk_index").notNull(),
    content: text("content").notNull(),
    contentHash: text("content_hash").notNull(),
    embedding: vector("embedding", { dimensions: EMBEDDING_DIMENSIONS }),
    createdAt: timestamp("created_at", { withTimezone: true }).$defaultFn(
      () => new Date()
    ),
  },
  (table) => [
    index("notice_chunk_notice_idx").on(table.noticeId),
    uniqueIndex("notice_chunk_notice_chunk_uidx").on(
      table.noticeId,
      table.chunkIndex
    ),
  ]
)

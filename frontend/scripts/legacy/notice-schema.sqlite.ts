import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core"

export const notice = sqliteTable(
  "notice",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    title: text("title"),
    issuingOffice: text("issuing_office"),
    dateOfIssue: text("date_of_issue"),
    category: text("category").default("general").notNull(),
    deadline: text("deadline"),
    eventDateAndTime: text("event_date_and_time"),
    venue: text("venue"),
    departments: text("departments"),
    batches: text("batches"),
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
    createdAt: integer("created_at", { mode: "timestamp_ms" }),
    publishedAt: integer("published_at", { mode: "timestamp_ms" }),
    publishedBy: text("published_by"),
    reviewNotes: text("review_notes"),
    version: integer("version").default(1).notNull(),
  },
  (table) => [
    index("notice_status_idx").on(table.status),
    index("notice_category_idx").on(table.category),
  ]
)

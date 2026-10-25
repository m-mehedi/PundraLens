/**
 * Server-only helpers for notices (Supabase Postgres via Drizzle) and the OCR
 * pipeline (remote FastAPI backend).
 *
 * Notice CRUD runs in the server so the browser never needs a database URL or
 * an API key. The `request()` helper is kept for the OCR pipeline routes
 * (`/api/pipeline/*`) that still call the FastAPI backend.
 */

import { and, eq, ilike, or, sql } from "drizzle-orm"
import { db } from "@/db"
import { notice } from "@/lib/notice-schema"
import type { NoticePatch, NoticeRecord, NoticeStatus } from "./notice-types"

// Kept for OCR pipeline routes that still call the FastAPI backend.
const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:3000"
const API_KEY = process.env.API_KEY || ""

export class BackendError extends Error {
  status: number

  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}

interface RequestOptions {
  method?: "GET" | "POST" | "PUT" | "DELETE"
  body?: unknown
  query?: Record<string, string | number | undefined | null>
}

async function request<T>(
  path: string,
  options: RequestOptions = {}
): Promise<T> {
  const { method = "GET", body, query } = options

  const url = new URL(`${BACKEND_URL}${path}`)
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value === undefined || value === null || value === "") continue
      url.searchParams.set(key, String(value))
    }
  }

  const headers: HeadersInit = {}
  if (API_KEY) {
    headers["X-API-Key"] = API_KEY
  }
  if (body !== undefined) {
    headers["Content-Type"] = "application/json"
  }

  const response = await fetch(url, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  })

  const text = await response.text()
  let payload: unknown = null
  if (text) {
    try {
      payload = JSON.parse(text)
    } catch {
      payload = { detail: text.slice(0, 300) }
    }
  }

  if (!response.ok) {
    const detail = (payload as { detail?: unknown } | null)?.detail
    const message =
      typeof detail === "string"
        ? detail
        : `Backend request failed (${response.status})`
    throw new BackendError(message, response.status)
  }

  return payload as T
}

// ---------------------------------------------------------------------------
// Type helpers: convert between Drizzle row shape and NoticeRecord
// ---------------------------------------------------------------------------

function rowToRecord(row: typeof notice.$inferSelect): NoticeRecord {
  const batches = row.batches ?? null

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
    batches,
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

// ---------------------------------------------------------------------------
// Notice CRUD — local Drizzle queries
// ---------------------------------------------------------------------------

export interface NoticeFilters {
  status?: NoticeStatus | "all"
  category?: string
  department?: string
  batch?: string
  search_query?: string
  offset?: number
  limit?: number
}

export async function listNotices(
  filters: NoticeFilters = {}
): Promise<{ count: number; notices: NoticeRecord[] }> {
  const { status, category, department, batch, search_query, limit, offset } =
    filters

  const conditions = []

  if (status && status !== "all") {
    conditions.push(eq(notice.status, status))
  }
  if (category) {
    conditions.push(eq(notice.category, category))
  }
  if (department) {
    conditions.push(ilike(notice.departments, `%${department}%`))
  }
  if (batch) {
    conditions.push(sql`${notice.batches}::text ilike ${`%${batch}%`}`)
  }
  if (search_query) {
    const q = `%${search_query}%`
    conditions.push(
      or(
        ilike(notice.title, q),
        ilike(notice.noticeSummaryBn, q),
        ilike(notice.noticeSummaryEn, q),
        ilike(notice.rawText, q)
      )
    )
  }

  const where = conditions.length ? and(...conditions) : undefined

  // Get total count for pagination
  const [{ count }] = await db
    .select({ count: sql`count(*)` })
    .from(notice)
    .where(where)

  // Fetch rows ordered by created_at descending
  const rows = await db
    .select()
    .from(notice)
    .where(where)
    .orderBy(notice.createdAt)
    .limit(limit ?? 100)
    .offset(offset ?? 0)

  return {
    count: Number(count),
    notices: rows.map(rowToRecord),
  }
}

export async function getNotice(id: number): Promise<NoticeRecord | null> {
  const [row] = await db.select().from(notice).where(eq(notice.id, id)).limit(1)
  return row ? rowToRecord(row) : null
}

export async function createNotice(
  record: Partial<NoticeRecord>
): Promise<{ id: number; status: NoticeStatus }> {
  const [result] = await db
    .insert(notice)
    .values({
      title: record.title ?? null,
      issuingOffice: record.issuing_office ?? null,
      dateOfIssue: record.date_of_issue ?? null,
      category: record.category ?? "general",
      deadline: record.deadline ?? null,
      eventDateAndTime: record.event_date_and_time ?? null,
      venue: record.venue ?? null,
      departments: record.departments ?? null,
      batches: record.batches ?? null,
      requiredAction: record.required_action ?? null,
      fees: record.fees ?? null,
      contact: record.contact ?? null,
      noticeNo: record.notice_no ?? null,
      noticeSummaryBn: record.notice_summary_bn ?? null,
      noticeSummaryEn: record.notice_summary_en ?? null,
      rawText: record.raw_text ?? null,
      sourceType: record.source_type ?? "photo",
      fileName: record.file_name ?? null,
      status: (record.status ?? "draft") as NoticeStatus,
      createdAt: new Date(),
      version: record.version ?? 1,
    })
    .returning({ id: notice.id, status: notice.status })

  return {
    id: result.id,
    status: result.status as NoticeStatus,
  }
}

export async function publishNotice(
  id: number,
  publishedBy: string
): Promise<void> {
  await db
    .update(notice)
    .set({
      status: "published",
      publishedBy,
      publishedAt: new Date(),
    })
    .where(eq(notice.id, id))
}

export async function updateNotice(
  id: number,
  patch: NoticePatch
): Promise<void> {
  const updateRecord: Record<string, unknown> = {}

  if (patch.title !== undefined) updateRecord.title = patch.title
  if (patch.issuing_office !== undefined)
    updateRecord.issuingOffice = patch.issuing_office
  if (patch.date_of_issue !== undefined)
    updateRecord.dateOfIssue = patch.date_of_issue
  if (patch.deadline !== undefined) updateRecord.deadline = patch.deadline
  if (patch.event_date_and_time !== undefined)
    updateRecord.eventDateAndTime = patch.event_date_and_time
  if (patch.venue !== undefined) updateRecord.venue = patch.venue
  if (patch.departments !== undefined)
    updateRecord.departments = patch.departments
  if (patch.batches !== undefined) updateRecord.batches = patch.batches
  if (patch.required_action !== undefined)
    updateRecord.requiredAction = patch.required_action
  if (patch.fees !== undefined) updateRecord.fees = patch.fees
  if (patch.contact !== undefined) updateRecord.contact = patch.contact
  if (patch.category !== undefined) updateRecord.category = patch.category
  if (patch.notice_no !== undefined) updateRecord.noticeNo = patch.notice_no
  if (patch.notice_summary_bn !== undefined)
    updateRecord.noticeSummaryBn = patch.notice_summary_bn
  if (patch.notice_summary_en !== undefined)
    updateRecord.noticeSummaryEn = patch.notice_summary_en
  if (patch.review_notes !== undefined)
    updateRecord.reviewNotes = patch.review_notes

  if (Object.keys(updateRecord).length) {
    await db.update(notice).set(updateRecord).where(eq(notice.id, id))
  }
}

export async function deleteNotice(id: number): Promise<void> {
  await db.delete(notice).where(eq(notice.id, id))
}

// ---------------------------------------------------------------------------
// Health check — static (notices no longer depend on a backend)
// ---------------------------------------------------------------------------

export interface BackendHealth {
  status: string
  service: string
  model: string
  llm?: {
    provider: string
    model: string
    key: string
    label: string
    available: boolean
  }
}

export async function getHealth(): Promise<BackendHealth | null> {
  try {
    return await request<BackendHealth>("/health")
  } catch {
    return null
  }
}

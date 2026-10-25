/** Mirrors the service's `ExtractionSchema` (service/core/schema.py). */

export type NoticeCategory =
  | "exam"
  | "registration"
  | "admission"
  | "fee"
  | "holiday"
  | "event"
  | "scholarship"
  | "result"
  | "general"

export type NoticeStatus = "draft" | "published" | "archived"

export interface NoticeRecord {
  id: number | null
  title: string | null
  issuing_office: string | null
  date_of_issue: string | null
  category: NoticeCategory
  deadline: string | null
  event_date_and_time: string | null
  venue: string | null
  departments: string | null
  batches: number[] | null
  required_action: string | null
  fees: string | null
  contact: string | null
  notice_no: string | null
  notice_summary_bn: string | null
  notice_summary_en: string | null
  raw_text: string | null
  source_type: string
  file_name: string | null
  status: NoticeStatus
  created_at: string | null
  published_at: string | null
  published_by: string | null
  review_notes: string | null
  version: number
}

export interface Department {
  code: string
  name: string
}

export interface Category {
  name: NoticeCategory
  display_name: string
  icon: string
}

/** The fields a staff member may edit. */
export interface NoticePatch {
  title?: string | null
  issuing_office?: string | null
  date_of_issue?: string | null
  deadline?: string | null
  event_date_and_time?: string | null
  venue?: string | null
  departments?: string | null
  batches?: number[] | null
  required_action?: string | null
  fees?: string | null
  contact?: string | null
  category?: NoticeCategory
  notice_no?: string | null
  notice_summary_bn?: string | null
  notice_summary_en?: string | null
  review_notes?: string | null
}

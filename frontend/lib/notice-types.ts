/** Mirrors the backend's `NoticeRecord` model (backend/pipeline/models.py). */

export interface NoticeDeadline {
  date: string
  description: string
}

export interface NoticeEventDateTime {
  date: string
  time: string | null
}

export interface NoticeTargetStudents {
  department: string | null
  batch: string | null
  semester: string | null
}

export interface NoticeFees {
  amount: number
  currency: string
}

export type NoticeCategory =
  | "exam"
  | "registration"
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
  deadlines: NoticeDeadline[] | null
  event_date_time: NoticeEventDateTime | null
  venue: string | null
  target_students: NoticeTargetStudents | null
  required_action: string | null
  fees: NoticeFees | null
  contact: string | null
  category: NoticeCategory
  summary_bengali: string | null
  summary_english: string | null
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
  deadlines?: NoticeDeadline[] | null
  event_date_time?: NoticeEventDateTime | null
  venue?: string | null
  target_students?: NoticeTargetStudents | null
  required_action?: string | null
  fees?: NoticeFees | null
  contact?: string | null
  category?: NoticeCategory
  summary_bengali?: string | null
  summary_english?: string | null
  review_notes?: string | null
}

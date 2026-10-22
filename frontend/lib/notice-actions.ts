"use server"

import { revalidatePath } from "next/cache"
import { headers } from "next/headers"
import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import {
  createNotice,
  deleteNotice,
  publishNotice,
  updateNotice,
} from "@/lib/backend-server"
import type { NoticeCategory, NoticePatch } from "@/lib/notice-types"

async function requireStaff() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) {
    redirect("/login")
  }
  const role = (session.user as { role?: string }).role
  if (role !== "staff" && role !== "admin") {
    redirect("/unauthorized")
  }
  return session
}

function revalidateNoticeViews() {
  revalidatePath("/dashboard")
  revalidatePath("/dashboard/notices")
  revalidatePath("/dashboard/manage-notice")
}

/** Payload sent by the upload workbench when a staff member saves a result. */
export interface SaveNoticeInput {
  title?: string | null
  issuing_office?: string | null
  date_of_issue?: string | null
  deadlines?: { date: string; description: string }[] | null
  event_date_time?: { date: string; time: string | null } | null
  venue?: string | null
  target_students?: {
    department: string | null
    batch: string | null
    semester: string | null
  } | null
  required_action?: string | null
  fees?: { amount: number; currency: string } | null
  contact?: string | null
  category?: NoticeCategory
  summary_bengali?: string | null
  summary_english?: string | null
  raw_text?: string | null
  file_name?: string | null
  source_type?: string
  /** Department / batch / semester typed by the user, if any. */
  department?: string
  batch?: string
  semester?: string
  /** Also publish right away. */
  publish?: boolean
}

export async function saveNoticeAction(input: SaveNoticeInput): Promise<{
  id?: number
  error?: string
}> {
  const session = await requireStaff()

  const department = input.department?.trim()
  const batch = input.batch?.trim()
  const semester = input.semester?.trim()
  const hasAudience = Boolean(department || batch || semester)

  try {
    const created = await createNotice({
      title: input.title ?? null,
      issuing_office: input.issuing_office ?? null,
      date_of_issue: input.date_of_issue ?? null,
      deadlines: input.deadlines ?? null,
      event_date_time: input.event_date_time ?? null,
      venue: input.venue ?? null,
      target_students: hasAudience
        ? {
            department: department || null,
            batch: batch || null,
            semester: semester || null,
          }
        : (input.target_students ?? null),
      required_action: input.required_action ?? null,
      fees: input.fees ?? null,
      contact: input.contact ?? null,
      category: input.category ?? "general",
      summary_bengali: input.summary_bengali ?? "",
      summary_english: input.summary_english ?? "",
      raw_text: input.raw_text ?? null,
      file_name: input.file_name ?? null,
      source_type: input.source_type ?? "photo",
      // Always create as a draft — publishing sets published_at/published_by.
      status: "draft",
    })

    if (input.publish) {
      const publishedBy =
        (session.user as { name?: string; email?: string }).name ||
        (session.user as { email?: string }).email ||
        "Staff Reviewer"
      await publishNotice(created.id, publishedBy)
    }

    revalidateNoticeViews()
    return { id: created.id }
  } catch (error) {
    return {
      error:
        error instanceof Error ? error.message : "Failed to save the notice",
    }
  }
}

export async function publishNoticeAction(formData: FormData): Promise<void> {
  await requireStaff()
  const id = Number(formData.get("noticeId"))
  const publishedBy =
    (formData.get("publishedBy") as string) || "Staff Reviewer"
  if (!Number.isFinite(id)) return

  await publishNotice(id, publishedBy)
  revalidateNoticeViews()
}

export async function deleteNoticeAction(formData: FormData): Promise<void> {
  await requireStaff()
  const id = Number(formData.get("noticeId"))
  if (!Number.isFinite(id)) return

  await deleteNotice(id)
  revalidateNoticeViews()
}

export async function updateNoticeAction(input: {
  id: number
  patch: NoticePatch
}): Promise<{ error?: string }> {
  await requireStaff()
  try {
    await updateNotice(input.id, input.patch)
    revalidateNoticeViews()
    return {}
  } catch (error) {
    return {
      error:
        error instanceof Error ? error.message : "Failed to update the notice",
    }
  }
}

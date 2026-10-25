"use server"

import { revalidatePath } from "next/cache"
import { requireStaff } from "@/lib/auth-guard"
import {
  createNotice,
  deleteNotice,
  publishNotice,
  updateNotice,
} from "@/lib/backend-server"
import { reindexNoticeById, unindexNotice } from "@/lib/lensbot/index-all"
import type { NoticeCategory, NoticePatch } from "@/lib/notice-types"

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
  deadline?: string | null
  event_date_and_time?: string | null
  venue?: string | null
  departments?: string | null
  batches?: number[] | null
  required_action?: string | null
  fees?: string | null
  contact?: string | null
  notice_no?: string | null
  category?: NoticeCategory
  notice_summary_bn?: string | null
  notice_summary_en?: string | null
  raw_text?: string | null
  file_name?: string | null
  source_type?: string
  /** Also publish right away. */
  publish?: boolean
}

export async function saveNoticeAction(input: SaveNoticeInput): Promise<{
  id?: number
  error?: string
}> {
  const { session } = await requireStaff()

  try {
    const created = await createNotice({
      title: input.title ?? null,
      issuing_office: input.issuing_office ?? null,
      date_of_issue: input.date_of_issue ?? null,
      deadline: input.deadline ?? null,
      event_date_and_time: input.event_date_and_time ?? null,
      venue: input.venue ?? null,
      departments: input.departments ?? null,
      batches: input.batches ?? null,
      required_action: input.required_action ?? null,
      fees: input.fees ?? null,
      contact: input.contact ?? null,
      notice_no: input.notice_no ?? null,
      category: input.category ?? "general",
      notice_summary_bn: input.notice_summary_bn ?? "",
      notice_summary_en: input.notice_summary_en ?? "",
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

    await reindexNoticeById(created.id)

    revalidateNoticeViews()
    return { id: created.id }
  } catch (error) {
    return {
      error:
        error instanceof Error ? error.message : "Failed to save the notice",
    }
  }
}

/**
 * Publishes a notice that is already saved as a draft, from the page the
 * staff member is standing on.
 */
export async function publishSavedNoticeAction(
  noticeId: number
): Promise<{ error?: string }> {
  const { session } = await requireStaff()
  const publishedBy =
    (session.user as { name?: string; email?: string }).name ||
    (session.user as { email?: string }).email ||
    "Staff Reviewer"

  try {
    await publishNotice(noticeId, publishedBy)
    await reindexNoticeById(noticeId)
    revalidateNoticeViews()
    return {}
  } catch (error) {
    return {
      error:
        error instanceof Error ? error.message : "Failed to publish the notice",
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
  await reindexNoticeById(id)
  revalidateNoticeViews()
}

export async function deleteNoticeAction(formData: FormData): Promise<void> {
  await requireStaff()
  const id = Number(formData.get("noticeId"))
  if (!Number.isFinite(id)) return

  await deleteNotice(id)
  await unindexNotice(id)
  revalidateNoticeViews()
}

export async function updateNoticeAction(input: {
  id: number
  patch: NoticePatch
}): Promise<{ error?: string }> {
  await requireStaff()
  try {
    await updateNotice(input.id, input.patch)
    await reindexNoticeById(input.id)
    revalidateNoticeViews()
    return {}
  } catch (error) {
    return {
      error:
        error instanceof Error ? error.message : "Failed to update the notice",
    }
  }
}

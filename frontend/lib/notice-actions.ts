"use server"

import { revalidatePath } from "next/cache"
import { requireStaff } from "@/lib/auth-guard"
import {
  createNotice,
  deleteNotice,
  listNotices,
  publishNotice,
  updateNotice,
} from "@/lib/backend-server"
import { reindexNoticeById, unindexNotice } from "@/lib/lensbot/index-all"
import type {
  NoticeCategory,
  NoticePatch,
  NoticeRecord,
} from "@/lib/notice-types"

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

// ---------------------------------------------------------------------------
// Duplicate detection
// ---------------------------------------------------------------------------

export interface DuplicateGroup {
  /** Mean pairwise similarity across the group (0–1). */
  similarity: number
  notices: NoticeRecord[]
}

/** Normalise a string into a set of lowercase word tokens. */
function tokenize(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .split(/[^\p{L}\p{N}]+/u)
      .filter(Boolean)
  )
}

/** Jaccard similarity between two token sets (0 when both empty). */
function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 0
  let intersection = 0
  for (const token of a) {
    if (b.has(token)) intersection++
  }
  return intersection / (a.size + b.size - intersection)
}

/** Combined word-set from title + both summary languages. */
function noticeTokens(record: NoticeRecord): Set<string> {
  return tokenize(
    [record.title, record.notice_summary_en, record.notice_summary_bn]
      .filter(Boolean)
      .join(" ")
  )
}

const DUPLICATE_THRESHOLD = 0.6

export async function findDuplicatesAction(): Promise<{
  groups?: DuplicateGroup[]
  error?: string
}> {
  await requireStaff()

  try {
    const { notices } = await listNotices({ status: "all", limit: 500 })

    // Pre-compute tokens for every notice once.
    const tokenCache = new Map<number, Set<string>>()
    for (const record of notices) {
      if (record.id != null) {
        tokenCache.set(record.id, noticeTokens(record))
      }
    }

    // Union-Find: group notices connected by a similarity edge.
    const parent = new Map<number, number>()
    const find = (x: number): number => {
      let root = parent.get(x) ?? x
      if (root !== x) {
        root = find(root)
        parent.set(x, root)
      }
      return root
    }
    const union = (a: number, b: number) => {
      const ra = find(a)
      const rb = find(b)
      if (ra !== rb) parent.set(ra, rb)
    }

    const edgeWeights = new Map<string, number>()
    const withId = notices.filter(
      (n): n is NoticeRecord & { id: number } => n.id != null
    )

    for (let i = 0; i < withId.length; i++) {
      for (let j = i + 1; j < withId.length; j++) {
        const a = withId[i]
        const b = withId[j]
        const ta = tokenCache.get(a.id)
        const tb = tokenCache.get(b.id)
        if (!ta || !tb) continue

        const sim = jaccard(ta, tb)
        if (sim >= DUPLICATE_THRESHOLD) {
          union(a.id, b.id)
          edgeWeights.set(`${a.id}-${b.id}`, sim)
        }
      }
    }

    // Collect groups from union-find roots.
    const clusters = new Map<number, (NoticeRecord & { id: number })[]>()
    for (const record of withId) {
      const root = find(record.id)
      const bucket = clusters.get(root) ?? []
      bucket.push(record)
      clusters.set(root, bucket)
    }

    // Build result groups (only clusters with 2+ members).
    const groups: DuplicateGroup[] = []
    for (const members of clusters.values()) {
      if (members.length < 2) continue

      // Mean similarity across all pairs in the cluster.
      let total = 0
      let count = 0
      for (let i = 0; i < members.length; i++) {
        for (let j = i + 1; j < members.length; j++) {
          const key = `${members[i].id}-${members[j].id}`
          const weight = edgeWeights.get(key)
          if (weight !== undefined) {
            total += weight
            count++
          }
        }
      }

      groups.push({
        similarity: count > 0 ? total / count : 0,
        notices: members,
      })
    }

    // Sort by similarity descending, then group size descending.
    groups.sort(
      (a, b) =>
        b.similarity - a.similarity || b.notices.length - a.notices.length
    )

    return { groups }
  } catch (error) {
    return {
      error:
        error instanceof Error ? error.message : "Failed to find duplicates",
    }
  }
}

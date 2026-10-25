import type { NoticeRecord } from "@/lib/notice-types"

/** How a notice relates to the signed-in person, decided by audience. */
export type NoticeAudience = "mine" | "all" | "other"

export interface NoticeCalendarEvent {
  id: number
  title: string
  start: Date
  end: Date
  allDay: boolean
  audience: NoticeAudience
}

/**
 * A notice is "all" when it targets every department — that signal is broader
 * and wins outright. Otherwise it is "mine" when the person's batch is in its
 * batch list, or the notice targets every batch (`-1`); anything left is
 * "other".
 */
export function noticeAudience(
  notice: NoticeRecord,
  batch: number | null
): NoticeAudience {
  const departments = (notice.departments ?? "").trim().toLowerCase()
  if (!departments || departments === "all") return "all"

  const batches = notice.batches ?? []
  const targetsEveryBatch = batches.includes(-1)
  const targetsMyBatch =
    batch !== null && Number.isInteger(batch) && batches.includes(batch)

  if (targetsEveryBatch || targetsMyBatch) return "mine"

  return "other"
}

function parseEventDate(value: string | null): Date | null {
  if (!value || value === "NONE") return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

/**
 * Turn published notices into calendar events. Placeholder dates ("NONE" or
 * unparseable) are skipped, because a wrong date is worse than no date.
 * One notice produces exactly one event, keyed on the stored event date.
 */
export function noticeCalendarEvents(
  notices: NoticeRecord[],
  batch: number | null
): NoticeCalendarEvent[] {
  const events: NoticeCalendarEvent[] = []

  for (const notice of notices) {
    if (notice.id == null) continue

    const start = parseEventDate(notice.event_date_and_time)
    if (!start) continue

    const end = new Date(start.getTime() + 60 * 60 * 1000)

    events.push({
      id: notice.id,
      title: notice.title?.trim() || notice.notice_no || "Untitled notice",
      start,
      end,
      allDay: false,
      audience: noticeAudience(notice, batch),
    })
  }

  return events
}

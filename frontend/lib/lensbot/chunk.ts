import type { NoticeRecord } from "@/lib/notice-types"

/**
 * How many characters a chunk holds and how much each chunk overlaps the one
 * before it. Overlap keeps a sentence that straddles a boundary retrievable
 * from either side.
 */
export const CHUNK_SIZE = 1200
export const CHUNK_OVERLAP = 200

const SENTINEL = new Set(["NONE", "", "-1", "all"])

function field(label: string, value: string | null | undefined): string | null {
  const trimmed = (value ?? "").trim()
  if (!trimmed || SENTINEL.has(trimmed)) return null
  return `${label}: ${trimmed}`
}

/**
 * The text a notice is indexed as. Everything a student might ask about is
 * present, in both languages where the extraction gave both, and the notice id
 * is carried in the header so a retrieved chunk is self-identifying.
 */
export function noticeToText(notice: NoticeRecord): string {
  const lines: string[] = []

  if (notice.title) lines.push(`Title: ${notice.title}`)
  lines.push(`Notice ID: ${notice.id ?? "unknown"}`)
  if (notice.notice_no) lines.push(`Notice number: ${notice.notice_no}`)
  lines.push(`Category: ${notice.category}`)

  for (const line of [
    field("Issuing office", notice.issuing_office),
    field("Date of issue", notice.date_of_issue),
    field("Deadline", notice.deadline),
    field("Event date", notice.event_date_and_time),
    field("Venue", notice.venue),
    field("Departments", notice.departments),
    notice.batches && !notice.batches.includes(-1)
      ? `Batches: ${notice.batches.join(", ")}`
      : null,
    field("Fees", notice.fees),
    field("Contact", notice.contact),
    field("Required action (Bangla)", notice.required_action),
  ]) {
    if (line) lines.push(line)
  }

  if (notice.notice_summary_en)
    lines.push(`Summary (English): ${notice.notice_summary_en}`)
  if (notice.notice_summary_bn)
    lines.push(`সারসংক্ষেপ (বাংলা): ${notice.notice_summary_bn}`)
  if (notice.raw_text) lines.push(`Full notice text:\n${notice.raw_text}`)

  return lines.join("\n")
}

/** Split a notice's text into overlapping chunks on paragraph/sentence edges. */
export function chunkNotice(notice: NoticeRecord): string[] {
  const text = noticeToText(notice)
  if (text.length <= CHUNK_SIZE) return [text]

  const chunks: string[] = []
  let start = 0

  while (start < text.length) {
    const hardEnd = Math.min(start + CHUNK_SIZE, text.length)
    let end = hardEnd

    if (hardEnd < text.length) {
      // Prefer to break at a paragraph, then a sentence, then a space.
      const window = text.slice(start, hardEnd)
      const breakAt = Math.max(
        window.lastIndexOf("\n\n"),
        window.lastIndexOf("।"), // Bengali full stop
        window.lastIndexOf(". "),
        window.lastIndexOf("\n")
      )
      if (breakAt > CHUNK_SIZE * 0.5) {
        end = start + breakAt + 1
      }
    }

    chunks.push(text.slice(start, end).trim())
    if (end >= text.length) break
    start = Math.max(end - CHUNK_OVERLAP, start + 1)
  }

  return chunks.filter((chunk) => chunk.length > 0)
}

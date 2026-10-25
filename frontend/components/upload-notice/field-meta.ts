/** The currencies a Pundra notice is likely to quote. */
export const CURRENCIES = ["BDT", "USD"] as const

/** True when a value carries no information worth showing. */
export function isBlank(value: string | number | null | undefined): boolean {
  if (value === null || value === undefined) return true
  if (typeof value === "number") return Number.isNaN(value)
  return value.trim().length === 0
}

/**
 * Days from today until `iso` (YYYY-MM-DD). Negative when the date is in
 * the past.
 */
export function daysUntil(iso: string): number | null {
  const parsed = Date.parse(`${iso}T00:00:00`)
  if (Number.isNaN(parsed)) return null
  const today = new Date()
  const start = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate()
  ).getTime()
  return Math.round((parsed - start) / 86_400_000)
}

/** "in 6 days" / "today" / "3 days ago" — null when the date is unreadable. */
export function relativeDays(iso: string): string | null {
  const days = daysUntil(iso)
  if (days === null) return null
  if (days === 0) return "today"
  if (days === 1) return "tomorrow"
  if (days === -1) return "yesterday"
  if (days > 0) return `in ${days} days`
  return `${Math.abs(days)} days ago`
}

/** "12 Jan 2026" — null when the date is unreadable. */
export function formatDate(iso: string | null | undefined): string | null {
  if (!iso) return null
  const parsed = Date.parse(iso.length === 10 ? `${iso}T00:00:00` : iso)
  if (Number.isNaN(parsed)) return null
  return new Date(parsed).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  })
}

/**
 * Formats a notice date for display: "Oct 18, 2026". Values the browser
 * cannot read — a Bangla date string, for instance — are handed back as they
 * came in, because a wrong date is worse than an unformatted one.
 */
export function formatDate(value: string | null | undefined): string {
  if (!value) return "—"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  })
}

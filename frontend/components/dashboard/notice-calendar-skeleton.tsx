import { Skeleton } from "@/components/ui/skeleton"
import { Spinner } from "@/components/ui/spinner"

/**
 * The calendar, before it exists. Paper-shaped tiles on a board, so the
 * overview keeps its layout while the notices stream in rather than
 * collapsing to a spinner on an empty page.
 */
export function NoticeCalendarSkeleton() {
  return (
    <section className="paper rounded-2xl p-6 sm:p-8">
      <div className="mb-5 flex items-center justify-between gap-3">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-4 w-64" />
        </div>
        <Skeleton className="h-8 w-48 rounded-4xl" />
      </div>

      <div className="flex items-center justify-center gap-2 py-24 text-sm text-muted-foreground">
        <Spinner className="size-4" />
        Loading this page …
      </div>

      <div className="mt-2 mb-4 grid grid-cols-7 gap-2">
        {Array.from({ length: 7 }).map((_, index) => (
          <Skeleton key={index} className="h-4" />
        ))}
      </div>
      <div className="grid grid-cols-7 gap-2">
        {Array.from({ length: 35 }).map((_, index) => (
          <Skeleton key={index} className="h-20" />
        ))}
      </div>
    </section>
  )
}

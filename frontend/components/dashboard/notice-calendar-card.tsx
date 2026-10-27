import type { NoticeCalendarEvent } from "@/lib/notice-calendar"

import { NoticeCalendar } from "./notice-calendar"

function LegendSwatch({
  className,
  label,
}: {
  className: string
  label: string
}) {
  return (
    <span className="flex items-center gap-2">
      <span className={className} aria-hidden />
      {label}
    </span>
  )
}

export function NoticeCalendarCard({
  events,
}: {
  events: NoticeCalendarEvent[]
}) {
  return (
    <section className="paper rounded-2xl p-6 sm:p-8">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h2 className="text-lg font-semibold">Notice calendar</h2>
          <p className="text-sm text-muted-foreground">
            Published notices placed on their event date.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
          <LegendSwatch
            className="size-3 rotate-[-4deg] rounded-[3px] bg-primary"
            label="Your batch"
          />
          <LegendSwatch
            className="size-3 rotate-[3deg] rounded-[3px] bg-warning"
            label="All departments"
          />
        </div>
      </div>
      <NoticeCalendar events={events} />
    </section>
  )
}

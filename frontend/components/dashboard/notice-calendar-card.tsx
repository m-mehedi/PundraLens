import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
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
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex flex-col gap-1">
            <CardTitle>Notice calendar</CardTitle>
            <CardDescription>
              Published notices placed on their event date.
            </CardDescription>
          </div>
          <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
            <LegendSwatch
              className="size-3 rounded-[3px] bg-primary"
              label="Your batch"
            />
            <LegendSwatch
              className="size-3 rounded-[3px] bg-warning"
              label="All departments"
            />
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <NoticeCalendar events={events} />
      </CardContent>
    </Card>
  )
}

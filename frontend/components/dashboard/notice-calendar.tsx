"use client"

import * as React from "react"
import { dateFnsLocalizer, type View } from "react-big-calendar"
import { format, getDay, parse, startOfWeek } from "date-fns"
import { enUS } from "date-fns/locale"

import ShadcnBigCalendar from "@/components/shadcn-big-calendar/shadcn-big-calendar"
import type {
  NoticeAudience,
  NoticeCalendarEvent,
} from "@/lib/notice-calendar"
import { cn } from "@/lib/utils"

const locales = { "en-US": enUS }

const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek,
  getDay,
  locales,
})

// `event-variant-primary`/`-outline` ship with the shadcn Big Calendar
// stylesheet; `-warning` is our own block in `app/globals.css`.
const AUDIENCE_CLASS: Record<NoticeAudience, string> = {
  mine: "event-variant-primary",
  all: "event-variant-warning",
  other: "event-variant-outline",
}

export function NoticeCalendar({
  events,
  className,
}: {
  events: NoticeCalendarEvent[]
  className?: string
}) {
  const [view, setView] = React.useState<View>("month")
  const [date, setDate] = React.useState<Date>(() => new Date())

  return (
    <div className={cn("notice-calendar", className)}>
      <ShadcnBigCalendar<NoticeCalendarEvent>
        localizer={localizer}
        events={events}
        view={view}
        onView={setView}
        date={date}
        onNavigate={setDate}
        views={["month", "week", "agenda"]}
        startAccessor="start"
        endAccessor="end"
        popup
        style={{ height: "70vh" }}
        eventPropGetter={(event) => ({
          className: AUDIENCE_CLASS[event.audience],
        })}
        components={{
          event: ({ event }) => (
            <span lang="bn" className="truncate">
              {event.title}
            </span>
          ),
        }}
      />
    </div>
  )
}

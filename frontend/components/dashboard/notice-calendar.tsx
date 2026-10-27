"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { dateFnsLocalizer, type View } from "react-big-calendar"
import type { ToolbarProps } from "react-big-calendar"
import { format, getDay, parse, startOfWeek } from "date-fns"
import { enUS } from "date-fns/locale"
import { motion } from "motion/react"
import { HugeiconsIcon } from "@hugeicons/react"
import { ArrowLeft01Icon, ArrowRight01Icon } from "@hugeicons/core-free-icons"

import ShadcnBigCalendar from "@/components/shadcn-big-calendar/shadcn-big-calendar"
import { Button } from "@/components/ui/button"
import type { NoticeAudience, NoticeCalendarEvent } from "@/lib/notice-calendar"
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
// stylesheet; `-warning` is our own block in `app/globals.css`. The class
// sets the pin colour, not a filled chip — the paper stays neutral.
const AUDIENCE_CLASS: Record<NoticeAudience, string> = {
  mine: "event-variant-primary",
  all: "event-variant-warning",
  other: "event-variant-outline",
}

/**
 * The month navigator. React Big Calendar's stock toolbar is replaced so the
 * calendar speaks the same quiet button language as the rest of the app.
 */
function CalendarToolbar({
  label,
  onNavigate,
}: ToolbarProps<NoticeCalendarEvent>) {
  return (
    <div className="mb-4 flex items-center justify-between gap-3">
      <span className="text-base font-semibold">{label}</span>
      <div className="flex items-center gap-1">
        <Button
          variant="outline"
          size="icon-sm"
          aria-label="Previous month"
          onClick={() => onNavigate("PREV")}
        >
          <HugeiconsIcon icon={ArrowLeft01Icon} />
        </Button>
        <Button variant="outline" size="sm" onClick={() => onNavigate("TODAY")}>
          Today
        </Button>
        <Button
          variant="outline"
          size="icon-sm"
          aria-label="Next month"
          onClick={() => onNavigate("NEXT")}
        >
          <HugeiconsIcon icon={ArrowRight01Icon} />
        </Button>
      </div>
    </div>
  )
}

export function NoticeCalendar({
  events,
  className,
}: {
  events: NoticeCalendarEvent[]
  className?: string
}) {
  const router = useRouter()
  const [date, setDate] = React.useState<Date>(() => new Date())

  const monthKey = format(date, "yyyy-MM")

  return (
    <div className={cn("notice-calendar", className)}>
      <motion.div
        key={monthKey}
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 420, damping: 32 }}
      >
        <ShadcnBigCalendar<NoticeCalendarEvent>
          localizer={localizer}
          events={events}
          view={"month" satisfies View}
          date={date}
          onNavigate={setDate}
          views={["month"]}
          popup
          style={{ height: "70vh" }}
          onSelectEvent={(event) => {
            if (event.id == null) return
            router.push(`/dashboard/notices/${event.id}`)
          }}
          eventPropGetter={(event) => ({
            className: AUDIENCE_CLASS[event.audience],
          })}
          components={{
            toolbar: CalendarToolbar,
            event: ({ event }) => (
              <span lang="bn" className="truncate">
                {event.title}
              </span>
            ),
          }}
        />
      </motion.div>
    </div>
  )
}

"use client"

import * as React from "react"
import { motion } from "motion/react"
import { HugeiconsIcon } from "@hugeicons/react"
import { CalendarClockIcon } from "@hugeicons/core-free-icons"

import { daysUntil, formatDate, relativeDays } from "./field-meta"

export interface DeadlineStampProps {
  deadlines: Array<{ date: string; description: string }>
}

interface ChosenDeadline {
  date: string
  description: string
  days: number
}

/**
 * Pick the deadline that matters: the nearest one still ahead, or — when
 * every deadline has passed — the most recent one.
 */
function chooseDeadline(
  deadlines: Array<{ date: string; description: string }>
): ChosenDeadline | null {
  const usable = deadlines
    .map((deadline) => {
      const days = daysUntil(deadline.date)
      if (days === null || !deadline.date) return null
      return {
        date: deadline.date,
        description: deadline.description,
        days,
      }
    })
    .filter((value): value is ChosenDeadline => value !== null)

  if (usable.length === 0) return null

  const upcoming = usable.filter((item) => item.days >= 0)
  const pool = upcoming.length > 0 ? upcoming : usable
  return pool.reduce((earliest, item) =>
    item.days < earliest.days ? item : earliest
  )
}

/**
 * The one thing a notice is really about: when it is due.
 *
 * It is also the field most often mis-read off a photograph, so it doubles
 * as a quick check on the extraction.
 */
export function DeadlineStamp({ deadlines }: DeadlineStampProps) {
  const chosen = React.useMemo(() => chooseDeadline(deadlines), [deadlines])

  if (!chosen) return null

  const isPast = chosen.days < 0
  const relative = relativeDays(chosen.date)
  const readable = formatDate(chosen.date)

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ type: "spring", stiffness: 420, damping: 28 }}
      className="flex items-start gap-2.5"
    >
      <HugeiconsIcon
        icon={CalendarClockIcon}
        className="mt-0.5 size-4 shrink-0 text-muted-foreground"
      />
      <div className="flex min-w-0 flex-col">
        <span className="text-xs text-muted-foreground">
          {isPast ? "Last deadline" : "Next deadline"}
        </span>
        <span className="text-lg leading-tight font-semibold tabular-nums">
          {readable ?? chosen.date}
        </span>
        <span
          className={
            isPast
              ? "text-xs text-destructive"
              : "text-xs text-muted-foreground"
          }
        >
          {relative}
          {chosen.description ? ` · ${chosen.description}` : ""}
        </span>
      </div>
    </motion.div>
  )
}

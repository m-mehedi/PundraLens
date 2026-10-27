"use client"

import Link from "next/link"
import { motion } from "motion/react"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  CalendarClockIcon,
  DocumentAttachmentIcon,
} from "@hugeicons/core-free-icons"

import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import type { NoticeRecord } from "@/lib/notice-types"
import { formatDate } from "@/lib/format-date"

/**
 * One slip of the grid. The required action is the reason the notice is
 * pinned up at all, so it leads; when the model could not read one the slip
 * says so plainly rather than leaving a hole.
 */
function NoticeSlip({
  notice,
  variant,
  index,
}: {
  notice: NoticeRecord
  variant: 1 | 2 | 3
  index: number
}) {
  const deadline = notice.deadline
  const hasDeadline = Boolean(deadline && deadline !== "NONE")
  const action = notice.required_action?.trim()

  const href = notice.id ? `/dashboard/notices/${notice.id}` : undefined

  const body = (
    <motion.article
      initial={{ opacity: 0, y: 10, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{
        type: "spring",
        stiffness: 420,
        damping: 28,
        delay: Math.min(index, 12) * 0.03,
      }}
      whileHover={{ y: -3 }}
      className={`notice-slip notice-slip-${variant} flex min-h-44 flex-col gap-3 p-6`}
    >
      <span aria-hidden className="notice-slip-tape" />

      <h3 className="text-[1.1875rem] leading-snug font-semibold text-balance">
        {notice.title ?? "Untitled notice"}
      </h3>

      <p className="text-[0.9375rem] text-muted-foreground">
        {formatDate(notice.date_of_issue)}
      </p>

      {action ? (
        <p className="text-[1.0625rem] leading-relaxed whitespace-pre-wrap text-foreground/90">
          {action}
        </p>
      ) : (
        <p className="text-[1.0625rem] text-muted-foreground">
          No action required.
        </p>
      )}

      {hasDeadline ? (
        <div className="mt-auto flex items-center gap-2 pt-2 text-[1.0625rem] font-medium">
          <HugeiconsIcon
            icon={CalendarClockIcon}
            className="size-5 shrink-0 text-muted-foreground"
          />
          <span className="tabular-nums">Due {formatDate(deadline)}</span>
        </div>
      ) : null}
    </motion.article>
  )

  return href ? (
    <Link
      href={href}
      className="block rounded-2xl outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      {body}
    </Link>
  ) : (
    body
  )
}

export function NoticeList({ notices }: { notices: NoticeRecord[] }) {
  if (notices.length === 0) {
    return (
      <Empty className="border border-dashed">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <HugeiconsIcon icon={DocumentAttachmentIcon} />
          </EmptyMedia>
          <EmptyTitle>No notices found</EmptyTitle>
          <EmptyDescription>
            Try clearing the filters, or check back once notices are published.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    )
  }

  return (
    <div className="grid gap-x-6 gap-y-8 sm:grid-cols-2 xl:grid-cols-3">
      {notices.map((notice, index) => (
        <NoticeSlip
          key={notice.id ?? notice.title ?? index}
          notice={notice}
          index={index}
          variant={((index % 3) + 1) as 1 | 2 | 3}
        />
      ))}
    </div>
  )
}

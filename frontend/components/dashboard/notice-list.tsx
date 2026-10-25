import Link from "next/link"
import { HugeiconsIcon } from "@hugeicons/react"
import { DocumentAttachmentIcon } from "@hugeicons/core-free-icons"

import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import type { NoticeRecord } from "@/lib/notice-types"
import { formatDate } from "@/lib/format-date"

import { CategoryBadge } from "./category-badge"

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
    <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
      {notices.map((notice) => {
        const deadline = notice.deadline
        const departments = notice.departments

        const href = notice.id
          ? `/dashboard/notices/${notice.id}`
          : undefined

        const card = (
          <Card key={notice.id ?? notice.title}>
            <CardHeader>
              <div className="flex items-start justify-between gap-2">
                <CardTitle className="text-base leading-snug">
                  {notice.title ?? "Untitled notice"}
                </CardTitle>
                <CategoryBadge
                  category={notice.category}
                  className="shrink-0"
                />
              </div>
              <CardDescription className="mt-1 text-xs">
                {notice.issuing_office ?? "Unknown office"} ·{" "}
                {formatDate(notice.date_of_issue)}
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-2 text-sm">
              {notice.notice_summary_bn ? (
                <p
                  className="line-clamp-3 leading-relaxed text-foreground/90"
                  lang="bn"
                >
                  {notice.notice_summary_bn}
                </p>
              ) : (
                <p className="text-muted-foreground">No summary available.</p>
              )}

              <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                {deadline && deadline !== "NONE" ? (
                  <Badge variant="outline">Due {formatDate(deadline)}</Badge>
                ) : null}
                {notice.fees && notice.fees !== "NONE" ? (
                  <Badge variant="outline">{notice.fees}</Badge>
                ) : null}
                {notice.venue ? (
                  <Badge variant="outline">{notice.venue}</Badge>
                ) : null}
                {departments && departments !== "all" ? (
                  <Badge variant="outline">{departments}</Badge>
                ) : null}
              </div>
            </CardContent>
          </Card>
        )

        return href ? (
          <Link
            key={notice.id ?? notice.title}
            href={href}
            className="rounded-lg transition-colors hover:bg-accent/50"
          >
            {card}
          </Link>
        ) : (
          card
        )
      })}
    </div>
  )
}

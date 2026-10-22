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

const CATEGORY_LABELS: Record<string, string> = {
  exam: "Examination",
  registration: "Registration",
  fee: "Fee",
  holiday: "Holiday",
  event: "Event",
  scholarship: "Scholarship",
  result: "Result",
  general: "General",
}

export function categoryLabel(category: string): string {
  return CATEGORY_LABELS[category] ?? category
}

function formatDate(value: string | null): string {
  if (!value) return "—"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  })
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
    <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
      {notices.map((notice) => {
        const deadline = notice.deadlines?.[0]
        const audience = notice.target_students

        return (
          <Card key={notice.id ?? notice.title}>
            <CardHeader>
              <div className="flex items-start justify-between gap-2">
                <CardTitle className="text-base leading-snug">
                  {notice.title ?? "Untitled notice"}
                </CardTitle>
                <Badge variant="secondary" className="shrink-0">
                  {categoryLabel(notice.category)}
                </Badge>
              </div>
              <CardDescription className="mt-1 text-xs">
                {notice.issuing_office ?? "Unknown office"} ·{" "}
                {formatDate(notice.date_of_issue)}
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-2 text-sm">
              {notice.summary_bengali ? (
                <p className="line-clamp-3 text-foreground/90">
                  {notice.summary_bengali}
                </p>
              ) : (
                <p className="text-muted-foreground">No summary available.</p>
              )}

              <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                {deadline ? (
                  <Badge variant="outline">
                    Due {formatDate(deadline.date)}
                  </Badge>
                ) : null}
                {notice.fees ? (
                  <Badge variant="outline">
                    {notice.fees.amount} {notice.fees.currency}
                  </Badge>
                ) : null}
                {notice.venue ? (
                  <Badge variant="outline">{notice.venue}</Badge>
                ) : null}
                {audience?.department ? (
                  <Badge variant="outline">{audience.department}</Badge>
                ) : null}
              </div>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}

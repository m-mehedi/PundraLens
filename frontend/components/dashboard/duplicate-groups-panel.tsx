"use client"

import Link from "next/link"
import { cn } from "cn"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  Delete02Icon,
  Edit02Icon,
  Search01Icon,
} from "@hugeicons/core-free-icons"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
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
import { Spinner } from "@/components/ui/spinner"
import { formatDate } from "@/lib/format-date"
import type { DuplicateGroup } from "@/lib/notice-actions"
import type { NoticeRecord } from "@/lib/notice-types"

import { CategoryBadge } from "./category-badge"

const STATUS_DOT: Record<string, string> = {
  published: "bg-success",
  draft: "bg-warning",
  archived: "bg-muted-foreground",
}

function similarityLabel(score: number): string {
  if (score >= 0.85) return "Very likely"
  if (score >= 0.7) return "Likely"
  return "Possible"
}

export interface DuplicateGroupsPanelProps {
  groups: DuplicateGroup[]
  deletingId: number | null
  onDelete: (notice: NoticeRecord) => void
}

export function DuplicateGroupsPanel({
  groups,
  deletingId,
  onDelete,
}: DuplicateGroupsPanelProps) {
  if (groups.length === 0) {
    return (
      <Empty className="m-6 border border-dashed">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <HugeiconsIcon icon={Search01Icon} strokeWidth={2} />
          </EmptyMedia>
          <EmptyTitle>No duplicates found</EmptyTitle>
          <EmptyDescription>
            All notices look distinct based on their titles and summaries.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    )
  }

  const total = groups.reduce((sum, group) => sum + group.notices.length, 0)

  return (
    <Card className="gap-0 py-0">
      <CardHeader className="py-4">
        <CardTitle>Duplicate groups</CardTitle>
        <CardDescription>
          {groups.length} {groups.length === 1 ? "group" : "groups"} covering{" "}
          {total} {total === 1 ? "notice" : "notices"}, compared by title and
          summary.
        </CardDescription>
      </CardHeader>

      <CardContent className="divide-y border-t px-0">
        {groups.map((group, groupIndex) => (
          <section key={groupIndex} className="flex flex-col">
            <div className="flex items-center gap-2 px-6 py-3">
              <Badge variant="outline">
                <span
                  className={cn(
                    "size-1.5 shrink-0 rounded-full",
                    group.similarity >= 0.85
                      ? "bg-destructive"
                      : group.similarity >= 0.7
                        ? "bg-warning"
                        : "bg-muted-foreground"
                  )}
                />
                {similarityLabel(group.similarity)} ·{" "}
                {Math.round(group.similarity * 100)}%
              </Badge>
              <span className="text-xs text-muted-foreground">
                {group.notices.length} similar notices
              </span>
            </div>

            <div className="divide-y border-t">
              {group.notices.map((notice) => (
                <div
                  key={notice.id}
                  className="flex items-center justify-between gap-4 px-6 py-3"
                >
                  <div className="flex min-w-0 flex-col gap-1">
                    <p className="truncate text-sm font-medium">
                      {notice.title ?? "Untitled notice"}
                    </p>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <CategoryBadge category={notice.category} />
                      <span className="flex items-center gap-1">
                        <span
                          className={cn(
                            "size-1.5 shrink-0 rounded-full",
                            STATUS_DOT[notice.status] ?? "bg-muted-foreground"
                          )}
                        />
                        {notice.status}
                      </span>
                      <span>{formatDate(notice.date_of_issue)}</span>
                    </div>
                  </div>

                  <div className="flex shrink-0 items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      render={
                        <Link
                          href={`/dashboard/manage-notice/${notice.id ?? ""}`}
                        />
                      }
                    >
                      <HugeiconsIcon icon={Edit02Icon} strokeWidth={2} />
                      <span className="sr-only">
                        Edit {notice.title ?? "untitled notice"}
                      </span>
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      disabled={deletingId === notice.id}
                      onClick={() => onDelete(notice)}
                    >
                      {deletingId === notice.id ? (
                        <Spinner />
                      ) : (
                        <HugeiconsIcon
                          icon={Delete02Icon}
                          strokeWidth={2}
                          className="text-destructive"
                        />
                      )}
                      <span className="sr-only">
                        Delete {notice.title ?? "untitled notice"}
                      </span>
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        ))}
      </CardContent>
    </Card>
  )
}

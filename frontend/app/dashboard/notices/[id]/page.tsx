import Link from "next/link"
import { notFound } from "next/navigation"

import { requireRole } from "@/lib/auth-guard"
import { getNotice } from "@/lib/backend-server"
import { formatDate } from "@/lib/format-date"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { CategoryBadge } from "@/components/dashboard/category-badge"

export const dynamic = "force-dynamic"

export default async function NoticeDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  await requireRole("student")

  const { id } = await params
  const noticeId = Number(id)
  if (!Number.isFinite(noticeId)) {
    notFound()
  }

  const notice = await getNotice(noticeId)
  if (!notice) {
    notFound()
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <Button
          variant="outline"
          size="sm"
          nativeButton={false}
          render={<Link href="/dashboard/notices" />}
        >
          Back to notices
        </Button>
        {notice.id ? (
          <span className="text-sm text-muted-foreground">
            Notice #{notice.id} · v{notice.version}
          </span>
        ) : null}
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-3">
            <CardTitle className="text-lg leading-snug">
              {notice.title ?? "Untitled notice"}
            </CardTitle>
            <div className="flex shrink-0 items-center gap-2">
              <CategoryBadge category={notice.category} />
              <Badge
                variant="outline"
                className={
                  notice.status === "published"
                    ? "text-success"
                    : notice.status === "draft"
                      ? "text-warning"
                      : "text-muted-foreground"
                }
              >
                {notice.status === "published"
                  ? "Published"
                  : notice.status === "draft"
                    ? "Draft"
                    : "Archived"}
              </Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-6">
          {/* Issuing office and date */}
          <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
            {notice.issuing_office ? (
              <div>
                <span className="text-muted-foreground">Issuing office:</span>{" "}
                {notice.issuing_office}
              </div>
            ) : null}
            {notice.date_of_issue ? (
              <div>
                <span className="text-muted-foreground">Date of issue:</span>{" "}
                {formatDate(notice.date_of_issue)}
              </div>
            ) : null}
            {notice.notice_no ? (
              <div>
                <span className="text-muted-foreground">Notice number:</span>{" "}
                {notice.notice_no}
              </div>
            ) : null}
          </div>

          {/* Summaries */}
          <div className="flex flex-col gap-4">
            {notice.notice_summary_bn ? (
              <div>
                <h3 className="mb-2 text-sm font-medium text-muted-foreground">
                  Summary (Bengali)
                </h3>
                <p
                  className="whitespace-pre-wrap leading-relaxed text-foreground/90"
                  lang="bn"
                >
                  {notice.notice_summary_bn}
                </p>
              </div>
            ) : null}
            {notice.notice_summary_en ? (
              <div>
                <h3 className="mb-2 text-sm font-medium text-muted-foreground">
                  Summary (English)
                </h3>
                <p className="whitespace-pre-wrap leading-relaxed">
                  {notice.notice_summary_en}
                </p>
              </div>
            ) : null}
            {!notice.notice_summary_bn && !notice.notice_summary_en ? (
              <p className="text-muted-foreground">No summary available.</p>
            ) : null}
          </div>

          {/* Details grid */}
          <div className="grid gap-4 sm:grid-cols-2">
            {notice.deadline && notice.deadline !== "NONE" ? (
              <div>
                <h3 className="mb-1 text-sm font-medium text-muted-foreground">
                  Deadline
                </h3>
                <p>{formatDate(notice.deadline)}</p>
              </div>
            ) : null}
            {notice.event_date_and_time ? (
              <div>
                <h3 className="mb-1 text-sm font-medium text-muted-foreground">
                  Event date &amp; time
                </h3>
                <p>{formatDate(notice.event_date_and_time)}</p>
              </div>
            ) : null}
            {notice.venue ? (
              <div>
                <h3 className="mb-1 text-sm font-medium text-muted-foreground">
                  Venue
                </h3>
                <p>{notice.venue}</p>
              </div>
            ) : null}
            {notice.fees && notice.fees !== "NONE" ? (
              <div>
                <h3 className="mb-1 text-sm font-medium text-muted-foreground">
                  Fees
                </h3>
                <p>{notice.fees}</p>
              </div>
            ) : null}
            {notice.departments && notice.departments !== "all" ? (
              <div>
                <h3 className="mb-1 text-sm font-medium text-muted-foreground">
                  Departments
                </h3>
                <p>{notice.departments}</p>
              </div>
            ) : null}
            {notice.batches && notice.batches.length > 0 ? (
              <div>
                <h3 className="mb-1 text-sm font-medium text-muted-foreground">
                  Batches
                </h3>
                <div className="flex flex-wrap gap-1.5">
                  {notice.batches.map((batch) => (
                    <Badge key={batch} variant="secondary">
                      {batch}
                    </Badge>
                  ))}
                </div>
              </div>
            ) : null}
            {notice.required_action ? (
              <div>
                <h3 className="mb-1 text-sm font-medium text-muted-foreground">
                  Required action
                </h3>
                <p className="whitespace-pre-wrap">
                  {notice.required_action}
                </p>
              </div>
            ) : null}
            {notice.contact ? (
              <div>
                <h3 className="mb-1 text-sm font-medium text-muted-foreground">
                  Contact
                </h3>
                <p>{notice.contact}</p>
              </div>
            ) : null}
          </div>

          {/* Metadata */}
          <div className="flex flex-wrap gap-x-6 gap-y-2 border-t pt-4 text-xs text-muted-foreground">
            {notice.published_by ? (
              <span>Published by {notice.published_by}</span>
            ) : null}
            {notice.published_at ? (
              <span>Published on {formatDate(notice.published_at)}</span>
            ) : null}
            {notice.created_at ? (
              <span>Created on {formatDate(notice.created_at)}</span>
            ) : null}
            {notice.source_type ? (
              <span>Source: {notice.source_type}</span>
            ) : null}
            {notice.file_name ? (
              <span>File: {notice.file_name}</span>
            ) : null}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

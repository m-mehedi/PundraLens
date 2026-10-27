import Link from "next/link"
import { notFound } from "next/navigation"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  ArrowLeft01Icon,
  CalendarClockIcon,
  CallIcon,
  Coins01Icon,
  HashIcon,
  Location01Icon,
  UserGroupIcon,
} from "@hugeicons/core-free-icons"

import { requireRole } from "@/lib/auth-guard"
import { getNotice } from "@/lib/backend-server"
import { formatDate } from "@/lib/format-date"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { NoticeSummaryToggle } from "@/components/dashboard/notice-summary-toggle"

export const dynamic = "force-dynamic"

function DetailItem({
  icon,
  label,
  children,
}: {
  icon: typeof HashIcon
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="flex items-start gap-2.5">
      <HugeiconsIcon
        icon={icon}
        className="mt-0.5 size-4 shrink-0 text-muted-foreground"
      />
      <div className="flex min-w-0 flex-col gap-0.5">
        <span className="text-xs text-muted-foreground">{label}</span>
        <span className="text-sm">{children}</span>
      </div>
    </div>
  )
}

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

  const action = notice.required_action?.trim()
  const hasDeadline = Boolean(notice.deadline && notice.deadline !== "NONE")
  const departments =
    notice.departments && notice.departments !== "all"
      ? notice.departments
      : notice.departments === "all"
        ? "All departments"
        : null
  const fees = notice.fees && notice.fees !== "NONE" ? notice.fees : null
  const hasDetails = Boolean(
    notice.venue ||
    fees ||
    departments ||
    (notice.batches && notice.batches.length > 0) ||
    notice.contact ||
    notice.notice_no
  )

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <Button
          variant="outline"
          size="sm"
          nativeButton={false}
          render={<Link href="/dashboard/notices" />}
        >
          <HugeiconsIcon icon={ArrowLeft01Icon} data-icon="inline-start" />
          Back to notices
        </Button>
      </div>

      <article className="paper paper-torn paper-torn-2 mx-auto w-full max-w-3xl p-7 sm:p-10">
        <span aria-hidden className="tape" />

        <header className="flex flex-col gap-2 pt-2">
          <h1 className="text-2xl leading-snug font-semibold text-balance">
            {notice.title ?? "Untitled notice"}
          </h1>
          <p className="text-sm text-muted-foreground">
            {notice.issuing_office ? `${notice.issuing_office} · ` : null}
            {formatDate(notice.date_of_issue)}
          </p>
        </header>

        <Separator className="my-6" />

        <section className="flex flex-col gap-4">
          <h2 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
            Required action
          </h2>
          {action ? (
            <p className="text-lg leading-relaxed whitespace-pre-wrap">
              {action}
            </p>
          ) : (
            <p className="text-lg text-muted-foreground">No action required.</p>
          )}

          {hasDeadline ? (
            <div className="mt-1 flex items-center gap-2 text-lg font-medium">
              <HugeiconsIcon
                icon={CalendarClockIcon}
                className="size-5 shrink-0 text-muted-foreground"
              />
              <span className="tabular-nums">
                Due {formatDate(notice.deadline)}
              </span>
            </div>
          ) : null}
        </section>

        <Separator className="my-6" />

        <section className="flex flex-col gap-3">
          <h2 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
            Summary
          </h2>
          <NoticeSummaryToggle
            summaryBn={notice.notice_summary_bn}
            summaryEn={notice.notice_summary_en}
          />
        </section>

        {hasDetails ? (
          <>
            <Separator className="my-6" />
            <section className="grid gap-5 sm:grid-cols-2">
              {notice.venue ? (
                <DetailItem icon={Location01Icon} label="Venue">
                  {notice.venue}
                </DetailItem>
              ) : null}
              {fees ? (
                <DetailItem icon={Coins01Icon} label="Fees">
                  {fees}
                </DetailItem>
              ) : null}
              {departments ? (
                <DetailItem icon={UserGroupIcon} label="Departments">
                  {departments}
                </DetailItem>
              ) : null}
              {notice.contact ? (
                <DetailItem icon={CallIcon} label="Contact">
                  {notice.contact}
                </DetailItem>
              ) : null}
              {notice.notice_no ? (
                <DetailItem icon={HashIcon} label="Notice number">
                  {notice.notice_no}
                </DetailItem>
              ) : null}
              {notice.batches && notice.batches.length > 0 ? (
                <DetailItem icon={HashIcon} label="Batches">
                  <span className="flex flex-wrap gap-1.5">
                    {notice.batches.map((batch) => (
                      <Badge key={batch} variant="secondary">
                        {batch === -1 ? "All batches" : String(batch)}
                      </Badge>
                    ))}
                  </span>
                </DetailItem>
              ) : null}
            </section>
          </>
        ) : null}

        {notice.published_by ||
        notice.published_at ||
        notice.source_type ||
        notice.file_name ||
        notice.id ? (
          <footer className="mt-8 flex flex-wrap gap-x-5 gap-y-1.5 border-t pt-4 text-xs text-muted-foreground">
            {notice.id ? <span>Notice #{notice.id}</span> : null}
            <span>Version {notice.version}</span>
            {notice.published_by ? (
              <span>Published by {notice.published_by}</span>
            ) : null}
            {notice.published_at ? (
              <span>Published {formatDate(notice.published_at)}</span>
            ) : null}
            {notice.source_type ? (
              <span>Source: {notice.source_type}</span>
            ) : null}
            {notice.file_name ? <span>File: {notice.file_name}</span> : null}
          </footer>
        ) : null}
      </article>
    </div>
  )
}

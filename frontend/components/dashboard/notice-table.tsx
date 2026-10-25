"use client"

import * as React from "react"
import Link from "next/link"
import { cn } from "cn"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  AlertCircleIcon,
  CheckmarkCircle01Icon,
  Delete02Icon,
  Edit02Icon,
} from "@hugeicons/core-free-icons"

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import {
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Spinner } from "@/components/ui/spinner"
import { runServerAction } from "@/lib/server-action-feedback"
import { formatDate } from "@/lib/format-date"
import type { NoticeRecord } from "@/lib/notice-types"

import { CategoryBadge } from "./category-badge"
import { RowActionsMenu } from "./row-actions-menu"

export interface NoticeTableProps {
  notices: NoticeRecord[]
  publishAction: (formData: FormData) => Promise<void>
  deleteAction: (formData: FormData) => Promise<void>
  publishedBy: string
}

/**
 * The status is carried by a dot rather than by the badge colour: a column of
 * notices can be triaged at a glance, and a draft — the one that still needs
 * work — is the one that stands out.
 */
const STATUS: Record<string, { label: string; dot: string }> = {
  published: { label: "Published", dot: "bg-success" },
  draft: { label: "Draft", dot: "bg-warning" },
  archived: { label: "Archived", dot: "bg-muted-foreground" },
}

export function NoticeTable({
  notices,
  publishAction,
  deleteAction,
  publishedBy,
}: NoticeTableProps) {
  const [pendingId, setPendingId] = React.useState<number | null>(null)
  const [deleteTarget, setDeleteTarget] = React.useState<NoticeRecord | null>(
    null
  )
  const [, startTransition] = React.useTransition()

  const deleting =
    deleteTarget !== null && pendingId !== null && pendingId === deleteTarget.id

  const handlePublish = (notice: NoticeRecord) => {
    const formData = new FormData()
    formData.set("noticeId", String(notice.id ?? ""))
    formData.set("publishedBy", publishedBy)

    setPendingId(notice.id)
    startTransition(async () => {
      try {
        await runServerAction(publishAction, formData, {
          success: "Notice published",
          error: "Could not publish the notice. Try again.",
        })
      } finally {
        setPendingId(null)
      }
    })
  }

  const handleDelete = () => {
    if (!deleteTarget) return

    const formData = new FormData()
    formData.set("noticeId", String(deleteTarget.id ?? ""))

    setPendingId(deleteTarget.id)
    startTransition(async () => {
      try {
        const succeeded = await runServerAction(deleteAction, formData, {
          success: "Notice deleted",
          error: "Could not delete the notice. Try again.",
        })
        if (succeeded) setDeleteTarget(null)
      } finally {
        setPendingId(null)
      }
    })
  }

  if (notices.length === 0) {
    return (
      <Empty className="m-6 border border-dashed">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <HugeiconsIcon icon={CheckmarkCircle01Icon} />
          </EmptyMedia>
          <EmptyTitle>No notices yet</EmptyTitle>
          <EmptyDescription>
            Uploaded notices appear here as drafts until they are published.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    )
  }

  return (
    <Card className="gap-0 py-0">
      <CardContent className="px-0">
        <Table>
          <TableCaption className="sr-only">
            Notices with their category, status and date of issue
          </TableCaption>
          <TableHeader>
            <TableRow className="h-12">
              <TableHead className="hover:bg-transparent">Notice</TableHead>
              <TableHead className="hidden w-[140px] hover:bg-transparent md:table-cell">
                Category
              </TableHead>
              <TableHead className="w-[120px] hover:bg-transparent">
                Status
              </TableHead>
              <TableHead className="hidden w-[150px] hover:bg-transparent md:table-cell">
                Issued
              </TableHead>
              <TableHead className="w-[60px] text-right hover:bg-transparent">
                <span className="sr-only">Actions</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {notices.map((notice) => {
              const status = STATUS[notice.status] ?? {
                label: notice.status,
                dot: "bg-muted-foreground",
              }

              return (
                <TableRow key={notice.id} className="h-14">
                  <TableCell className="px-6">
                    <div className="flex flex-col gap-0.5">
                      <p className="truncate font-medium">
                        {notice.title ?? "Untitled notice"}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {notice.issuing_office ?? "Unknown office"}
                      </p>
                    </div>
                  </TableCell>
                  <TableCell className="hidden md:table-cell">
                    <CategoryBadge category={notice.category} />
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">
                      <span
                        className={cn(
                          "size-1.5 shrink-0 rounded-full",
                          status.dot
                        )}
                      />
                      {status.label}
                    </Badge>
                  </TableCell>
                  <TableCell className="hidden text-sm text-muted-foreground md:table-cell">
                    {formatDate(notice.date_of_issue)}
                  </TableCell>
                  <TableCell className="text-right">
                    <RowActionsMenu
                      label={`Actions for ${notice.title ?? "untitled notice"}`}
                      pending={pendingId !== null && pendingId === notice.id}
                    >
                      <DropdownMenuGroup>
                        {notice.status !== "published" ? (
                          <DropdownMenuItem
                            onClick={() => handlePublish(notice)}
                          >
                            <HugeiconsIcon
                              icon={CheckmarkCircle01Icon}
                              strokeWidth={2}
                            />
                            Publish
                          </DropdownMenuItem>
                        ) : null}
                        <DropdownMenuItem
                          render={
                            <Link
                              href={`/dashboard/manage-notice/${notice.id ?? ""}`}
                            />
                          }
                        >
                          <HugeiconsIcon icon={Edit02Icon} strokeWidth={2} />
                          Edit
                        </DropdownMenuItem>
                      </DropdownMenuGroup>
                      <DropdownMenuSeparator />
                      <DropdownMenuGroup>
                        <DropdownMenuItem
                          variant="destructive"
                          onClick={() => setDeleteTarget(notice)}
                        >
                          <HugeiconsIcon icon={Delete02Icon} strokeWidth={2} />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuGroup>
                    </RowActionsMenu>
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </CardContent>

      <AlertDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogMedia>
              <HugeiconsIcon
                icon={AlertCircleIcon}
                strokeWidth={2}
                className="size-5 text-destructive"
              />
            </AlertDialogMedia>
            <AlertDialogTitle>Delete notice</AlertDialogTitle>
            <AlertDialogDescription>
              “{deleteTarget?.title ?? "Untitled notice"}” will be removed from
              the notice board permanently, and students will stop seeing it.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              size="sm"
              disabled={pendingId !== null}
              onClick={handleDelete}
              data-icon={deleting ? undefined : "inline-start"}
            >
              {deleting ? (
                <Spinner />
              ) : (
                <HugeiconsIcon icon={Delete02Icon} strokeWidth={2} />
              )}
              Delete notice
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  )
}

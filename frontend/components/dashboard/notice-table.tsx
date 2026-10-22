import Link from "next/link"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  AlertCircleIcon,
  CheckmarkCircle01Icon,
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
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import { categoryLabel } from "./notice-list"
import type { NoticeRecord } from "@/lib/notice-types"

export interface NoticeTableProps {
  notices: NoticeRecord[]
  publishAction: (formData: FormData) => Promise<void>
  deleteAction: (formData: FormData) => Promise<void>
  publishedBy: string
}

const STATUS_VARIANTS: Record<string, "default" | "secondary" | "outline"> = {
  published: "default",
  draft: "secondary",
  archived: "outline",
}

export function NoticeTable({
  notices,
  publishAction,
  deleteAction,
  publishedBy,
}: NoticeTableProps) {
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
          <TableHeader>
            <TableRow className="h-12">
              <TableHead className="hover:bg-transparent">Title</TableHead>
              <TableHead className="w-[140px] hover:bg-transparent">
                Category
              </TableHead>
              <TableHead className="w-[120px] hover:bg-transparent">
                Status
              </TableHead>
              <TableHead className="w-[150px] hover:bg-transparent">
                Date of issue
              </TableHead>
              <TableHead className="w-[220px] text-center hover:bg-transparent">
                Actions
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {notices.map((notice) => (
              <TableRow key={notice.id} className="h-14">
                <TableCell className="px-6">
                  <div className="flex flex-col gap-0.5">
                    <p className="truncate font-medium">
                      {notice.title ?? "Untitled notice"}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {notice.issuing_office ?? "Unknown office"}
                      {notice.published_by
                        ? ` · published by ${notice.published_by}`
                        : ""}
                    </p>
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant="secondary">
                    {categoryLabel(notice.category)}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Badge variant={STATUS_VARIANTS[notice.status] ?? "outline"}>
                    {notice.status}
                  </Badge>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {notice.date_of_issue ?? "—"}
                </TableCell>
                <TableCell className="text-center">
                  <div className="flex items-center justify-center gap-2">
                    {notice.status !== "published" ? (
                      <form action={publishAction}>
                        <input
                          type="hidden"
                          name="noticeId"
                          value={notice.id ?? ""}
                        />
                        <input
                          type="hidden"
                          name="publishedBy"
                          value={publishedBy}
                        />
                        <Button
                          type="submit"
                          size="sm"
                          data-icon="inline-start"
                        >
                          <HugeiconsIcon
                            icon={CheckmarkCircle01Icon}
                            strokeWidth={2}
                          />
                          Publish
                        </Button>
                      </form>
                    ) : null}

                    <Button
                      variant="outline"
                      size="sm"
                      nativeButton={false}
                      render={
                        <Link
                          href={`/dashboard/manage-notice/${notice.id ?? ""}`}
                        />
                      }
                    >
                      <HugeiconsIcon icon={Edit02Icon} strokeWidth={2} />
                      Edit
                    </Button>

                    <AlertDialog>
                      <AlertDialogTrigger
                        render={
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-destructive"
                            data-icon="inline-start"
                          >
                            <HugeiconsIcon
                              icon={AlertCircleIcon}
                              strokeWidth={2}
                            />
                            Delete
                          </Button>
                        }
                      />
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
                            Are you sure you want to delete “
                            {notice.title ?? "Untitled notice"}”? This removes
                            it permanently.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <form action={deleteAction}>
                            <input
                              type="hidden"
                              name="noticeId"
                              value={notice.id ?? ""}
                            />
                            <AlertDialogAction
                              type="submit"
                              variant="destructive"
                              size="sm"
                            >
                              Delete notice
                            </AlertDialogAction>
                          </form>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}

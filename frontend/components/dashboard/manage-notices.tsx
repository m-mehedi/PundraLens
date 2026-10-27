"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  AlertCircleIcon,
  Copy01Icon,
  Delete02Icon,
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
import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import { deleteNoticeAction, findDuplicatesAction } from "@/lib/notice-actions"
import type { DuplicateGroup } from "@/lib/notice-actions"
import type { Department, NoticeRecord } from "@/lib/notice-types"

import { DuplicateGroupsPanel } from "./duplicate-groups-panel"
import { NoticeFilters } from "./notice-filters"
import { NoticeTable } from "./notice-table"

export interface ManageNoticesProps {
  notices: NoticeRecord[]
  count: number
  departments: Department[]
  publishAction: (formData: FormData) => Promise<void>
  deleteAction: (formData: FormData) => Promise<void>
  publishedBy: string
}

/**
 * The manage-notice workspace: one toolbar (search, status pills, category
 * and department selects, plus the duplicates utility) over a main area that
 * shows either the notice table or — once a duplicate scan has results — the
 * duplicate groups panel in its place, so the page never jumps around.
 */
export function ManageNotices({
  notices,
  count,
  departments,
  publishAction,
  deleteAction,
  publishedBy,
}: ManageNoticesProps) {
  const router = useRouter()
  const [pending, startTransition] = React.useTransition()
  const [groups, setGroups] = React.useState<DuplicateGroup[] | null>(null)
  const [deleteTarget, setDeleteTarget] = React.useState<NoticeRecord | null>(
    null
  )
  const [deletingId, setDeletingId] = React.useState<number | null>(null)

  const handleFind = () => {
    startTransition(async () => {
      const result = await findDuplicatesAction()
      if (result.error) {
        toast.error(result.error)
        return
      }
      setGroups(result.groups ?? [])
    })
  }

  const handleClear = () => setGroups(null)

  const handleDelete = () => {
    if (!deleteTarget) return

    const formData = new FormData()
    formData.set("noticeId", String(deleteTarget.id ?? ""))

    setDeletingId(deleteTarget.id)
    startTransition(async () => {
      try {
        await deleteNoticeAction(formData)
        toast.success("Notice deleted")
        // Remove the deleted notice from the current groups.
        setGroups(
          (prev) =>
            prev
              ?.map((group) => ({
                ...group,
                notices: group.notices.filter((n) => n.id !== deleteTarget.id),
              }))
              .filter((group) => group.notices.length >= 2) ?? null
        )
        setDeleteTarget(null)
        router.refresh()
      } catch {
        toast.error("Could not delete the notice. Try again.")
      } finally {
        setDeletingId(null)
      }
    })
  }

  return (
    <div className="flex flex-col gap-6">
      <NoticeFilters
        departments={departments}
        showStatus
        defaultStatus="all"
        count={count}
        shown={notices.length}
        actions={
          <>
            <Button
              variant="outline"
              size="sm"
              disabled={pending}
              onClick={handleFind}
              data-icon={pending ? undefined : "inline-start"}
            >
              {pending ? (
                <Spinner />
              ) : (
                <HugeiconsIcon icon={Copy01Icon} strokeWidth={2} />
              )}
              {pending
                ? "Scanning…"
                : groups === null
                  ? "Find duplicates"
                  : "Rescan"}
            </Button>

            {groups !== null && !pending ? (
              <Button variant="ghost" size="sm" onClick={handleClear}>
                Clear
              </Button>
            ) : null}
          </>
        }
      />

      {groups !== null ? (
        <DuplicateGroupsPanel
          groups={groups}
          deletingId={deletingId}
          onDelete={setDeleteTarget}
        />
      ) : (
        <NoticeTable
          notices={notices}
          publishAction={publishAction}
          deleteAction={deleteAction}
          publishedBy={publishedBy}
        />
      )}

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
            <AlertDialogTitle>Delete duplicate notice</AlertDialogTitle>
            <AlertDialogDescription>
              “{deleteTarget?.title ?? "Untitled notice"}” will be removed from
              the notice board permanently. Make sure the other notices in this
              group cover the same information before deleting.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              size="sm"
              disabled={deletingId !== null}
              onClick={handleDelete}
              data-icon={deletingId !== null ? undefined : "inline-start"}
            >
              {deletingId !== null ? (
                <Spinner />
              ) : (
                <HugeiconsIcon icon={Delete02Icon} strokeWidth={2} />
              )}
              Delete notice
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

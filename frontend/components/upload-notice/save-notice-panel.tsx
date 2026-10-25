"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { HugeiconsIcon } from "@hugeicons/react"
import { ArrowRight01Icon, Tick02Icon } from "@hugeicons/core-free-icons"
import { toast } from "sonner"

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import {
  saveNoticeAction,
  publishSavedNoticeAction,
  type SaveNoticeInput,
} from "@/lib/notice-actions"

export interface SaveNoticePanelProps {
  /** The payload the save action expects, built from the corrected form. */
  buildInput: () => SaveNoticeInput
  /** How many fields still need a human look. */
  missingCount: number
  /** True when the form differs from what the model produced. */
  isDirty: boolean
  /** Clear the workbench so another notice can be uploaded. */
  onResetAll: () => void
  /** Called once the notice is safely on the board. */
  onSaved?: () => void
}

/**
 * The last step: put the notice on the board.
 *
 * Drafts stay hidden from the students until they are published, so
 * "save" is always safe and "publish" is the one that reaches the world.
 */
export function SaveNoticePanel({
  buildInput,
  missingCount,
  isDirty,
  onResetAll,
  onSaved,
}: SaveNoticePanelProps) {
  const router = useRouter()
  const [isSaving, setIsSaving] = React.useState<"draft" | "publish" | null>(
    null
  )
  const [savedId, setSavedId] = React.useState<number | null>(null)
  const [isPublished, setIsPublished] = React.useState(false)
  const [isConfirming, setIsConfirming] = React.useState(false)

  const input = buildInput()
  const hasTitle = Boolean(input.title?.trim())
  const needsCheck = missingCount > 0

  const save = async (publish: boolean) => {
    setIsSaving(publish ? "publish" : "draft")
    const result = await saveNoticeAction({ ...input, publish })
    setIsSaving(null)

    if (result.error) {
      toast.error(result.error)
      return
    }

    setSavedId(result.id ?? null)
    setIsPublished(publish)
    // The notice is on the board, so the draft kept in the browser has
    // done its job.
    onSaved?.()
    toast.success(publish ? "Notice published" : "Notice saved as draft", {
      description: `Notice #${result.id}`,
    })
    router.refresh()
  }

  /** Put a notice that is already saved as a draft on the board. */
  const publish = async () => {
    if (savedId === null) return
    setIsSaving("publish")
    const result = await publishSavedNoticeAction(savedId)
    setIsSaving(null)

    if (result.error) {
      toast.error(result.error)
      return
    }

    setIsPublished(true)
    toast.success("Notice published", {
      description: `Notice #${savedId}`,
    })
    router.refresh()
  }

  if (savedId !== null) {
    return (
      <div className="sticky bottom-0 z-10 flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-card p-4 shadow-sm">
        <p className="flex items-center gap-2 text-sm">
          <HugeiconsIcon
            icon={Tick02Icon}
            className="size-4 text-primary"
            aria-hidden
          />
          {isPublished
            ? `Published as notice #${savedId}`
            : `Saved as notice #${savedId}`}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          {!isPublished ? (
            <Button
              size="sm"
              onClick={() => void publish()}
              disabled={isSaving !== null}
            >
              {isSaving === "publish" ? (
                <Spinner data-icon="inline-start" />
              ) : null}
              {isSaving === "publish" ? "Publishing…" : "Publish now"}
            </Button>
          ) : null}
          <Button
            variant="outline"
            size="sm"
            nativeButton={false}
            render={<Link href={`/dashboard/manage-notice/${savedId}`} />}
          >
            View the notice
            <HugeiconsIcon icon={ArrowRight01Icon} data-icon="inline-end" />
          </Button>
          <Button
            size="sm"
            onClick={() => {
              onResetAll()
              router.refresh()
            }}
          >
            Upload another notice
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="sticky bottom-0 z-10 flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-card p-4 shadow-sm">
      <p className="text-sm text-muted-foreground">
        {!hasTitle
          ? "Give the notice a title before it can be saved."
          : needsCheck
            ? `${missingCount} ${missingCount === 1 ? "field" : "fields"} still ${missingCount === 1 ? "needs" : "need"} a check.`
            : isDirty
              ? "The corrections are not on the board yet."
              : "Ready to save."}
      </p>

      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant="outline"
          onClick={() => void save(false)}
          disabled={isSaving !== null || !hasTitle}
        >
          {isSaving === "draft" ? <Spinner data-icon="inline-start" /> : null}
          {isSaving === "draft" ? "Saving…" : "Save as draft"}
        </Button>

        {needsCheck ? (
          <AlertDialog open={isConfirming} onOpenChange={setIsConfirming}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>
                  {missingCount} {missingCount === 1 ? "field" : "fields"} still
                  need a check
                </AlertDialogTitle>
                <AlertDialogDescription>
                  Publishing now puts the notice on the board with those fields
                  empty. Students will see it straight away.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Keep editing</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => void save(true)}
                  disabled={isSaving !== null}
                >
                  {isSaving === "publish" ? "Publishing…" : "Publish anyway"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        ) : null}

        <Button
          onClick={() => {
            if (needsCheck) {
              setIsConfirming(true)
              return
            }
            void save(true)
          }}
          disabled={isSaving !== null || !hasTitle}
        >
          {isSaving === "publish" ? <Spinner data-icon="inline-start" /> : null}
          {isSaving === "publish" ? "Publishing…" : "Save & publish"}
        </Button>
      </div>
    </div>
  )
}

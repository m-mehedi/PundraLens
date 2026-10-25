"use client"

import * as React from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import { Cancel01Icon } from "@hugeicons/core-free-icons"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"

import {
  deleteDraft,
  loadDraft,
  markDraftPrompted,
  type DraftDocument,
} from "@/lib/draft-store"

export interface DraftRestorePromptProps {
  userId: string
  draftId: string
  /** Put the draft back into the editor. */
  onLoad: (draft: DraftDocument) => void
}

interface DraftToastProps {
  id: string | number
  draft: DraftDocument
  onLoad: (draft: DraftDocument) => void
  onStartFresh: () => void
}

/**
 * The question, asked in the corner of the screen.
 *
 * A dialog in the middle of the screen stops the work dead; the draft is
 * offered instead, and the screen carries on while the answer is pending.
 */
function DraftToast({ id, draft, onLoad, onStartFresh }: DraftToastProps) {
  const savedAt = new Date(draft.savedAt)

  return (
    <div className="relative flex w-80 flex-col gap-3 rounded-xl border bg-card p-3 text-card-foreground shadow-lg">
      <Button
        variant="ghost"
        size="icon-xs"
        onClick={() => toast.dismiss(id)}
        aria-label="Dismiss"
        className="absolute top-1.5 right-1.5"
      >
        <HugeiconsIcon icon={Cancel01Icon} />
      </Button>

      <div className="flex flex-col gap-1 pr-5">
        <p className="text-sm font-medium">
          Load your previous unsaved changes?
        </p>
        <p className="text-xs text-muted-foreground">
          A draft from {savedAt.toLocaleString()} is in this browser —{" "}
          {draft.items.length} {draft.items.length === 1 ? "page" : "pages"}.
        </p>
      </div>

      <div className="flex gap-2">
        <Button
          size="xs"
          variant="outline"
          onClick={() => {
            toast.dismiss(id)
            onStartFresh()
          }}
        >
          Start fresh
        </Button>
        <Button
          size="xs"
          onClick={() => {
            toast.dismiss(id)
            onLoad(draft)
          }}
        >
          Load draft
        </Button>
      </div>
    </div>
  )
}

/**
 * "There is work you did not finish. Do you want it back?"
 *
 * The draft lives in this browser only, so it is offered rather than
 * restored behind the user's back — and it is thrown away for good when
 * they say no. The offer is a toast in the corner, not a dialog in the
 * face: the workbench is still usable while the question is pending.
 *
 * The question is asked once. A draft that has been offered is not
 * offered again, so it cannot follow anyone around the screen.
 */
export function DraftRestorePrompt({
  userId,
  draftId,
  onLoad,
}: DraftRestorePromptProps) {
  // The offer is published once. The callback is kept in a ref so a new
  // function identity on every render cannot ask for it again.
  const onLoadRef = React.useRef(onLoad)
  React.useEffect(() => {
    onLoadRef.current = onLoad
  }, [onLoad])

  React.useEffect(() => {
    let cancelled = false
    void (async () => {
      const found = await loadDraft(userId, draftId)
      if (cancelled || !found || found.prompted) return
      // Asked once: the draft is marked before the toast is published.
      await markDraftPrompted(userId, draftId)
      if (cancelled) return
      toast.custom(
        (toastId) => (
          <DraftToast
            id={toastId}
            draft={found}
            onLoad={(draft) => onLoadRef.current(draft)}
            onStartFresh={() => {
              void deleteDraft(userId, draftId)
            }}
          />
        ),
        { duration: Infinity, unstyled: true }
      )
    })()
    return () => {
      cancelled = true
    }
  }, [userId, draftId])

  // The offer is a toast, so there is nothing to draw here.
  return null
}

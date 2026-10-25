"use client"

import * as React from "react"
import Image from "next/image"
import { AnimatePresence, motion } from "motion/react"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  ArrowDown01Icon,
  Copy01Icon,
  ImageAddIcon,
  RefreshIcon,
} from "@hugeicons/core-free-icons"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { Separator } from "@/components/ui/separator"

import { ModelPicker } from "@/components/model-picker"

import type { ModelOption } from "./types"

function Disclosure({
  title,
  children,
  defaultOpen = false,
}: {
  title: string
  children: React.ReactNode
  defaultOpen?: boolean
}) {
  const [open, setOpen] = React.useState(defaultOpen)

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger className="flex w-full items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground">
        <HugeiconsIcon
          icon={ArrowDown01Icon}
          className="size-3.5 transition-transform duration-150"
          style={{ transform: open ? "rotate(180deg)" : undefined }}
        />
        {title}
      </CollapsibleTrigger>
      <CollapsibleContent className="flex flex-col gap-3 pt-3">
        {children}
      </CollapsibleContent>
    </Collapsible>
  )
}

export interface NoticeSheetProps {
  /** The photo the user picked, as a blob URL. */
  sourceUrl: string | null
  sourceName: string | null
  /** The natural width and height of the photo. */
  sourceWidth: number
  sourceHeight: number
  /** The rectified notice the backend actually read. */
  previewImageSrc: string | null
  cornerCount: number
  pendingChanges: number
  models: ModelOption[]
  model: string
  onModelChange: (model: string) => void
  rawText: string | null
  deadline: string
  onGoToEdit: () => void
  onChoosePhoto: (file: File) => void
}

/**
 * What the machine saw.
 *
 * The notice on the board is a photograph, so the staff member's first
 * question is always "did it read the right page?". The rectified preview
 * answers it — that is the page, flattened, exactly as the model received
 * it.
 */
export function NoticeSheet({
  sourceUrl,
  sourceName,
  sourceWidth,
  sourceHeight,
  previewImageSrc,
  cornerCount,
  pendingChanges,
  models,
  model,
  onModelChange,
  rawText,
  deadline,
  onGoToEdit,
  onChoosePhoto,
}: NoticeSheetProps) {
  const fileInputRef = React.useRef<HTMLInputElement | null>(null)
  const activeModel = models.find((option) => option.key === model)

  // The frame takes the shape of whatever is on it: the photo as it was
  // taken, or the rectified page the model read. A fixed frame would
  // letterbox a portrait notice into a strip.
  const aspect =
    previewImageSrc || !sourceWidth || !sourceHeight
      ? "4 / 3"
      : `${sourceWidth} / ${sourceHeight}`

  return (
    <div className="flex flex-col gap-4">
      <div
        className="relative w-full overflow-hidden rounded-xl border bg-muted"
        style={{ aspectRatio: aspect }}
      >
        {previewImageSrc || sourceUrl ? (
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.div
              key={previewImageSrc ? "warped" : "source"}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="absolute inset-0"
            >
              <Image
                src={(previewImageSrc ?? sourceUrl) as string}
                alt={
                  previewImageSrc
                    ? "The notice as the model read it"
                    : "The photo of the notice"
                }
                fill
                unoptimized
                className="object-contain"
              />
            </motion.div>
          </AnimatePresence>
        ) : (
          // A typed notice has no photo to show.
          <div className="absolute inset-0 flex items-center justify-center px-6 text-center text-sm text-muted-foreground">
            This notice was typed, not photographed.
          </div>
        )}
      </div>

      {deadline && deadline !== "NONE" ? (
        <>
          <div className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground">Deadline:</span>
            <span className="font-medium">{deadline}</span>
          </div>
          <Separator />
        </>
      ) : null}

      <div className="flex flex-col gap-1 text-sm">
        <span className="truncate font-medium">{sourceName ?? "No photo"}</span>
        <span className="text-muted-foreground">
          {cornerCount} of 4 corners placed
          {pendingChanges > 0
            ? ` · ${pendingChanges} unconfirmed ${pendingChanges === 1 ? "change" : "changes"}`
            : ""}
        </span>
        {activeModel ? (
          <span className="text-muted-foreground">
            Reading with {activeModel.label}
          </span>
        ) : null}
      </div>

      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="outline" onClick={onGoToEdit}>
          <HugeiconsIcon icon={RefreshIcon} data-icon="inline-start" />
          Edit the photo
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => fileInputRef.current?.click()}
        >
          <HugeiconsIcon icon={ImageAddIcon} data-icon="inline-start" />
          Use another photo
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="sr-only"
          onChange={(event) => {
            const file = event.target.files?.[0]
            if (file) onChoosePhoto(file)
            event.target.value = ""
          }}
        />
      </div>

      <Separator />

      <Disclosure title="Advanced">
        <ModelPicker
          models={models}
          value={model}
          onChange={onModelChange}
          label="Reading model"
          id="extract-model"
          description="Leave this on the default unless you are comparing models."
        />
      </Disclosure>

      {rawText ? (
        <Disclosure title="Original text">
          <p className="text-xs text-muted-foreground">
            The text as it was read off the page, before it was pulled into
            fields.
          </p>
          <div className="max-h-64 overflow-auto rounded-lg border bg-muted/50 p-3">
            <pre className="font-mono text-xs leading-relaxed whitespace-pre-wrap">
              {rawText}
            </pre>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={() =>
              navigator.clipboard
                .writeText(rawText)
                .then(() => toast.success("Copied to clipboard"))
                .catch(() => toast.error("Failed to copy"))
            }
          >
            <HugeiconsIcon icon={Copy01Icon} data-icon="inline-start" />
            Copy the original text
          </Button>
        </Disclosure>
      ) : null}
    </div>
  )
}

"use client"

import * as React from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  Add01Icon,
  ArrowDown01Icon,
  ArrowUp01Icon,
  Delete02Icon,
  File01Icon,
  Tick02Icon,
} from "@hugeicons/core-free-icons"
import { motion } from "motion/react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

import { MiddleTruncate } from "./middle-truncate"
import type { NoticeItem } from "./types"

export interface PagePanelProps {
  items: NoticeItem[]
  activeId: string | null
  onSelect: (id: string) => void
  onPrevious: () => void
  onNext: () => void
  /** Take a page out of the document. */
  onRemove: (id: string) => void
  /** Add more photos or pages to the document. */
  onAdd: (files: File[]) => void
  /** A thumbnail could not be loaded — draw it again. */
  onThumbnailError?: (id: string) => void
  /** The pages that have already been read. */
  extractedIds?: string[]
}

/** The height of a thumbnail, in pixels. */
const THUMB_HEIGHT = 68

/**
 * The pages of the document, standing in a column beside the canvas.
 *
 * The panel keeps to the edge of the screen, so the photo and its handles
 * are never covered. Each thumbnail keeps the shape of the page it shows,
 * so a portrait scan and a landscape photo are told apart at a glance.
 */
export function PagePanel({
  items,
  activeId,
  onSelect,
  onPrevious,
  onNext,
  onRemove,
  onAdd,
  onThumbnailError,
  extractedIds = [],
}: PagePanelProps) {
  const activeRef = React.useRef<HTMLButtonElement | null>(null)
  const fileInputRef = React.useRef<HTMLInputElement | null>(null)
  // The thumbnails that failed to load, so a broken picture never shows.
  const [broken, setBroken] = React.useState<Record<string, boolean>>({})

  // Keep the open page in sight when it changes from somewhere else — but
  // only as far as it has to, so the other pages stay on screen.
  React.useEffect(() => {
    activeRef.current?.scrollIntoView({
      block: "nearest",
      behavior: "smooth",
    })
  }, [activeId])

  if (items.length === 0) return null

  return (
    <aside
      aria-label="Pages of this document"
      className="flex h-full w-[136px] shrink-0 flex-col gap-2 rounded-xl border bg-muted/40 p-2"
    >
      <div className="flex items-center justify-between gap-1 px-1">
        <span className="text-xs font-medium text-muted-foreground">Pages</span>
        <div className="flex items-center gap-1">
          <span className="text-xs text-muted-foreground tabular-nums">
            {items.length}
          </span>
          <Button
            variant="ghost"
            size="icon-xs"
            onClick={onPrevious}
            disabled={items.length < 2}
            aria-label="Previous page"
            title="Previous page"
          >
            <HugeiconsIcon icon={ArrowUp01Icon} />
          </Button>
          <Button
            variant="ghost"
            size="icon-xs"
            onClick={onNext}
            disabled={items.length < 2}
            aria-label="Next page"
            title="Next page"
          >
            <HugeiconsIcon icon={ArrowDown01Icon} />
          </Button>
        </div>
      </div>

      <div
        role="listbox"
        aria-label="Pages of this document"
        className="page-scroll flex min-h-0 flex-1 flex-col items-center gap-3 overflow-y-auto"
      >
        {items.map((item) => {
          const isActive = item.id === activeId
          const isExtracted = extractedIds.includes(item.id)
          const isBroken = broken[item.id] === true
          // The thumbnail keeps the shape of the page it shows.
          const ratio =
            item.sourceWidth > 0 && item.sourceHeight > 0
              ? item.sourceWidth / item.sourceHeight
              : 3 / 4
          const thumbWidth = Math.round(THUMB_HEIGHT * ratio)

          return (
            <div
              key={item.id}
              className="group relative shrink-0"
              style={{ width: thumbWidth }}
            >
              <button
                ref={isActive ? activeRef : undefined}
                type="button"
                role="option"
                aria-selected={isActive}
                onClick={() => onSelect(item.id)}
                title={item.sourceFile.name}
                className={cn(
                  "group relative block overflow-hidden rounded-md border bg-card transition-[opacity,transform] duration-150",
                  isActive
                    ? "border-transparent"
                    : "border-border opacity-60 hover:opacity-100"
                )}
                style={{ width: thumbWidth }}
              >
                {item.thumbUrl && !isBroken ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={item.thumbUrl}
                    alt={item.label}
                    className="block bg-muted object-cover"
                    style={{ width: thumbWidth, height: THUMB_HEIGHT }}
                    // A phone under memory pressure can drop a thumbnail.
                    // Rather than a broken picture, the page is named and
                    // the thumbnail is drawn again.
                    onError={() => {
                      setBroken((current) => ({ ...current, [item.id]: true }))
                      onThumbnailError?.(item.id)
                    }}
                  />
                ) : (
                  <span
                    className="flex flex-col items-center justify-center gap-0.5 bg-muted text-muted-foreground"
                    style={{ width: thumbWidth, height: THUMB_HEIGHT }}
                  >
                    <span className="text-sm font-medium tabular-nums">
                      {item.label}
                    </span>
                    <HugeiconsIcon icon={File01Icon} className="size-3" />
                  </span>
                )}

                {isActive ? (
                  <motion.span
                    layoutId="page-panel-active"
                    transition={{ type: "spring", stiffness: 420, damping: 34 }}
                    className="pointer-events-none absolute inset-0 rounded-md ring-2 ring-primary"
                  />
                ) : null}

                {item.edited ? (
                  <span
                    className="absolute top-1 left-1 size-2 rounded-full bg-amber-500 ring-1 ring-background"
                    title="Changed"
                  />
                ) : null}
                {isExtracted ? (
                  <span
                    className="absolute right-1 bottom-1 flex size-4 items-center justify-center rounded-full bg-emerald-600 text-white ring-1 ring-background"
                    title="Read"
                  >
                    <HugeiconsIcon icon={Tick02Icon} className="size-2.5" />
                  </span>
                ) : null}
              </button>

              {/* The name is shortened in the middle, so a long one can
                  never stretch the thumbnail. */}
              <MiddleTruncate
                name={item.label}
                className="mt-1 px-0.5 text-center text-[10px] leading-tight text-muted-foreground"
              />

              <Button
                size="icon-xs"
                variant="secondary"
                onClick={() => onRemove(item.id)}
                aria-label={`Remove page ${item.label}`}
                title={`Remove page ${item.label}`}
                className="absolute top-1 right-1 opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
              >
                <HugeiconsIcon icon={Delete02Icon} />
              </Button>
            </div>
          )
        })}

        {/* Add another photo or a PDF to this document. */}
        <div className="relative shrink-0 self-stretch">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="flex w-full flex-col items-center justify-center gap-1 rounded-md border border-dashed border-border text-muted-foreground transition-colors hover:border-primary hover:text-foreground"
            style={{ height: THUMB_HEIGHT }}
            title="Add another photo or PDF"
            aria-label="Add another photo or PDF"
          >
            <HugeiconsIcon icon={Add01Icon} />
            <span className="text-[10px]">Add</span>
          </button>
        </div>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="image/*,application/pdf"
        className="sr-only"
        onChange={(event) => {
          const files = Array.from(event.target.files ?? [])
          event.target.value = ""
          if (files.length > 0) onAdd(files)
        }}
      />
    </aside>
  )
}

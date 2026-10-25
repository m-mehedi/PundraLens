"use client"

import * as React from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  FitToScreenIcon,
  RefreshIcon,
  ViewIcon,
  ZoomInIcon,
  ZoomOutIcon,
} from "@hugeicons/core-free-icons"

import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"

export interface EditorContextBarProps {
  /** 1-based position of the open page. */
  position: number
  /** How many pages the document has. */
  total: number
  /** The zoom, as a percentage of the whole image. */
  zoom: number
  onZoomIn: () => void
  onZoomOut: () => void
  onFit: () => void
  /** Press and hold to see the untouched original. */
  onCompareStart: () => void
  onCompareEnd: () => void
  canCompare: boolean
  /** True while the untouched original is being shown. */
  isComparing: boolean
  /** Put the page back the way it was uploaded. */
  onResetPage: () => void
  /** There is something to put back. */
  canResetPage: boolean
}

/**
 * The bar above the canvas.
 *
 * Everything that is about the view rather than the notice lives here, so
 * nothing has to float over the photo.
 */
export function EditorContextBar({
  position,
  total,
  zoom,
  onZoomIn,
  onZoomOut,
  onFit,
  onCompareStart,
  onCompareEnd,
  canCompare,
  isComparing,
  onResetPage,
  canResetPage,
}: EditorContextBarProps) {
  return (
    <div className="flex flex-wrap items-center justify-end gap-3">
      <div className="flex items-center gap-2">
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                variant="outline"
                size="icon-sm"
                className="select-none"
                disabled={!canResetPage}
                aria-label="Put the page back the way it was uploaded"
                onClick={onResetPage}
              >
                <HugeiconsIcon icon={RefreshIcon} />
              </Button>
            }
          />
          <TooltipContent>
            Put the page back the way it was uploaded
          </TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                variant="outline"
                size="icon-sm"
                className="select-none"
                disabled={!canCompare}
                aria-pressed={isComparing}
                aria-label="Hold to see the photo as it was uploaded"
                onPointerDown={onCompareStart}
                onPointerUp={onCompareEnd}
                onPointerLeave={onCompareEnd}
                onPointerCancel={onCompareEnd}
              >
                <HugeiconsIcon icon={ViewIcon} />
              </Button>
            }
          />
          <TooltipContent>
            Press and hold to see the photo as it was uploaded
          </TooltipContent>
        </Tooltip>

        <Separator orientation="vertical" className="h-6 self-center" />

        <div className="flex items-center gap-1 rounded-4xl border p-0.5">
          <Button
            variant="ghost"
            size="icon-xs"
            onClick={onZoomOut}
            aria-label="Zoom out"
          >
            <HugeiconsIcon icon={ZoomOutIcon} />
          </Button>
          <span className="w-12 text-center text-xs text-muted-foreground tabular-nums">
            {zoom}%
          </span>
          <Button
            variant="ghost"
            size="icon-xs"
            onClick={onZoomIn}
            aria-label="Zoom in"
          >
            <HugeiconsIcon icon={ZoomInIcon} />
          </Button>
          <Button
            variant="ghost"
            size="icon-xs"
            onClick={onFit}
            aria-label="Fit the page in the view"
          >
            <HugeiconsIcon icon={FitToScreenIcon} />
          </Button>
        </div>

        <span className="text-sm text-muted-foreground tabular-nums">
          {position} of {total}
        </span>
      </div>
    </div>
  )
}

"use client"

import * as React from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  CropIcon,
  FocusIcon,
  HandIcon,
  LayerMask01Icon,
  VectorSquareIcon,
} from "@hugeicons/core-free-icons"

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"

import type { EditorTool } from "./types"

export const TOOL_ITEMS: Array<{
  id: EditorTool
  label: string
  icon: typeof FocusIcon
}> = [
  { id: "move", label: "Move the page", icon: HandIcon },
  { id: "corners", label: "Corners", icon: FocusIcon },
  { id: "crop", label: "Crop", icon: CropIcon },
  { id: "hide", label: "Hide a part", icon: VectorSquareIcon },
  { id: "adjust", label: "Adjust", icon: LayerMask01Icon },
]

export interface ToolDockProps {
  tool: EditorTool
  onToolChange: (tool: EditorTool) => void
  /** Tools that are not available right now. */
  disabled?: EditorTool[]
}

/**
 * The tool rail.
 *
 * Only the icons are shown; the name appears as soon as the pointer rests
 * on one, so the rail stays small and nobody has to learn it by heart.
 */
export function ToolDock({ tool, onToolChange, disabled = [] }: ToolDockProps) {
  return (
    <div
      role="toolbar"
      aria-label="Editing tools"
      className="flex items-center gap-1"
    >
      {TOOL_ITEMS.map((item) => (
        <Tooltip key={item.id}>
          <TooltipTrigger
            render={
              <button
                type="button"
                aria-label={item.label}
                aria-pressed={tool === item.id}
                disabled={disabled.includes(item.id)}
                onClick={() => onToolChange(item.id)}
                className={cn(
                  "flex size-9 items-center justify-center rounded-4xl text-muted-foreground transition-colors",
                  "hover:bg-muted hover:text-foreground",
                  "focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none",
                  "aria-pressed:bg-muted aria-pressed:text-foreground",
                  "disabled:pointer-events-none disabled:opacity-50"
                )}
              >
                <HugeiconsIcon icon={item.icon} className="size-5" />
              </button>
            }
          />
          <TooltipContent>{item.label}</TooltipContent>
        </Tooltip>
      ))}
    </div>
  )
}

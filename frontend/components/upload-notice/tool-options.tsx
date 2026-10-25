"use client"

import * as React from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  AddSquareIcon,
  CheckmarkCircleIcon,
  CircleIcon,
  ContrastIcon,
  Delete02Icon,
  MagicWandIcon,
  ScanIcon,
  SparklesIcon,
  SquareIcon,
  TriangleIcon,
} from "@hugeicons/core-free-icons"

import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"

import type {
  EditOp,
  EditorTool,
  MaskShape,
  MaskShapeKind,
  Rect,
} from "./types"

const ASPECTS: Array<{ id: string; label: string; ratio: number | null }> = [
  { id: "free", label: "Free", ratio: null },
  { id: "1:1", label: "1:1", ratio: 1 },
  { id: "1:2", label: "1:2", ratio: 1 / 2 },
  { id: "2:1", label: "2:1", ratio: 2 },
]

const SHAPES: Array<{
  id: MaskShapeKind
  label: string
  icon: typeof SquareIcon
}> = [
  { id: "rect", label: "Rectangle", icon: SquareIcon },
  { id: "circle", label: "Circle", icon: CircleIcon },
  { id: "triangle", label: "Triangle", icon: TriangleIcon },
]

export interface ToolOptionsProps {
  tool: EditorTool
  points: Array<{ x: number; y: number }>
  autoFilled: boolean[]
  detectedCount: number
  isDetecting: boolean
  isProcessing: boolean
  error?: string | null

  onDetectCorners: () => void
  onAddFourCorners: () => void
  onClearCorners: () => void
  /** Wrap the page with the four corners. */
  onWrap: () => void

  cropDraft: Rect | null
  cropAspect: number | null
  onCropAspectChange: (aspect: number | null) => void
  onApplyCrop: () => void
  onCancelCrop: () => void

  maskShapes: MaskShape[]
  maskKind: MaskShapeKind
  onMaskKindChange: (kind: MaskShapeKind) => void
  onRemoveMaskShape: (id: string) => void
  onClearMaskShapes: () => void
  onApplyMask: () => void

  onAddGrayscale: () => void
  onAddSharpen: () => void

  ops: EditOp[]
  onRemoveOp: (id: string) => void
}

/**
 * The options of whichever tool is open.
 *
 * The bar swaps its content when a different tool is picked, so the panel
 * only ever shows what applies to what the user is doing right now.
 */
export function ToolOptions(props: ToolOptionsProps) {
  const { tool } = props

  return (
    <div className="flex min-h-10 flex-wrap items-center gap-x-3 gap-y-2">
      {tool === "corners" ? <CornerOptions {...props} /> : null}
      {tool === "crop" ? <CropOptions {...props} /> : null}
      {tool === "hide" ? <HideOptions {...props} /> : null}
      {tool === "adjust" ? <AdjustOptions {...props} /> : null}

      {props.ops.length > 0 ? (
        <>
          <Separator orientation="vertical" className="h-6 self-center" />
          <span className="text-xs text-muted-foreground">
            {props.ops.length} {props.ops.length === 1 ? "change" : "changes"}
          </span>
        </>
      ) : null}
    </div>
  )
}

function CornerOptions(props: ToolOptionsProps) {
  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <Button
          size="sm"
          onClick={props.onDetectCorners}
          disabled={props.isDetecting || props.isProcessing}
        >
          <HugeiconsIcon icon={MagicWandIcon} data-icon="inline-start" />
          {props.isDetecting ? "Detecting..." : "Auto-detect"}
        </Button>
        <Button size="sm" variant="outline" onClick={props.onAddFourCorners}>
          <HugeiconsIcon icon={AddSquareIcon} data-icon="inline-start" />
          Add 4 corners
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={props.onClearCorners}
          disabled={props.points.length === 0}
        >
          <HugeiconsIcon icon={Delete02Icon} data-icon="inline-start" />
          Remove all
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={props.onWrap}
          disabled={props.points.length !== 4 || props.isProcessing}
        >
          <HugeiconsIcon icon={ScanIcon} data-icon="inline-start" />
          Wrap
        </Button>
      </div>
    </>
  )
}

function CropOptions(props: ToolOptionsProps) {
  return (
    <>
      <span className="text-sm text-muted-foreground">Shape</span>
      <ToggleGroup
        value={[
          ASPECTS.find((a) => a.ratio === props.cropAspect)?.id ?? "free",
        ]}
        onValueChange={(value) => {
          const chosen = ASPECTS.find((a) => a.id === value[0])
          if (chosen) props.onCropAspectChange(chosen.ratio)
        }}
        variant="outline"
      >
        {ASPECTS.map((aspect) => (
          <ToggleGroupItem key={aspect.id} value={aspect.id}>
            {aspect.label}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>

      <span className="text-sm text-muted-foreground">
        {props.cropDraft
          ? "Drag a corner to adjust the crop"
          : "Drag on the page to draw the crop"}
      </span>

      <Button size="sm" onClick={props.onApplyCrop} disabled={!props.cropDraft}>
        <HugeiconsIcon icon={CheckmarkCircleIcon} data-icon="inline-start" />
        Apply crop
      </Button>
      {props.cropDraft ? (
        <Button size="sm" variant="ghost" onClick={props.onCancelCrop}>
          Cancel
        </Button>
      ) : null}
    </>
  )
}

function HideOptions(props: ToolOptionsProps) {
  return (
    <>
      <span className="text-sm text-muted-foreground">Shape</span>
      <ToggleGroup
        value={[props.maskKind]}
        onValueChange={(value) => {
          if (value[0]) props.onMaskKindChange(value[0] as MaskShapeKind)
        }}
        variant="outline"
      >
        {SHAPES.map((shape) => (
          <ToggleGroupItem key={shape.id} value={shape.id}>
            <HugeiconsIcon icon={shape.icon} data-icon="inline-start" />
            {shape.label}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>

      {props.maskShapes.length > 0 ? (
        <Button size="xs" variant="ghost" onClick={props.onClearMaskShapes}>
          Clear all
        </Button>
      ) : null}

      <Button
        size="sm"
        onClick={props.onApplyMask}
        disabled={props.maskShapes.length === 0}
      >
        <HugeiconsIcon icon={CheckmarkCircleIcon} data-icon="inline-start" />
        Confirm
      </Button>
    </>
  )
}

function AdjustOptions(props: ToolOptionsProps) {
  return (
    <>
      <Button
        size="sm"
        variant="outline"
        onClick={props.onAddSharpen}
        disabled={props.isProcessing}
      >
        <HugeiconsIcon icon={SparklesIcon} data-icon="inline-start" />
        Sharpen
      </Button>
      <Button
        size="sm"
        variant="outline"
        onClick={props.onAddGrayscale}
        disabled={props.isProcessing}
      >
        <HugeiconsIcon icon={ContrastIcon} data-icon="inline-start" />
        Grayscale
      </Button>
    </>
  )
}

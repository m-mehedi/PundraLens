"use client"

import * as React from "react"

import { normalizeRect } from "@/lib/corner-geometry"

import { useCanvas } from "./notice-canvas"
import type { Rect } from "./types"
import { useImageDrag } from "./use-image-drag"

export interface CropOverlayProps {
  /** The crop rectangle, as a percentage of the image. Null until drawn. */
  crop: Rect | null
  onCropChange: (crop: Rect) => void
  /** The locked ratio (width ÷ height), or null for a free crop. */
  aspect: number | null
  /** The natural size of the image being cropped. */
  frameWidth: number
  frameHeight: number
  active: boolean
}

/** The size of a crop handle, in screen pixels. */
const HANDLE_SIZE = 12

type Drag =
  | { kind: "create"; startX: number | null; startY: number | null }
  | { kind: "move"; crop: Rect; fromX: number | null; fromY: number | null }
  | {
      kind: "resize"
      crop: Rect
      corner: "nw" | "ne" | "se" | "sw"
      anchorX: number
      anchorY: number
    }

/** Fit a width and height to a locked ratio, growing inside the given box. */
function fitAspect(
  width: number,
  height: number,
  aspect: number | null
): { width: number; height: number } {
  if (!aspect || width <= 0 || height <= 0) return { width, height }
  if (width / height > aspect) return { width: height * aspect, height }
  return { width, height: width / aspect }
}

/**
 * The crop rectangle.
 *
 * It behaves like the crop tool in any photo editor: drag on the image to
 * draw one, drag it to move it, drag a corner to resize it, and pick a
 * ratio to lock the shape.
 */
export function CropOverlay({
  crop,
  onCropChange,
  aspect,
  frameWidth,
  frameHeight,
  active,
}: CropOverlayProps) {
  const { box, zoom } = useCanvas()
  const makeDrag = useImageDrag()
  const dragRef = React.useRef<Drag | null>(null)

  if (frameWidth <= 0 || frameHeight <= 0) return null

  const toPercent = (
    left: number,
    top: number,
    width: number,
    height: number
  ) =>
    normalizeRect({
      x: (left / frameWidth) * 100,
      y: (top / frameHeight) * 100,
      width: (width / frameWidth) * 100,
      height: (height / frameHeight) * 100,
    })

  // The pointer position is only known once the drag starts, so the start
  // point is filled in by the first move.
  const beginCreate = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!active) return
    dragRef.current = { kind: "create", startX: null, startY: null }
    makeDrag((point) => {
      const drag = dragRef.current
      if (!drag || drag.kind !== "create") return
      if (drag.startX === null || drag.startY === null) {
        drag.startX = point.x
        drag.startY = point.y
        return
      }
      const width = Math.abs(point.x - drag.startX)
      const height = Math.abs(point.y - drag.startY)
      const fitted = fitAspect(width, height, aspect)
      const left = Math.min(drag.startX, point.x)
      const top = Math.min(drag.startY, point.y)
      onCropChange(toPercent(left, top, fitted.width, fitted.height))
    })(event)
  }

  const startMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const current = crop
    if (!current || !active) return
    dragRef.current = {
      kind: "move",
      crop: current,
      fromX: null,
      fromY: null,
    }
    makeDrag((point) => {
      const drag = dragRef.current
      if (!drag || drag.kind !== "move") return
      if (drag.fromX === null || drag.fromY === null) {
        drag.fromX = point.x
        drag.fromY = point.y
        return
      }
      const dx = point.x - drag.fromX
      const dy = point.y - drag.fromY
      const base = drag.crop
      onCropChange(
        normalizeRect({
          x: base.x + (dx / frameWidth) * 100,
          y: base.y + (dy / frameHeight) * 100,
          width: base.width,
          height: base.height,
        })
      )
    })(event)
  }

  const startResize = (
    event: React.PointerEvent<HTMLButtonElement>,
    corner: "nw" | "ne" | "se" | "sw"
  ) => {
    const current = crop
    if (!current || !active) return
    const corners = {
      nw: { x: current.x, y: current.y },
      ne: { x: current.x + current.width, y: current.y },
      se: { x: current.x + current.width, y: current.y + current.height },
      sw: { x: current.x, y: current.y + current.height },
    }
    const opposite = {
      nw: corners.se,
      ne: corners.sw,
      se: corners.nw,
      sw: corners.ne,
    }
    dragRef.current = {
      kind: "resize",
      crop: current,
      corner,
      anchorX: (opposite[corner].x / 100) * frameWidth,
      anchorY: (opposite[corner].y / 100) * frameHeight,
    }
    makeDrag((point) => {
      const drag = dragRef.current
      if (!drag || drag.kind !== "resize") return
      const dx = point.x - drag.anchorX
      const dy = point.y - drag.anchorY
      const fitted = fitAspect(Math.abs(dx), Math.abs(dy), aspect)
      const left = dx < 0 ? drag.anchorX - fitted.width : drag.anchorX
      const top = dy < 0 ? drag.anchorY - fitted.height : drag.anchorY
      onCropChange(toPercent(left, top, fitted.width, fitted.height))
    })(event)
  }

  if (!active) return null

  const left = crop ? box.left + (crop.x / 100) * frameWidth * zoom : 0
  const top = crop ? box.top + (crop.y / 100) * frameHeight * zoom : 0
  const width = crop ? (crop.width / 100) * frameWidth * zoom : 0
  const height = crop ? (crop.height / 100) * frameHeight * zoom : 0

  const handles: Array<{
    corner: "nw" | "ne" | "se" | "sw"
    x: number
    y: number
  }> = crop
    ? [
        { corner: "nw", x: left, y: top },
        { corner: "ne", x: left + width, y: top },
        { corner: "se", x: left + width, y: top + height },
        { corner: "sw", x: left, y: top + height },
      ]
    : []

  return (
    <div
      className="absolute inset-0"
      style={{ pointerEvents: crop ? "none" : "auto" }}
      onPointerDown={beginCreate}
    >
      {crop ? (
        <>
          {/* The dimmed surround — the standard crop-tool look. */}
          <div className="absolute inset-0 bg-foreground/45" />
          <div
            className="absolute border border-background shadow-[0_0_0_1px_rgba(0,0,0,0.4)]"
            style={{ left, top, width, height, pointerEvents: "auto" }}
            onPointerDown={startMove}
          >
            <div className="pointer-events-none absolute inset-0">
              <div className="absolute inset-y-0 left-1/3 w-px bg-background/45" />
              <div className="absolute inset-y-0 left-2/3 w-px bg-background/45" />
              <div className="absolute inset-x-0 top-1/3 h-px bg-background/45" />
              <div className="absolute inset-x-0 top-2/3 h-px bg-background/45" />
            </div>
          </div>

          {handles.map((handle) => (
            <button
              key={handle.corner}
              type="button"
              aria-label={`Resize from the ${handle.corner} corner`}
              onPointerDown={(event) => startResize(event, handle.corner)}
              className="absolute size-3 rounded-full border-2 border-background bg-primary shadow-sm"
              style={{
                left: handle.x - HANDLE_SIZE / 2,
                top: handle.y - HANDLE_SIZE / 2,
                width: HANDLE_SIZE,
                height: HANDLE_SIZE,
                pointerEvents: "auto",
              }}
            />
          ))}
        </>
      ) : null}
    </div>
  )
}

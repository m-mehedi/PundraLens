"use client"

import * as React from "react"

import { clampCorner } from "@/lib/corner-geometry"

import { useCanvas } from "./notice-canvas"
import type { Corner } from "./types"
import { useImageDrag } from "./use-image-drag"

export interface CornerOverlayProps {
  points: Corner[]
  onChange: (points: Corner[]) => void
  /**
   * Called the moment a corner is grabbed, before it moves — so a drag
   * counts as one change, not one change per pixel.
   */
  onGestureStart?: () => void
  /** The natural size of the image the corners refer to. */
  frameWidth: number
  frameHeight: number
  /** When false the polygon is shown but the handles cannot be dragged. */
  interactive?: boolean
}

/** The size of a corner handle, in screen pixels. */
const HANDLE_SIZE = 16

/**
 * The four corners of the notice.
 *
 * The handles are drawn at a fixed screen size, so they stay easy to grab
 * however far the page is zoomed in.
 */
export function CornerOverlay({
  points,
  onChange,
  onGestureStart,
  frameWidth,
  frameHeight,
  interactive = true,
}: CornerOverlayProps) {
  const { zoom, box } = useCanvas()
  const makeDrag = useImageDrag()

  const startDrag = (index: number) => {
    const drag = makeDrag((point) => {
      onChange(
        points.map((corner, i) =>
          i === index
            ? clampCorner({
                x: (point.x / frameWidth) * 100,
                y: (point.y / frameHeight) * 100,
              })
            : corner
        )
      )
    })
    return (event: React.PointerEvent<HTMLButtonElement>) => {
      onGestureStart?.()
      drag(event)
    }
  }

  if (frameWidth <= 0 || frameHeight <= 0) return null

  return (
    <div className="pointer-events-none absolute inset-0 text-primary">
      <svg
        className="pointer-events-none absolute overflow-visible"
        style={{ left: box.left, top: box.top }}
        width={box.width}
        height={box.height}
        viewBox={`0 0 ${frameWidth} ${frameHeight}`}
        preserveAspectRatio="none"
      >
        <polygon
          points={points
            .map(
              (point) =>
                `${(point.x / 100) * frameWidth},${(point.y / 100) * frameHeight}`
            )
            .join(" ")}
          fill="currentColor"
          fillOpacity={0.15}
          stroke="currentColor"
          strokeWidth={2}
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
      </svg>

      {points.map((point, index) => {
        const left = box.left + (point.x / 100) * frameWidth * zoom
        const top = box.top + (point.y / 100) * frameHeight * zoom
        return (
          <button
            key={index}
            type="button"
            aria-label={`Corner ${index + 1}`}
            disabled={!interactive}
            onPointerDown={startDrag(index)}
            className="pointer-events-auto absolute size-4 rounded-full border-2 border-background bg-primary shadow-sm disabled:pointer-events-none"
            style={{
              left: left - HANDLE_SIZE / 2,
              top: top - HANDLE_SIZE / 2,
              width: HANDLE_SIZE,
              height: HANDLE_SIZE,
            }}
          />
        )
      })}
    </div>
  )
}

"use client"

import * as React from "react"
import { SimpleHandler, type CropperState } from "react-advanced-cropper"
import type { Corner } from "./types"

export interface PolygonOverlayProps {
  points: Corner[]
  onChange: (points: Corner[]) => void
  imageWidth: number
  imageHeight: number
  state: CropperState | null
  stencilRect: {
    left: number
    top: number
    width: number
    height: number
  } | null
}

/** Visible size of a corner handle, in screen pixels. */
const HANDLER_SIZE = 16

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max)
}

export function PolygonOverlay({
  points,
  onChange,
  imageWidth,
  imageHeight,
  state,
  stencilRect,
}: PolygonOverlayProps) {
  // Image pixels per screen pixel. Zero while the image is not loaded yet.
  const coefficient =
    state?.visibleArea && state.boundary?.width
      ? state.visibleArea.width / state.boundary.width
      : 0

  const coordinates = state?.coordinates ?? null

  const ready =
    Boolean(coordinates) &&
    Boolean(stencilRect) &&
    coefficient > 0 &&
    imageWidth > 0 &&
    imageHeight > 0

  // Screen pixels of every corner, relative to the overlay (which is anchored
  // on the cropper's stencil rect).
  const relPoints = React.useMemo(() => {
    if (!ready || !coordinates) return []
    return points.map((point) => {
      const imageX = (point.x / 100) * imageWidth
      const imageY = (point.y / 100) * imageHeight
      return {
        x: (imageX - coordinates.left) / coefficient,
        y: (imageY - coordinates.top) / coefficient,
      }
    })
  }, [ready, coordinates, coefficient, points, imageWidth, imageHeight])

  // Mirrors of the props so a fast drag never loses a delta between renders.
  const relRef = React.useRef(relPoints)
  React.useEffect(() => {
    relRef.current = relPoints
  }, [relPoints])

  const pointsRef = React.useRef(points)
  React.useEffect(() => {
    pointsRef.current = points
  }, [points])

  const handleMove = (index: number, dirs: { top?: number; left?: number }) => {
    if (!ready || !coordinates) return
    const base = relRef.current[index] ?? relPoints[index]
    if (!base) return

    // `dirs` is a delta in screen pixels, relative to the overlay.
    const nextRelX = base.x + (dirs.left ?? 0)
    const nextRelY = base.y + (dirs.top ?? 0)

    // Back to image pixels, then to a percentage of the source image.
    const nextImageX = nextRelX * coefficient + coordinates.left
    const nextImageY = nextRelY * coefficient + coordinates.top

    const nextPoints = pointsRef.current.map((point, i) =>
      i === index
        ? {
            x: clamp((nextImageX / imageWidth) * 100, 0, 100),
            y: clamp((nextImageY / imageHeight) * 100, 0, 100),
          }
        : point
    )

    relRef.current = relRef.current.map((value, i) =>
      i === index ? { x: nextRelX, y: nextRelY } : value
    )
    pointsRef.current = nextPoints
    onChange(nextPoints)
  }

  if (!ready || !stencilRect) return null

  return (
    <div
      className="pointer-events-none absolute text-primary"
      style={{
        left: stencilRect.left,
        top: stencilRect.top,
        width: stencilRect.width,
        height: stencilRect.height,
      }}
    >
      <svg className="pointer-events-none absolute inset-0 overflow-visible">
        <polygon
          points={relPoints.map((point) => `${point.x},${point.y}`).join(" ")}
          fill="currentColor"
          fillOpacity={0.15}
          stroke="currentColor"
          strokeWidth={2}
          strokeLinejoin="round"
        />
        {relPoints.map((point, index) => (
          <circle
            key={index}
            cx={point.x}
            cy={point.y}
            r={4}
            fill="currentColor"
          />
        ))}
      </svg>

      {relPoints.map((point, index) => (
        <SimpleHandler
          key={index}
          wrapperClassName="pointer-events-auto size-4 rounded-full border-2 border-primary bg-background shadow-sm"
          defaultClassName="rounded-full"
          wrapperStyle={{
            left: point.x,
            top: point.y,
            width: HANDLER_SIZE,
            height: HANDLER_SIZE,
          }}
          onMove={(dirs) => handleMove(index, dirs)}
          onMoveEnd={() => {}}
        />
      ))}
    </div>
  )
}

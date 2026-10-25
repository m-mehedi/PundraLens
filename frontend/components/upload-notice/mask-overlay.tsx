"use client"

import * as React from "react"

import type { MaskShape, MaskShapeKind } from "./types"
import { useCanvas } from "./notice-canvas"
import { useImageDrag } from "./use-image-drag"

export interface MaskOverlayProps {
  /** The regions that will be hidden. */
  shapes: MaskShape[]
  onChange: (shapes: MaskShape[]) => void
  /** The shape the next drag will draw. */
  kind: MaskShapeKind
  /** The natural size of the image being masked. */
  frameWidth: number
  frameHeight: number
  active: boolean
}

/** The size of a shape handle, in screen pixels. */
const HANDLE_SIZE = 12
/** How thick a freehand redaction stroke is, as a percentage of the width. */
const STROKE_WIDTH = 2.5
/** How close a click has to be to close a polygon, in screen pixels. */
const CLOSE_DISTANCE = 14

let shapeCounter = 0
function nextShapeId(): string {
  shapeCounter += 1
  return `shape-${shapeCounter}-${Date.now()}`
}

/**
 * The regions to hide.
 *
 * The shapes are drawn on top of the photo as a dark wash, so it is obvious
 * what will be covered. Nothing is burned into the image until they are
 * confirmed — they can be moved and resized right up to that point.
 */
export function MaskOverlay({
  shapes,
  onChange,
  kind,
  frameWidth,
  frameHeight,
  active,
}: MaskOverlayProps) {
  const { box, zoom, toImage } = useCanvas()
  const makeDrag = useImageDrag()
  const [draft, setDraft] = React.useState<MaskShape | null>(null)
  const [polyPoints, setPolyPoints] = React.useState<Array<
    [number, number]
  > | null>(null)
  // The shape being drawn right now, and the corners of the polygon being
  // drawn — kept in refs so a state update never has to happen inside
  // another one's updater.
  const draftRef = React.useRef<MaskShape | null>(null)
  const polyPointsRef = React.useRef<Array<[number, number]> | null>(null)

  if (frameWidth <= 0 || frameHeight <= 0) return null

  const px = (value: number) => (value / 100) * frameWidth
  const py = (value: number) => (value / 100) * frameHeight
  const percentX = (value: number) => (value / frameWidth) * 100
  const percentY = (value: number) => (value / frameHeight) * 100

  /** Draw a new shape by dragging on the photo. */
  const beginDraw = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!active) return

    if (kind === "polygon") {
      // A polygon is drawn corner by corner: each click adds one, and
      // clicking the first corner again closes it.
      const point = toImage(event.clientX, event.clientY)
      const next: [number, number] = [percentX(point.x), percentY(point.y)]
      const current = polyPointsRef.current
      if (!current || current.length < 3) {
        const points = [...(current ?? []), next]
        polyPointsRef.current = points
        setPolyPoints(points)
        return
      }
      const first = current[0]
      const distance = Math.hypot(
        px(next[0]) - px(first[0]),
        py(next[1]) - py(first[1])
      )
      if (distance * zoom > CLOSE_DISTANCE) {
        const points = [...current, next]
        polyPointsRef.current = points
        setPolyPoints(points)
        return
      }
      // Back on the first corner — close the polygon.
      polyPointsRef.current = null
      setPolyPoints(null)
      onChange([
        ...shapes,
        { id: nextShapeId(), kind: "polygon", points: current },
      ])
      return
    }

    let start: { x: number; y: number } | null = null

    makeDrag(
      (pointer) => {
        if (!start) {
          start = pointer
          draftRef.current = buildShape(
            kind,
            start,
            start,
            frameWidth,
            frameHeight
          )
          setDraft(draftRef.current)
          return
        }
        draftRef.current = buildShape(
          kind,
          start,
          pointer,
          frameWidth,
          frameHeight
        )
        setDraft(draftRef.current)
      },
      () => {
        const drawn = draftRef.current
        draftRef.current = null
        setDraft(null)
        if (drawn) onChange([...shapes, drawn])
      }
    )(event)
  }

  /** Drag a shape to move it. */
  const beginMove = (event: React.PointerEvent<Element>, shape: MaskShape) => {
    if (!active) return
    let origin: { x: number; y: number } | null = null
    makeDrag((pointer) => {
      if (!origin) {
        origin = pointer
        return
      }
      const dx = pointer.x - origin.x
      const dy = pointer.y - origin.y
      onChange(
        shapes.map((entry) =>
          entry.id === shape.id
            ? moveShape(entry, dx, dy, frameWidth, frameHeight)
            : entry
        )
      )
    })(event)
  }

  /** Drag a handle to resize a shape. */
  const beginResize = (
    event: React.PointerEvent<HTMLButtonElement>,
    shape: MaskShape,
    handle: number
  ) => {
    if (!active) return
    makeDrag((pointer) => {
      onChange(
        shapes.map((entry) =>
          entry.id === shape.id
            ? resizeShape(entry, handle, pointer, frameWidth, frameHeight)
            : entry
        )
      )
    })(event)
  }

  if (!active) return null

  const drawn = draft ? [...shapes, draft] : shapes

  return (
    <div
      className="absolute inset-0"
      onPointerDown={beginDraw}
      onDoubleClick={() => {
        const current = polyPointsRef.current
        polyPointsRef.current = null
        setPolyPoints(null)
        if (current && current.length >= 3) {
          onChange([
            ...shapes,
            { id: nextShapeId(), kind: "polygon", points: current },
          ])
        }
      }}
    >
      <svg
        className="pointer-events-none absolute overflow-visible"
        style={{ left: box.left, top: box.top }}
        width={box.width}
        height={box.height}
        viewBox={`0 0 ${frameWidth} ${frameHeight}`}
        preserveAspectRatio="none"
      >
        {drawn.map((shape) => (
          <ShapeElement
            key={shape.id}
            shape={shape}
            frameWidth={frameWidth}
            frameHeight={frameHeight}
          />
        ))}
        {polyPoints ? (
          <polyline
            points={polyPoints
              .map(
                ([px, py]) =>
                  `${px * (frameWidth / 100)},${py * (frameHeight / 100)}`
              )
              .join(" ")}
            fill="none"
            stroke="#ffffff"
            strokeWidth={2}
            strokeDasharray="6 4"
            vectorEffect="non-scaling-stroke"
          />
        ) : null}
      </svg>

      {/* A transparent copy of each shape, so it can be grabbed and moved. */}
      <svg
        className="absolute overflow-visible"
        style={{ left: box.left, top: box.top }}
        width={box.width}
        height={box.height}
        viewBox={`0 0 ${frameWidth} ${frameHeight}`}
        preserveAspectRatio="none"
      >
        {drawn.map((shape) => (
          <ShapeElement
            key={`hit-${shape.id}`}
            shape={shape}
            frameWidth={frameWidth}
            frameHeight={frameHeight}
            interactive
            onPointerDown={(event) => beginMove(event, shape)}
          />
        ))}
      </svg>

      {drawn.map((shape) =>
        shapeHandles(shape, frameWidth, frameHeight).map((handle) => (
          <button
            key={`${shape.id}-${handle.index}`}
            type="button"
            aria-label="Adjust the hidden region"
            onPointerDown={(event) => beginResize(event, shape, handle.index)}
            className="absolute size-3 rounded-full border-2 border-background bg-primary shadow-sm"
            style={{
              left: box.left + handle.x * zoom - HANDLE_SIZE / 2,
              top: box.top + handle.y * zoom - HANDLE_SIZE / 2,
              width: HANDLE_SIZE,
              height: HANDLE_SIZE,
            }}
          />
        ))
      )}
    </div>
  )
}

/** A shape built from a drag, in percentages of the image. */
function buildShape(
  kind: MaskShapeKind,
  from: { x: number; y: number },
  to: { x: number; y: number },
  frameWidth: number,
  frameHeight: number
): MaskShape {
  const percentX = (value: number) => (value / frameWidth) * 100
  const percentY = (value: number) => (value / frameHeight) * 100

  if (kind === "rect") {
    return {
      id: nextShapeId(),
      kind: "rect",
      x: percentX(Math.min(from.x, to.x)),
      y: percentY(Math.min(from.y, to.y)),
      width: percentX(Math.abs(to.x - from.x)),
      height: percentY(Math.abs(to.y - from.y)),
    }
  }
  if (kind === "circle") {
    return {
      id: nextShapeId(),
      kind: "circle",
      cx: percentX(from.x),
      cy: percentY(from.y),
      radius: percentX(Math.hypot(to.x - from.x, to.y - from.y)),
    }
  }
  if (kind === "triangle") {
    const left = Math.min(from.x, to.x)
    const top = Math.min(from.y, to.y)
    const right = Math.max(from.x, to.x)
    const bottom = Math.max(from.y, to.y)
    return {
      id: nextShapeId(),
      kind: "triangle",
      points: [
        [percentX(left), percentY(top)],
        [percentX(right), percentY(top)],
        [percentX(left), percentY(bottom)],
      ],
    }
  }
  return {
    id: nextShapeId(),
    kind: "stroke",
    points: [[percentX(from.x), percentY(from.y)]],
    width: STROKE_WIDTH,
  }
}

function ShapeElement({
  shape,
  frameWidth,
  frameHeight,
  interactive = false,
  onPointerDown,
}: {
  shape: MaskShape
  frameWidth: number
  frameHeight: number
  interactive?: boolean
  onPointerDown?: (event: React.PointerEvent<SVGElement>) => void
}) {
  const x = (value: number) => (value / 100) * frameWidth
  const y = (value: number) => (value / 100) * frameHeight
  const hit = {
    fill: interactive ? "transparent" : "#000000",
    fillOpacity: interactive ? 0 : 0.82,
    stroke: interactive ? "transparent" : "#ffffff",
    strokeWidth: interactive ? 0 : 1,
    vectorEffect: "non-scaling-stroke" as const,
    className: interactive
      ? "pointer-events-auto cursor-move"
      : "pointer-events-none",
    onPointerDown,
  }

  if (shape.kind === "rect") {
    return (
      <rect
        x={x(shape.x)}
        y={y(shape.y)}
        width={x(shape.width)}
        height={y(shape.height)}
        {...hit}
      />
    )
  }
  if (shape.kind === "circle") {
    return (
      <circle cx={x(shape.cx)} cy={y(shape.cy)} r={x(shape.radius)} {...hit} />
    )
  }
  if (shape.kind === "triangle" || shape.kind === "polygon") {
    return (
      <polygon
        points={shape.points.map(([px, py]) => `${x(px)},${y(py)}`).join(" ")}
        {...hit}
      />
    )
  }
  return (
    <polyline
      points={shape.points.map(([px, py]) => `${x(px)},${y(py)}`).join(" ")}
      fill="none"
      stroke={interactive ? "transparent" : "#000000"}
      strokeOpacity={interactive ? 0 : 0.82}
      strokeWidth={interactive ? x(shape.width) : x(shape.width)}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={
        interactive ? "pointer-events-auto cursor-move" : "pointer-events-none"
      }
      onPointerDown={onPointerDown}
    />
  )
}

/** The grab points of a shape, in image pixels. */
function shapeHandles(
  shape: MaskShape,
  frameWidth: number,
  frameHeight: number
): Array<{ index: number; x: number; y: number }> {
  const x = (value: number) => (value / 100) * frameWidth
  const y = (value: number) => (value / 100) * frameHeight

  if (shape.kind === "rect") {
    return [
      { index: 0, x: x(shape.x), y: y(shape.y) },
      { index: 1, x: x(shape.x + shape.width), y: y(shape.y) },
      { index: 2, x: x(shape.x + shape.width), y: y(shape.y + shape.height) },
      { index: 3, x: x(shape.x), y: y(shape.y + shape.height) },
    ]
  }
  if (shape.kind === "circle") {
    return [{ index: 0, x: x(shape.cx + shape.radius), y: y(shape.cy) }]
  }
  if (shape.kind === "triangle" || shape.kind === "polygon") {
    return shape.points.map(([px, py], index) => ({
      index,
      x: x(px),
      y: y(py),
    }))
  }
  return []
}

/** Move a shape by a number of pixels. */
function moveShape(
  shape: MaskShape,
  dx: number,
  dy: number,
  frameWidth: number,
  frameHeight: number
): MaskShape {
  const moveX = (value: number) => value + (dx / frameWidth) * 100
  const moveY = (value: number) => value + (dy / frameHeight) * 100
  if (shape.kind === "rect") {
    return { ...shape, x: moveX(shape.x), y: moveY(shape.y) }
  }
  if (shape.kind === "circle") {
    return { ...shape, cx: moveX(shape.cx), cy: moveY(shape.cy) }
  }
  return {
    ...shape,
    points: shape.points.map(
      ([px, py]) => [moveX(px), moveY(py)] as [number, number]
    ),
  }
}

/** Pull one handle of a shape to a new place. */
function resizeShape(
  shape: MaskShape,
  handle: number,
  pointer: { x: number; y: number },
  frameWidth: number,
  frameHeight: number
): MaskShape {
  const px = (value: number) => (value / 100) * frameWidth
  const py = (value: number) => (value / 100) * frameHeight
  const nextX = (pointer.x / frameWidth) * 100
  const nextY = (pointer.y / frameHeight) * 100

  if (shape.kind === "rect") {
    const corners = [
      { x: shape.x, y: shape.y },
      { x: shape.x + shape.width, y: shape.y },
      { x: shape.x + shape.width, y: shape.y + shape.height },
      { x: shape.x, y: shape.y + shape.height },
    ]
    const corner = corners[handle] ?? corners[0]
    return {
      ...shape,
      x: Math.min(corner.x, nextX),
      y: Math.min(corner.y, nextY),
      width: Math.abs(nextX - corner.x),
      height: Math.abs(nextY - corner.y),
    }
  }
  if (shape.kind === "circle") {
    const radius = Math.hypot(
      pointer.x - px(shape.cx),
      pointer.y - py(shape.cy)
    )
    return { ...shape, radius: (radius / frameWidth) * 100 }
  }
  if (shape.kind === "triangle" || shape.kind === "polygon") {
    return {
      ...shape,
      points: shape.points.map((point, index) =>
        index === handle ? ([nextX, nextY] as [number, number]) : point
      ),
    }
  }
  return shape
}

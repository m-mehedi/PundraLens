"use client"

import * as React from "react"

import { cn } from "@/lib/utils"

/** A point in the natural pixel space of the image. */
export interface ImagePoint {
  x: number
  y: number
}

/** The image's rectangle inside the viewport, in screen pixels. */
export interface CanvasBox {
  left: number
  top: number
  width: number
  height: number
}

/**
 * The transform every overlay is drawn on.
 *
 * The canvas is an infinite scene, not a scrolling box: `scrollX`/`scrollY`
 * say where the scene sits inside the viewport (in image pixels) and `zoom`
 * says how big it is drawn. This is Excalidraw's model, down to the
 * arithmetic — see `packages/common/src/utils.ts` in the Excalidraw repo.
 */
export interface CanvasTransform {
  /** Screen pixels per image pixel. */
  zoom: number
  /** How far the scene is scrolled, in image pixels. */
  scrollX: number
  scrollY: number
  /** Where the image sits inside the viewport, in screen pixels. */
  box: CanvasBox
  /** Convert a viewport (client) point into image pixels. */
  toImage: (clientX: number, clientY: number) => ImagePoint
  /** Convert image pixels into viewport (screen) pixels. */
  toWorld: (imageX: number, imageY: number) => ImagePoint
}

const CanvasContext = React.createContext<CanvasTransform | null>(null)

/** The transform of the canvas the overlays are drawn on. */
export function useCanvas(): CanvasTransform {
  const transform = React.useContext(CanvasContext)
  if (!transform) {
    throw new Error("useCanvas must be used inside a <NoticeCanvas>")
  }
  return transform
}

/* The numbers Excalidraw uses (packages/common/src/constants.ts). */
const MIN_ZOOM = 0.1
const MAX_ZOOM = 30
const ZOOM_STEP = 0.1
/** The room left around the page when it is fitted into the canvas. */
const FIT_MARGIN = 24

/** Where the scene sits and how big it is drawn. */
export interface CanvasView {
  zoom: number
  scrollX: number
  scrollY: number
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

/**
 * Excalidraw's `getViewportForZoom`: the scroll that keeps the point under
 * the cursor exactly where it was.
 */
export function zoomAroundPoint(
  view: CanvasView,
  nextZoom: number,
  anchorX: number,
  anchorY: number
): CanvasView {
  const zoom = clamp(nextZoom, MIN_ZOOM, MAX_ZOOM)
  return {
    zoom,
    scrollX: view.scrollX + anchorX / zoom - anchorX / view.zoom,
    scrollY: view.scrollY + anchorY / zoom - anchorY / view.zoom,
  }
}

/**
 * Excalidraw's wheel step: ten points a notch, and a little more the
 * further in you already are.
 */
export function zoomByWheel(view: CanvasView, deltaY: number): number {
  const sign = Math.sign(deltaY)
  const absDelta = Math.abs(deltaY)
  const maxStep = ZOOM_STEP * 100
  const delta = absDelta > maxStep ? maxStep * sign : deltaY
  let next = view.zoom - delta / 100
  next +=
    Math.log10(Math.max(1, view.zoom)) * -sign * Math.min(1, absDelta / 20)
  return clamp(next, MIN_ZOOM, MAX_ZOOM)
}

/**
 * The zoom that fits the whole page into the canvas.
 *
 * Excalidraw's "scale-down": the page fills the canvas, but it is never
 * blown up past its own size.
 */
export function fitZoom(
  naturalWidth: number,
  naturalHeight: number,
  viewportWidth: number,
  viewportHeight: number,
  margin = FIT_MARGIN
): number {
  if (!naturalWidth || !naturalHeight) return 1
  if (!viewportWidth || !viewportHeight) return 1
  return Math.min(
    (viewportWidth - margin) / naturalWidth,
    (viewportHeight - margin) / naturalHeight,
    1
  )
}

/** The scroll that puts the middle of the page in the middle of the canvas. */
export function centerScroll(
  viewportWidth: number,
  viewportHeight: number,
  zoom: number,
  naturalWidth: number,
  naturalHeight: number
): { scrollX: number; scrollY: number } {
  return {
    scrollX: viewportWidth / 2 / zoom - naturalWidth / 2,
    scrollY: viewportHeight / 2 / zoom - naturalHeight / 2,
  }
}

export interface NoticeCanvasHandle {
  /** Zoom in around the middle of the view. */
  zoomIn: () => void
  /** Zoom out around the middle of the view. */
  zoomOut: () => void
  /** Fit the whole image into the view. */
  fit: () => void
}

export interface NoticeCanvasProps {
  src: string
  naturalWidth: number
  naturalHeight: number
  /**
   * Which page is on the canvas. The canvas re-frames itself when this
   * changes, so a new page always arrives fitted into the view.
   */
  pageKey?: string
  className?: string
  /** Overlays, drawn on top of the image. */
  children?: React.ReactNode
  /**
   * When true, dragging on the canvas moves the page instead of drawing.
   * The dock's "Move" tool turns this on.
   */
  panning?: boolean
  /** Called when the zoom changes, so the toolbar can show the percentage. */
  onZoomChange?: (zoom: number) => void
}

/**
 * An unbounded canvas holding one image.
 *
 * The canvas is a fixed-size window onto an infinite scene — the same idea
 * Excalidraw is built on. The window never grows: the page is drawn at
 * `zoom` and placed at `scrollX`/`scrollY`, and everything that is off the
 * window is simply not drawn. That is what makes the page grow past the
 * edge of the card when you zoom in, and what makes dragging it around feel
 * like moving a sheet of paper rather than scrolling a picture.
 *
 * The rules:
 *
 * - **scrolling zooms** to the cursor, the way a photo editor does;
 * - **dragging moves the page** with the Move tool, with space held, or
 *   with the middle button;
 * - the zoom runs from 10 % to 3000 %, in steps of ten points.
 */
export function NoticeCanvas({
  src,
  naturalWidth,
  naturalHeight,
  pageKey,
  className,
  children,
  panning = false,
  onZoomChange,
  ref,
}: NoticeCanvasProps & { ref?: React.Ref<NoticeCanvasHandle> }) {
  const viewportRef = React.useRef<HTMLDivElement | null>(null)
  const [view, setView] = React.useState<CanvasView>({
    zoom: 1,
    scrollX: 0,
    scrollY: 0,
  })
  const [isDragging, setIsDragging] = React.useState(false)
  const [spaceHeld, setSpaceHeld] = React.useState(false)

  // The native listeners need the newest view without waiting for a render.
  const viewRef = React.useRef(view)
  React.useEffect(() => {
    viewRef.current = view
  }, [view])

  const onZoomChangeRef = React.useRef(onZoomChange)
  React.useEffect(() => {
    onZoomChangeRef.current = onZoomChange
  }, [onZoomChange])

  const applyView = React.useCallback((next: CanvasView) => {
    viewRef.current = next
    setView(next)
  }, [])

  /** Put the whole page into the canvas, the way Excalidraw fits a scene. */
  const fit = React.useCallback(() => {
    const element = viewportRef.current
    if (!element) return
    const width = element.clientWidth
    const height = element.clientHeight
    if (!width || !height || !naturalWidth || !naturalHeight) return
    const zoom = fitZoom(naturalWidth, naturalHeight, width, height)
    const scroll = centerScroll(
      width,
      height,
      zoom,
      naturalWidth,
      naturalHeight
    )
    applyView({ zoom, ...scroll })
    onZoomChangeRef.current?.(zoom)
  }, [naturalWidth, naturalHeight, applyView])

  const fitRef = React.useRef(fit)
  React.useEffect(() => {
    fitRef.current = fit
  }, [fit])

  // A new page arrives fitted into the canvas, so it is never out of sight.
  React.useEffect(() => {
    const frame = requestAnimationFrame(() => {
      fitRef.current()
    })
    return () => cancelAnimationFrame(frame)
  }, [pageKey])

  // Space turns a drag into a move of the page, the way it does in
  // Excalidraw — whatever tool is open.
  React.useEffect(() => {
    const isTyping = (target: EventTarget | null) => {
      const element = target as HTMLElement | null
      return Boolean(
        element &&
        (element.tagName === "INPUT" ||
          element.tagName === "TEXTAREA" ||
          element.isContentEditable)
      )
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.code !== "Space" || isTyping(event.target)) return
      setSpaceHeld(true)
    }
    const onKeyUp = (event: KeyboardEvent) => {
      if (event.code !== "Space") return
      setSpaceHeld(false)
    }
    const onBlur = () => setSpaceHeld(false)
    window.addEventListener("keydown", onKeyDown)
    window.addEventListener("keyup", onKeyUp)
    window.addEventListener("blur", onBlur)
    return () => {
      window.removeEventListener("keydown", onKeyDown)
      window.removeEventListener("keyup", onKeyUp)
      window.removeEventListener("blur", onBlur)
    }
  }, [])

  // The wheel zooms, the way it does in a photo editor: the page grows
  // under the cursor. It is bound natively so it can be non-passive — the
  // canvas keeps the wheel, and the page underneath does not scroll while
  // the pointer is over the photo.
  React.useEffect(() => {
    const element = viewportRef.current
    if (!element) return
    const handleWheel = (event: WheelEvent) => {
      if (!event.deltaY) return
      event.preventDefault()
      const rect = element.getBoundingClientRect()
      const current = viewRef.current
      const next = zoomAroundPoint(
        current,
        zoomByWheel(current, event.deltaY),
        event.clientX - rect.left,
        event.clientY - rect.top
      )
      applyView(next)
      onZoomChangeRef.current?.(next.zoom)
    }
    element.addEventListener("wheel", handleWheel, { passive: false })
    return () => element.removeEventListener("wheel", handleWheel)
  }, [applyView])

  // Dragging the page around.
  const startPan = (event: React.PointerEvent<HTMLDivElement>) => {
    const element = viewportRef.current
    if (!element) return
    event.preventDefault()
    element.focus({ preventScroll: true })

    let lastX = event.clientX
    let lastY = event.clientY
    let pendingX = 0
    let pendingY = 0
    let frame = 0

    // One move per frame, like Excalidraw's throttled pointer move.
    const flush = () => {
      frame = 0
      if (!pendingX && !pendingY) return
      const current = viewRef.current
      const next = {
        ...current,
        scrollX: current.scrollX - pendingX / current.zoom,
        scrollY: current.scrollY - pendingY / current.zoom,
      }
      pendingX = 0
      pendingY = 0
      applyView(next)
    }

    const move = (moveEvent: PointerEvent) => {
      pendingX += lastX - moveEvent.clientX
      pendingY += lastY - moveEvent.clientY
      lastX = moveEvent.clientX
      lastY = moveEvent.clientY
      if (!frame) frame = requestAnimationFrame(flush)
    }

    const stop = () => {
      if (frame) cancelAnimationFrame(frame)
      window.removeEventListener("pointermove", move)
      window.removeEventListener("pointerup", stop)
      window.removeEventListener("pointercancel", stop)
      setIsDragging(false)
    }

    window.addEventListener("pointermove", move)
    window.addEventListener("pointerup", stop)
    window.addEventListener("pointercancel", stop)
    setIsDragging(true)
  }

  // The Move tool drags the page.
  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!panning) return
    startPan(event)
  }

  // Space or the middle button move the page whatever tool is open: the
  // pointer never reaches the overlay, so the page moves instead of being
  // drawn on.
  const handlePointerDownCapture = (
    event: React.PointerEvent<HTMLDivElement>
  ) => {
    if (event.button !== 1 && !spaceHeld) return
    event.stopPropagation()
    startPan(event)
  }

  // The zoom buttons in the toolbar drive the canvas.
  React.useImperativeHandle(
    ref,
    () => ({
      zoomIn: () => {
        const element = viewportRef.current
        if (!element) return
        const current = viewRef.current
        const next = zoomAroundPoint(
          current,
          current.zoom + ZOOM_STEP,
          element.clientWidth / 2,
          element.clientHeight / 2
        )
        applyView(next)
        onZoomChangeRef.current?.(next.zoom)
      },
      zoomOut: () => {
        const element = viewportRef.current
        if (!element) return
        const current = viewRef.current
        const next = zoomAroundPoint(
          current,
          current.zoom - ZOOM_STEP,
          element.clientWidth / 2,
          element.clientHeight / 2
        )
        applyView(next)
        onZoomChangeRef.current?.(next.zoom)
      },
      fit: () => {
        fitRef.current()
      },
    }),
    [applyView]
  )

  const box = React.useMemo<CanvasBox>(
    () => ({
      left: view.scrollX * view.zoom,
      top: view.scrollY * view.zoom,
      width: naturalWidth * view.zoom,
      height: naturalHeight * view.zoom,
    }),
    [view.scrollX, view.scrollY, view.zoom, naturalWidth, naturalHeight]
  )

  const toImage = React.useCallback(
    (clientX: number, clientY: number): ImagePoint => {
      const element = viewportRef.current
      if (!element) return { x: 0, y: 0 }
      const rect = element.getBoundingClientRect()
      return {
        x: (clientX - rect.left) / view.zoom - view.scrollX,
        y: (clientY - rect.top) / view.zoom - view.scrollY,
      }
    },
    [view.zoom, view.scrollX, view.scrollY]
  )

  const toWorld = React.useCallback(
    (imageX: number, imageY: number): ImagePoint => ({
      x: box.left + imageX * view.zoom,
      y: box.top + imageY * view.zoom,
    }),
    [box.left, box.top, view.zoom]
  )

  const transform = React.useMemo<CanvasTransform>(
    () => ({
      zoom: view.zoom,
      scrollX: view.scrollX,
      scrollY: view.scrollY,
      box,
      toImage,
      toWorld,
    }),
    [view.zoom, view.scrollX, view.scrollY, box, toImage, toWorld]
  )

  const canPan = panning || spaceHeld

  return (
    <CanvasContext.Provider value={transform}>
      <div
        ref={viewportRef}
        tabIndex={0}
        onPointerDown={handlePointerDown}
        onPointerDownCapture={handlePointerDownCapture}
        className={cn(
          "relative h-full w-full overflow-hidden bg-muted/40",
          "focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none focus-visible:ring-inset",
          className
        )}
        style={{
          cursor: isDragging ? "grabbing" : canPan ? "grab" : undefined,
          touchAction: "none",
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt=""
          draggable={false}
          // The photo is sized in screen pixels and can grow past the
          // canvas. Tailwind's preflight caps images at the width of their
          // container, which would squash the photo instead of zooming it.
          className="pointer-events-none absolute max-w-none select-none"
          style={{
            left: box.left,
            top: box.top,
            width: box.width,
            height: box.height,
          }}
        />
        {children}
      </div>
    </CanvasContext.Provider>
  )
}

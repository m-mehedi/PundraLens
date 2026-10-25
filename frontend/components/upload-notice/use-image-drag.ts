"use client"

import * as React from "react"

import { useCanvas, type ImagePoint } from "./notice-canvas"

/**
 * Creates pointer drags that report positions in image pixels.
 *
 * Every overlay that can be dragged — the corner handles, the crop
 * rectangle, the mask shapes — uses this, so they all feel the same.
 */
export function useImageDrag() {
  const { toImage } = useCanvas()

  return React.useCallback(
    (
      onMove: (point: ImagePoint) => void,
      onEnd?: (point: ImagePoint) => void
    ) =>
      (event: React.PointerEvent<Element>) => {
        event.preventDefault()
        event.stopPropagation()

        const move = (moveEvent: PointerEvent) => {
          onMove(toImage(moveEvent.clientX, moveEvent.clientY))
        }
        const stop = (stopEvent: PointerEvent) => {
          const point = toImage(stopEvent.clientX, stopEvent.clientY)
          onMove(point)
          onEnd?.(point)
          window.removeEventListener("pointermove", move)
          window.removeEventListener("pointerup", stop)
          window.removeEventListener("pointercancel", stop)
        }

        window.addEventListener("pointermove", move)
        window.addEventListener("pointerup", stop)
        window.addEventListener("pointercancel", stop)
      },
    [toImage]
  )
}

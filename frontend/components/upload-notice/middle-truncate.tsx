"use client"

import * as React from "react"

import { createMeasurer, truncateMiddle } from "@/lib/truncate-middle"
import { cn } from "@/lib/utils"

export interface MiddleTruncateProps {
  name: string
  className?: string
}

/**
 * A file name that is shortened in the middle when it does not fit.
 *
 * The whole name stays in the DOM for the screen readers, and in the
 * tooltip for anyone who wants to read it.
 */
export function MiddleTruncate({ name, className }: MiddleTruncateProps) {
  const ref = React.useRef<HTMLSpanElement | null>(null)
  const [display, setDisplay] = React.useState(name)

  React.useEffect(() => {
    const element = ref.current
    if (!element) return

    const update = () => {
      const available = element.clientWidth
      if (available <= 0) return
      const style = getComputedStyle(element)
      const measure = createMeasurer(
        [
          style.fontStyle,
          style.fontVariant,
          style.fontWeight,
          style.fontSize,
          style.fontFamily,
        ].join(" ")
      )
      setDisplay(truncateMiddle(name, measure, { maxWidth: available }))
    }

    update()
    const observer = new ResizeObserver(update)
    observer.observe(element)
    return () => observer.disconnect()
  }, [name])

  return (
    <span
      ref={ref}
      className={cn("block min-w-0 truncate", className)}
      title={name}
      dir="auto"
    >
      {display}
    </span>
  )
}

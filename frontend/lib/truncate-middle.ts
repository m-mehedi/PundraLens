/**
 * Truncating a name in the middle, the way macOS does.
 *
 * The extension is always kept — `Annual-Notice-2026…-Final.pdf` — because
 * the end of a file name is where the version and the type live.
 */

export interface TruncateMiddleOptions {
  /** The width available, in CSS pixels. */
  maxWidth: number
  /** The smallest number of characters kept at the head. */
  minHead?: number
  /** The smallest number of characters kept at the tail. */
  minTail?: number
  /** The ellipsis. Use "…", not three dots. */
  ellipsis?: string
}

/** Split "name.ext" into its stem and its extension. */
export function splitExtension(name: string): {
  stem: string
  ext: string
} {
  const dot = name.lastIndexOf(".")
  // No dot, a dotfile, or a name that ends with a dot.
  if (dot <= 0 || dot === name.length - 1) {
    return { stem: name, ext: "" }
  }
  return { stem: name.slice(0, dot), ext: name.slice(dot) }
}

/**
 * Measure text the way the browser will draw it.
 *
 * A canvas measures without touching the layout, so the binary search
 * below does not cause a reflow on every step.
 */
export function createMeasurer(font: string): (text: string) => number {
  if (typeof document === "undefined") return () => 0
  const canvas = document.createElement("canvas")
  const context = canvas.getContext("2d")
  if (!context) return () => 0
  context.font = font
  return (text: string) => context.measureText(text).width
}

/**
 * Shorten a name so it fits, keeping the beginning and the end.
 *
 * The split point is found by binary search over how many characters of
 * the stem survive, which is a handful of measurements whatever the length
 * of the name.
 */
export function truncateMiddle(
  name: string,
  measure: (text: string) => number,
  options: TruncateMiddleOptions
): string {
  const { maxWidth, minHead = 1, minTail = 1, ellipsis = "…" } = options

  if (!name) return name
  if (maxWidth <= 0) return name
  if (measure(name) <= maxWidth) return name

  const { stem, ext } = splitExtension(name)
  const ellipsisWidth = measure(ellipsis)
  const extWidth = measure(ext)

  // Not even the ellipsis and the extension fit — the extension is the
  // most useful thing left.
  if (ellipsisWidth + extWidth > maxWidth) {
    return ext ? `${ellipsis}${ext}` : ellipsis
  }

  // The widest candidate that still fits, split as evenly as possible.
  const candidate = (keep: number) => {
    const head = Math.ceil(keep / 2)
    const tail = keep - head
    const body =
      tail === 0
        ? stem.slice(0, head)
        : stem.slice(0, head) + ellipsis + stem.slice(stem.length - tail)
    return body + ext
  }

  let low = minHead + minTail
  let high = stem.length
  let best: string | null = null

  while (low <= high) {
    const middle = Math.floor((low + high) / 2)
    const text = candidate(middle)
    if (measure(text) <= maxWidth) {
      best = text
      low = middle + 1
    } else {
      high = middle - 1
    }
  }

  return best ?? (ext ? `${ellipsis}${ext}` : ellipsis)
}

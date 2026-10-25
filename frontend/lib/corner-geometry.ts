import type { Corner, MaskShape, Rect } from "@/components/upload-notice/types"
import type { PixelRect } from "@/lib/image-ops"

/** Keep a percentage inside the 0-100 range the backend accepts. */
export function clampPercent(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.min(Math.max(value, 0), 100)
}

/** Clamp a corner so it can never be sent outside the image. */
export function clampCorner(corner: Corner): Corner {
  return {
    x: clampPercent(corner.x),
    y: clampPercent(corner.y),
  }
}

/** Convert a percentage rectangle into pixels of an image of the given size. */
export function rectToPixels(
  rect: Rect,
  width: number,
  height: number
): PixelRect {
  const left = Math.round((rect.x / 100) * width)
  const top = Math.round((rect.y / 100) * height)
  return {
    left,
    top,
    width: Math.max(1, Math.round((rect.width / 100) * width)),
    height: Math.max(1, Math.round((rect.height / 100) * height)),
  }
}

/** Convert a pixel rectangle into percentages of an image of the given size. */
export function rectFromPixels(
  rect: PixelRect,
  width: number,
  height: number
): Rect {
  if (width <= 0 || height <= 0) {
    return { x: 0, y: 0, width: 0, height: 0 }
  }
  return {
    x: (rect.left / width) * 100,
    y: (rect.top / height) * 100,
    width: (rect.width / width) * 100,
    height: (rect.height / height) * 100,
  }
}

/** Normalise a rectangle so it always has a positive size and stays in bounds. */
export function normalizeRect(rect: Rect): Rect {
  const x = clampPercent(Math.min(rect.x, rect.x + rect.width))
  const y = clampPercent(Math.min(rect.y, rect.y + rect.height))
  const right = clampPercent(Math.max(rect.x, rect.x + rect.width))
  const bottom = clampPercent(Math.max(rect.y, rect.y + rect.height))
  return {
    x,
    y,
    width: Math.max(0, right - x),
    height: Math.max(0, bottom - y),
  }
}

/** The crop operations of an edit list, in the order they were applied. */
export interface CropFrame {
  rect: Rect
  frameWidth: number
  frameHeight: number
}

/**
 * Map points from the base image into the frame produced by `crops`.
 *
 * A crop takes a region of the current frame and makes it the whole next
 * frame, so pixels keep their scale and only shift by the crop origin.
 */
function applyCrops(points: Corner[], crops: CropFrame[]): Corner[] {
  return points.map((point) => {
    let { x, y } = point
    for (const crop of crops) {
      const nextWidth = (crop.rect.width / 100) * crop.frameWidth
      const nextHeight = (crop.rect.height / 100) * crop.frameHeight
      const left = (crop.rect.x / 100) * crop.frameWidth
      const top = (crop.rect.y / 100) * crop.frameHeight
      x = (((x / 100) * crop.frameWidth - left) / nextWidth) * 100
      y = (((y / 100) * crop.frameHeight - top) / nextHeight) * 100
    }
    return { x, y }
  })
}

/**
 * Map points from the frame produced by `fromCrops` into the frame produced
 * by `toCrops`. Used to keep the corners aligned when a crop is added or
 * removed.
 */
export function remapPoints(
  points: Corner[],
  fromCrops: CropFrame[],
  toCrops: CropFrame[]
): Corner[] {
  if (fromCrops.length === 0 && toCrops.length === 0) return points
  // Undo the current crops to get back to the base image, then apply the new
  // ones. A crop is a pure shift at pixel scale, so this is exact.
  const base = points.map((point) => {
    let { x, y } = point
    for (const crop of [...fromCrops].reverse()) {
      const nextWidth = (crop.rect.width / 100) * crop.frameWidth
      const nextHeight = (crop.rect.height / 100) * crop.frameHeight
      const left = (crop.rect.x / 100) * crop.frameWidth
      const top = (crop.rect.y / 100) * crop.frameHeight
      x = (((x / 100) * nextWidth + left) / crop.frameWidth) * 100
      y = (((y / 100) * nextHeight + top) / crop.frameHeight) * 100
    }
    return { x, y }
  })
  return applyCrops(base, toCrops)
}

/**
 * The geometry of one crop, in the frame it applies to.
 *
 * A crop takes a rectangle out of the frame and that rectangle becomes the
 * whole next frame, so in pixels it is a pure shift — only the percentages
 * change, because the frame itself is a different size.
 */
interface CropGeometry {
  /** The size of the frame the crop is taken from. */
  frameWidth: number
  frameHeight: number
  /** The size of the frame the crop leaves behind. */
  nextWidth: number
  nextHeight: number
  /** Where the crop sits in the frame it is taken from, in pixels. */
  left: number
  top: number
}

function cropGeometry(crop: CropFrame): CropGeometry {
  return {
    frameWidth: crop.frameWidth,
    frameHeight: crop.frameHeight,
    nextWidth: (crop.rect.width / 100) * crop.frameWidth,
    nextHeight: (crop.rect.height / 100) * crop.frameHeight,
    left: (crop.rect.x / 100) * crop.frameWidth,
    top: (crop.rect.y / 100) * crop.frameHeight,
  }
}

/** Map a point and a length from one frame to the next. */
function mapThroughCrop(
  crop: CropFrame,
  point: { x: number; y: number },
  length: { x: number; y: number },
  forward: boolean
) {
  const geometry = cropGeometry(crop)
  if (forward) {
    return {
      point: {
        x:
          (((point.x / 100) * geometry.frameWidth - geometry.left) /
            geometry.nextWidth) *
          100,
        y:
          (((point.y / 100) * geometry.frameHeight - geometry.top) /
            geometry.nextHeight) *
          100,
      },
      length: {
        x:
          (((length.x / 100) * geometry.frameWidth) / geometry.nextWidth) * 100,
        y:
          (((length.y / 100) * geometry.frameHeight) / geometry.nextHeight) *
          100,
      },
    }
  }
  return {
    point: {
      x:
        (((point.x / 100) * geometry.nextWidth + geometry.left) /
          geometry.frameWidth) *
        100,
      y:
        (((point.y / 100) * geometry.nextHeight + geometry.top) /
          geometry.frameHeight) *
        100,
    },
    length: {
      x: (((length.x / 100) * geometry.nextWidth) / geometry.frameWidth) * 100,
      y:
        (((length.y / 100) * geometry.nextHeight) / geometry.frameHeight) * 100,
    },
  }
}

function mapShapeThroughCrop(
  shape: MaskShape,
  crop: CropFrame,
  forward: boolean
): MaskShape {
  const map = (point: [number, number], length: { x: number; y: number }) => {
    const mapped = mapThroughCrop(
      crop,
      { x: point[0], y: point[1] },
      length,
      forward
    )
    return {
      point: [mapped.point.x, mapped.point.y] as [number, number],
      length: mapped.length,
    }
  }

  switch (shape.kind) {
    case "rect": {
      const mapped = map([shape.x, shape.y], {
        x: shape.width,
        y: shape.height,
      })
      return {
        ...shape,
        x: mapped.point[0],
        y: mapped.point[1],
        width: mapped.length.x,
        height: mapped.length.y,
      }
    }
    case "circle": {
      const mapped = map([shape.cx, shape.cy], {
        x: shape.radius,
        y: shape.radius,
      })
      return {
        ...shape,
        cx: mapped.point[0],
        cy: mapped.point[1],
        radius: mapped.length.x,
      }
    }
    case "triangle":
    case "polygon":
      return {
        ...shape,
        points: shape.points.map((point) => map(point, { x: 0, y: 0 }).point),
      }
    case "stroke":
      return {
        ...shape,
        points: shape.points.map((point) => map(point, { x: 0, y: 0 }).point),
        width: map([0, 0], { x: shape.width, y: shape.width }).length.x,
      }
  }
}

/**
 * Move a set of hidden regions from one set of crops to another.
 *
 * The same chain the corners go through: undo the crops that were in
 * effect, then apply the ones that are.
 */
export function remapShapes(
  shapes: MaskShape[],
  fromCrops: CropFrame[],
  toCrops: CropFrame[]
): MaskShape[] {
  if (fromCrops.length === 0 && toCrops.length === 0) return shapes
  let current = shapes
  for (const crop of [...fromCrops].reverse()) {
    current = current.map((shape) => mapShapeThroughCrop(shape, crop, false))
  }
  for (const crop of toCrops) {
    current = current.map((shape) => mapShapeThroughCrop(shape, crop, true))
  }
  return current
}

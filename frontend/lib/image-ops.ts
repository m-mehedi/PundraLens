import type { Image as ImageJS } from "image-js"

import type { MaskShape } from "@/components/upload-notice/types"

/** A rectangle in the natural pixel space of an image. */
export interface PixelRect {
  left: number
  top: number
  width: number
  height: number
}

/**
 * Turn the backend's preview payload into a usable image source.
 *
 * The backend sends a complete data URL. A bare base64 payload is prefixed
 * here instead of being handed to the browser as a broken image.
 */
export function toPreviewSrc(
  payload: string | null | undefined
): string | null {
  if (!payload) return null
  if (payload.startsWith("data:")) return payload
  return `data:image/jpeg;base64,${payload}`
}

/**
 * The classic 3x3 Laplacian sharpening mask. The kernel sums to 1, so flat
 * areas stay untouched while edges gain contrast.
 */
const SHARPEN_KERNEL = [
  [0, -1, 0],
  [-1, 5, -1],
  [0, -1, 0],
]

/** JPEG quality used for every re-encode. High enough for OCR, small enough to upload. */
const JPEG_QUALITY = 92

/**
 * `image-js` is only needed once the user actually edits an image, so it is
 * loaded on demand instead of shipping in the initial bundle.
 */
async function imageJs() {
  return await import("image-js")
}

/**
 * Decode a blob into an image, applying the EXIF orientation.
 *
 * Phone photos are usually stored rotated with an orientation tag. Both the
 * cropper and the corner coordinates assume an upright image, so the tag has
 * to be resolved here — once — instead of at three different places.
 */
export async function decodeImage(source: Blob): Promise<ImageJS> {
  const bitmap = await createOrientedBitmap(source)
  const canvas = document.createElement("canvas")
  canvas.width = bitmap.width
  canvas.height = bitmap.height
  const context = canvas.getContext("2d")
  if (!context) {
    throw new Error("This browser cannot read the image (no 2D canvas).")
  }
  // Flatten any transparency onto white so the notice keeps a paper
  // background instead of turning black further down the pipeline.
  context.fillStyle = "#ffffff"
  context.fillRect(0, 0, canvas.width, canvas.height)
  context.drawImage(bitmap, 0, 0)
  bitmap.close()

  const { readCanvas } = await imageJs()
  const image = readCanvas(canvas)
  // Three channels keep the masking colour simple and the JPEG smaller.
  return image.colorModel === "RGB" ? image : image.convertColor("RGB")
}

async function createOrientedBitmap(source: Blob): Promise<ImageBitmap> {
  try {
    return await createImageBitmap(source, { imageOrientation: "from-image" })
  } catch {
    // Older browsers ignore the option but still decode the image.
    return await createImageBitmap(source)
  }
}

/** Encode an image as a JPEG blob. */
export async function encodeJpeg(image: ImageJS): Promise<Blob> {
  const { encode } = await imageJs()
  const data = encode(image, {
    format: "jpeg",
    encoderOptions: { quality: JPEG_QUALITY },
  })
  return new Blob([data as unknown as BlobPart], { type: "image/jpeg" })
}

/** Cut a rectangle out of an image. */
export function cropImage(image: ImageJS, rect: PixelRect): ImageJS {
  return image.crop({
    origin: { row: rect.top, column: rect.left },
    width: rect.width,
    height: rect.height,
  })
}

/** Convert an image to grayscale, keeping three channels so it can be encoded. */
export function grayscaleImage(image: ImageJS): ImageJS {
  return image.grey().convertColor("RGB")
}

/** Sharpen an image. */
export function sharpenImage(image: ImageJS): ImageJS {
  return image.directConvolution(SHARPEN_KERNEL)
}

/** Paint a solid black rectangle over an image — used to hide a region. */
export function maskImage(image: ImageJS, rect: PixelRect): ImageJS {
  return image.drawRectangle({
    origin: { row: rect.top, column: rect.left },
    width: rect.width,
    height: rect.height,
    fillColor: [0, 0, 0],
    strokeColor: [0, 0, 0],
  })
}

/**
 * Paint a set of hidden regions over an image.
 *
 * The shapes are percentages of the image, so they land where they were
 * drawn whatever the zoom was. They go onto a canvas rather than into
 * image-js directly: the canvas rasteriser is faster, anti-aliases the
 * edges, and handles a freehand stroke without a second implementation.
 */
export async function maskShapes(
  image: ImageJS,
  shapes: MaskShape[]
): Promise<ImageJS> {
  if (shapes.length === 0) return image

  const { readCanvas, writeCanvas } = await import("image-js")
  const canvas = document.createElement("canvas")
  canvas.width = image.width
  canvas.height = image.height
  const context = canvas.getContext("2d")
  if (!context) {
    throw new Error("This browser cannot edit the image (no 2D canvas).")
  }

  // The image goes down first — putImageData replaces pixels wholesale, so
  // anything drawn before it would be erased.
  writeCanvas(image, canvas)

  context.fillStyle = "#000000"
  context.strokeStyle = "#000000"
  context.lineCap = "round"
  context.lineJoin = "round"

  const width = image.width
  const height = image.height
  const px = (value: number) => (value / 100) * width
  const py = (value: number) => (value / 100) * height

  for (const shape of shapes) {
    if (shape.kind === "rect") {
      context.fillRect(
        px(shape.x),
        py(shape.y),
        px(shape.width),
        py(shape.height)
      )
    } else if (shape.kind === "circle") {
      context.beginPath()
      context.arc(px(shape.cx), py(shape.cy), px(shape.radius), 0, Math.PI * 2)
      context.fill()
    } else if (shape.kind === "triangle" || shape.kind === "polygon") {
      if (shape.points.length === 0) continue
      context.beginPath()
      shape.points.forEach(([x, y], index) => {
        if (index === 0) context.moveTo(px(x), py(y))
        else context.lineTo(px(x), py(y))
      })
      context.closePath()
      context.fill()
    } else {
      if (shape.points.length === 0) continue
      context.lineWidth = px(shape.width)
      context.beginPath()
      shape.points.forEach(([x, y], index) => {
        if (index === 0) context.moveTo(px(x), py(y))
        else context.lineTo(px(x), py(y))
      })
      context.stroke()
    }
  }

  const masked = readCanvas(canvas)
  return masked.colorModel === "RGB" ? masked : masked.convertColor("RGB")
}

import { readErrorDetail } from "@/lib/backend-error"

/** One page of a PDF, rendered so it can be edited like a photo. */
export interface PdfPage {
  /** 1-based page number. */
  page: number
  width: number
  height: number
  /** The rendered page. */
  blob: Blob
  /** A blob URL of the page. */
  url: string
  /** A small render for the filmstrip. */
  thumbUrl: string
}

interface RenderResponse {
  success: boolean
  data?: {
    dpi: number
    page_count: number
    /** How many pages the document has, even when some were not rendered. */
    total_pages: number
    pages: Array<{
      page: number
      width: number
      height: number
      image: string
    }>
  }
  detail?: string
}

/**
 * Render every page of a PDF as an image.
 *
 * The pages come back as PNGs from the same 200 DPI the OCR pipeline reads,
 * so a page the editor straightens is the page the model ends up seeing.
 */
export async function renderPdfPages(
  file: File,
  dpi = 200
): Promise<{ pages: PdfPage[]; totalPages: number }> {
  const formData = new FormData()
  formData.append("file", file)
  formData.append("dpi", String(dpi))

  const response = await fetch("/api/pipeline/render", {
    method: "POST",
    body: formData,
  })
  if (!response.ok) {
    throw new Error(
      await readErrorDetail(response, "Could not read the pages of the PDF")
    )
  }

  const payload = (await response.json()) as RenderResponse
  const pages = payload.data?.pages
  if (!Array.isArray(pages)) {
    throw new Error("Could not read the pages of the PDF")
  }

  const rendered: PdfPage[] = []
  for (const page of pages) {
    const bytes = Uint8Array.from(atob(page.image), (char) =>
      char.charCodeAt(0)
    )
    const blob = new Blob([bytes], { type: "image/png" })
    rendered.push({
      page: page.page,
      width: page.width,
      height: page.height,
      blob,
      url: URL.createObjectURL(blob),
      thumbUrl: (await makeThumbnail(blob)).url,
    })
  }
  return {
    pages: rendered,
    totalPages: payload.data?.total_pages ?? rendered.length,
  }
}

/**
 * A small render of an image, for the filmstrip.
 *
 * The full page is several megabytes once decoded; the strip only needs
 * something the size of a thumbnail.
 */
export async function makeThumbnail(
  source: Blob,
  width = 240
): Promise<{ url: string; width: number; height: number }> {
  const bitmap = await createImageBitmap(source, {
    imageOrientation: "from-image",
  })
  const naturalWidth = bitmap.width
  const naturalHeight = bitmap.height
  const scale = Math.min(1, width / bitmap.width)
  const canvas = document.createElement("canvas")
  canvas.width = Math.max(1, Math.round(bitmap.width * scale))
  canvas.height = Math.max(1, Math.round(bitmap.height * scale))
  const context = canvas.getContext("2d")
  if (!context) {
    bitmap.close()
    return { url: "", width: naturalWidth, height: naturalHeight }
  }
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  bitmap.close()
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/jpeg", 0.8)
  )
  return {
    url: blob ? URL.createObjectURL(blob) : "",
    width: naturalWidth,
    height: naturalHeight,
  }
}

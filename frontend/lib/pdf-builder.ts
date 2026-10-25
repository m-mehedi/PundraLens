/**
 * The pages of a document, as one PDF.
 *
 * The model is given a single file: every page of the document, in order,
 * as a PDF. The backend reads it page by page, so a notice that was
 * photographed over several sheets arrives as one document.
 *
 * `pdf-lib` is only needed when a notice is read, so it is loaded on
 * demand instead of shipping in the initial bundle.
 */

/** One page of the document. */
export interface PdfPage {
  /** The picture of the page. */
  blob: Blob
  /** Its width in pixels. */
  width: number
  /** Its height in pixels. */
  height: number
}

/**
 * Put the pages into a PDF.
 *
 * The pages keep their own proportions and are measured in points at
 * seventy-two to the inch, so a page that is 1654 pixels wide comes out as
 * an A4-ish sheet.
 */
export async function buildDocumentPdf(pages: PdfPage[]): Promise<Blob> {
  if (pages.length === 0) {
    throw new Error("There is nothing to read")
  }

  const { PDFDocument } = await import("pdf-lib")
  const document = await PDFDocument.create()

  for (const page of pages) {
    const bytes = new Uint8Array(await page.blob.arrayBuffer())
    const image = await document.embedJpg(bytes).catch(async () => {
      // A page that is not a JPEG (a PNG straight from a PDF) still goes in.
      return document.embedPng(bytes)
    })
    // Seventy-two points to the inch, so the page keeps its proportions.
    const width = (page.width / 72) * 72
    const height = (page.height / 72) * 72
    const sheet = document.addPage([width, height])
    sheet.drawImage(image, { x: 0, y: 0, width, height })
  }

  const bytes = await document.save()
  return new Blob([bytes as unknown as BlobPart], { type: "application/pdf" })
}

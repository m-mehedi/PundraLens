"use client"

import * as React from "react"
import type { Image as ImageJS } from "image-js"
import { toast } from "sonner"

import { useModels } from "@/hooks/use-models"
import { readErrorDetail } from "@/lib/backend-error"
import {
  clampCorner,
  normalizeRect,
  remapPoints,
  remapShapes,
  type CropFrame,
} from "@/lib/corner-geometry"
import {
  cropImage,
  decodeImage,
  encodeJpeg,
  grayscaleImage,
  maskShapes as bakeMaskShapes,
  sharpenImage,
} from "@/lib/image-ops"
import { readDraftItems, type DraftDocument } from "@/lib/draft-store"
import { buildDocumentPdf } from "@/lib/pdf-builder"
import { makeThumbnail, renderPdfPages } from "@/lib/pdf-pages"

import { setUploadProgress } from "./upload-progress"

import type {
  AlignResponse,
  Corner,
  DocumentMode,
  EditOp,
  EditorTool,
  ExtractResult,
  ItemResult,
  MaskShape,
  MaskShapeKind,
  NoticeItem,
  PreviewImage,
  Rect,
} from "./types"

const UPLOAD_NAME = "notice.jpg"

/** How many steps the workbench remembers. */
const MAX_HISTORY = 60
/** How long a burst of typing counts as one step. */
const COALESCE_MS = 900

/**
 * One page as the history remembers it.
 *
 * The rendered preview is kept as a blob rather than as a URL: a URL that
 * was revoked when the page was re-rendered would come back as a broken
 * image, the blob never does.
 */
interface SnapshotItem {
  id: string
  label: string
  sourceFile: File
  sourceUrl: string
  thumbUrl: string
  sourceWidth: number
  sourceHeight: number
  baseFile: File
  ops: EditOp[]
  points: Corner[]
  autoFilled: boolean[]
  preview?: { blob: Blob; width: number; height: number }
  revision: number
  edited: boolean
}

/** The whole document as the history remembers it. */
interface Snapshot {
  items: SnapshotItem[]
  activeId: string | null
  text: string
  textName: string | null
  documentName: string | null
  mode: DocumentMode
}

interface HistoryEntry {
  snapshot: Snapshot
  /** Typing is one step, however many characters it was. */
  kind: "document" | "text"
  at: number
}

function isCrop(op: EditOp): op is EditOp & { kind: "crop" } {
  return op.kind === "crop"
}

function toCropFrames(ops: EditOp[]): CropFrame[] {
  return ops.filter(isCrop).map((op) => ({
    rect: op.rect,
    frameWidth: op.frameWidth,
    frameHeight: op.frameHeight,
  }))
}

let opCounter = 0
function nextOpId(): string {
  opCounter += 1
  return `op-${opCounter}-${Date.now()}`
}

let itemCounter = 0
function nextItemId(): string {
  itemCounter += 1
  return `item-${itemCounter}-${Date.now()}`
}

function isPdf(file: File): boolean {
  return (
    file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")
  )
}

function isText(file: File): boolean {
  return (
    file.type.startsWith("text/") || file.name.toLowerCase().endsWith(".txt")
  )
}

function isImage(file: File): boolean {
  return file.type.startsWith("image/")
}

export function useUploadNotice() {
  const [mode, setMode] = React.useState<DocumentMode>("images")
  const [documentName, setDocumentName] = React.useState<string | null>(null)
  const [items, setItems] = React.useState<NoticeItem[]>([])
  const [activeId, setActiveId] = React.useState<string | null>(null)
  const [text, setTextRaw] = React.useState("")
  const [textName, setTextName] = React.useState<string | null>(null)

  const [tool, setToolState] = React.useState<EditorTool>("corners")
  const [cropDraft, setCropDraft] = React.useState<Rect | null>(null)
  const [cropAspect, setCropAspect] = React.useState<number | null>(null)
  const [maskShapes, setMaskShapes] = React.useState<MaskShape[]>([])
  const [maskKind, setMaskKind] = React.useState<MaskShapeKind>("rect")

  const [results, setResults] = React.useState<ItemResult[]>([])
  const [activeResultId, setActiveResultId] = React.useState<string | null>(
    null
  )

  const [isProcessing, setIsProcessing] = React.useState(false)
  const [isDetecting, setIsDetecting] = React.useState(false)
  const [isExtracting, setIsExtracting] = React.useState(false)
  const [extractStartedAt, setExtractStartedAt] = React.useState<number | null>(
    null
  )
  const [extractProgress, setExtractProgress] = React.useState<string | null>(
    null
  )
  const [alignError, setAlignError] = React.useState<string | null>(null)
  const [extractError, setExtractError] = React.useState<string | null>(null)
  const [selectedModel, setSelectedModel] = React.useState("")

  const { models, defaultKey } = useModels()
  const model = selectedModel || defaultKey

  const activeItem = items.find((item) => item.id === activeId) ?? null
  const activeIndex = items.findIndex((item) => item.id === activeId)
  const preview = activeItem?.preview ?? null
  const points = activeItem?.points ?? NO_CORNERS
  const autoFilled = activeItem?.autoFilled ?? []
  const ops = activeItem?.ops ?? []

  const activeResult =
    results.find((result) => result.id === activeResultId) ?? results[0] ?? null

  // Mirrors the corners of the open page so a drag can tell which corner
  // actually moved.
  const pointsRef = React.useRef<Corner[]>([])
  React.useEffect(() => {
    pointsRef.current = points
  }, [points])

  // The decoded base image is cached so every preview re-render does not
  // have to decode the file again.
  const baseImageRef = React.useRef<{ file: File; image: ImageJS } | null>(null)

  const itemsRef = React.useRef<NoticeItem[]>(items)
  React.useEffect(() => {
    itemsRef.current = items
  }, [items])

  // The rest of the document, mirrored so a snapshot can be taken at the
  // moment a change is made rather than a render later.
  const documentRef = React.useRef({
    activeId,
    text,
    textName,
    documentName,
    mode,
  })
  React.useEffect(() => {
    documentRef.current = {
      activeId,
      text,
      textName,
      documentName,
      mode,
    }
  }, [activeId, text, textName, documentName, mode])

  // --- the history ---------------------------------------------------------

  const historyRef = React.useRef<{
    past: HistoryEntry[]
    future: HistoryEntry[]
  }>({ past: [], future: [] })
  const [historyState, setHistoryState] = React.useState({
    canUndo: false,
    canRedo: false,
  })
  // The URLs handed out when a snapshot was put back, so they can be
  // revoked when the next one arrives.
  const restoredUrlsRef = React.useRef<string[]>([])

  /** Release the URLs of the pages the history still remembers. */
  const releaseHistoryUrls = React.useCallback(() => {
    const release = (entry: HistoryEntry) => {
      for (const item of entry.snapshot.items) {
        URL.revokeObjectURL(item.sourceUrl)
        URL.revokeObjectURL(item.thumbUrl)
      }
    }
    for (const entry of historyRef.current.past) release(entry)
    for (const entry of historyRef.current.future) release(entry)
  }, [])

  /** Release the URLs the history handed out when it put a page back. */
  const releaseRestoredUrls = React.useCallback(() => {
    for (const url of restoredUrlsRef.current) URL.revokeObjectURL(url)
    restoredUrlsRef.current = []
  }, [])

  React.useEffect(() => {
    return () => {
      for (const item of itemsRef.current) {
        URL.revokeObjectURL(item.sourceUrl)
        URL.revokeObjectURL(item.thumbUrl)
        if (item.preview) URL.revokeObjectURL(item.preview.url)
      }
      releaseHistoryUrls()
      releaseRestoredUrls()
    }
  }, [releaseHistoryUrls, releaseRestoredUrls])

  const getBaseImage = React.useCallback(async (file: File) => {
    if (baseImageRef.current?.file === file) {
      return baseImageRef.current.image
    }
    const image = await decodeImage(file)
    baseImageRef.current = { file, image }
    return image
  }, [])

  const renderPreview = React.useCallback(
    async (base: File, operations: EditOp[]): Promise<PreviewImage> => {
      let image = await getBaseImage(base)

      for (const op of operations) {
        if (op.kind === "crop") {
          image = cropImage(image, {
            left: Math.round((op.rect.x / 100) * image.width),
            top: Math.round((op.rect.y / 100) * image.height),
            width: Math.max(1, Math.round((op.rect.width / 100) * image.width)),
            height: Math.max(
              1,
              Math.round((op.rect.height / 100) * image.height)
            ),
          })
        } else if (op.kind === "grayscale") {
          image = grayscaleImage(image)
        } else if (op.kind === "sharpen") {
          image = sharpenImage(image)
        } else if (op.kind === "mask") {
          image = await bakeMaskShapes(image, op.shapes)
        }
      }

      const width = image.width
      const height = image.height

      // Nothing was changed — keep the original bytes so the upload is
      // exactly the photo the user picked.
      if (operations.length === 0) {
        return { url: URL.createObjectURL(base), blob: base, width, height }
      }

      const blob = await encodeJpeg(image)
      return { url: URL.createObjectURL(blob), blob, width, height }
    },
    [getBaseImage]
  )

  // Re-render the preview of the open page whenever its image or its
  // pending changes change.
  React.useEffect(() => {
    if (!activeItem) return
    if (
      activeItem.preview &&
      activeItem.previewRevision === activeItem.revision
    ) {
      return
    }

    const { id, baseFile, ops: operations, revision } = activeItem
    // The preview this one replaces. Only *this* URL is released: every
    // other page keeps its own, or it would come back as a broken image
    // the next time it is opened.
    const replacedUrl = activeItem.preview?.url
    let cancelled = false

    const run = async () => {
      setIsProcessing(true)
      try {
        const rendered = await renderPreview(baseFile, operations)
        if (cancelled) {
          URL.revokeObjectURL(rendered.url)
          return
        }
        if (replacedUrl) URL.revokeObjectURL(replacedUrl)
        setItems((previous) =>
          previous.map((item) =>
            item.id === id
              ? { ...item, preview: rendered, previewRevision: revision }
              : item
          )
        )
      } catch (err) {
        if (cancelled) return
        const message =
          err instanceof Error ? err.message : "Could not process the image"
        setAlignError(message)
        toast.error(message)
      } finally {
        if (!cancelled) setIsProcessing(false)
      }
    }

    void run()
    return () => {
      cancelled = true
    }
  }, [activeItem, renderPreview])

  const updateActive = React.useCallback(
    (updater: (item: NoticeItem) => NoticeItem) => {
      setItems((previous) =>
        previous.map((item) => (item.id === activeId ? updater(item) : item))
      )
    },
    [activeId]
  )

  // --- the history ---------------------------------------------------------

  /** The document as it is right now. */
  const takeSnapshot = React.useCallback((): Snapshot => {
    const document = documentRef.current
    return {
      items: itemsRef.current.map((item) => ({
        id: item.id,
        label: item.label,
        sourceFile: item.sourceFile,
        sourceUrl: item.sourceUrl,
        thumbUrl: item.thumbUrl,
        sourceWidth: item.sourceWidth,
        sourceHeight: item.sourceHeight,
        baseFile: item.baseFile,
        ops: item.ops,
        points: item.points,
        autoFilled: item.autoFilled,
        preview: item.preview
          ? {
              blob: item.preview.blob,
              width: item.preview.width,
              height: item.preview.height,
            }
          : undefined,
        revision: item.revision,
        edited: item.edited,
      })),
      activeId: document.activeId,
      text: document.text,
      textName: document.textName,
      documentName: document.documentName,
      mode: document.mode,
    }
  }, [])

  /**
   * Remember the document as it is, so it can be brought back.
   *
   * Called *before* a change is made — the snapshot is the state the undo
   * returns to.
   */
  const recordHistory = React.useCallback(
    (kind: "document" | "text" = "document") => {
      const now = Date.now()
      const history = historyRef.current
      const top = history.past[history.past.length - 1]
      // A burst of typing is one step, not one step per letter.
      if (
        kind === "text" &&
        top &&
        top.kind === "text" &&
        now - top.at < COALESCE_MS
      ) {
        top.at = now
        return
      }
      history.past.push({ snapshot: takeSnapshot(), kind, at: now })
      if (history.past.length > MAX_HISTORY) history.past.shift()
      history.future = []
      setHistoryState({ canUndo: true, canRedo: false })
    },
    [takeSnapshot]
  )

  /** Put a remembered document back on the screen. */
  const restoreSnapshot = React.useCallback((snapshot: Snapshot) => {
    const urls: string[] = []
    const restored: NoticeItem[] = snapshot.items.map((item) => {
      const preview = item.preview
        ? (() => {
            const url = URL.createObjectURL(item.preview?.blob as Blob)
            urls.push(url)
            return {
              url,
              blob: item.preview?.blob as Blob,
              width: item.preview?.width as number,
              height: item.preview?.height as number,
            }
          })()
        : undefined
      return {
        id: item.id,
        label: item.label,
        sourceFile: item.sourceFile,
        sourceUrl: item.sourceUrl,
        thumbUrl: item.thumbUrl,
        sourceWidth: item.sourceWidth,
        sourceHeight: item.sourceHeight,
        baseFile: item.baseFile,
        ops: item.ops,
        points: item.points,
        autoFilled: item.autoFilled,
        preview,
        previewRevision: preview ? item.revision : undefined,
        revision: item.revision,
        edited: item.edited,
      }
    })

    for (const url of restoredUrlsRef.current) URL.revokeObjectURL(url)
    restoredUrlsRef.current = urls

    // The pages that are being replaced keep a URL of their own; the ones
    // that come back have a fresh one.
    for (const item of itemsRef.current) {
      if (item.preview) URL.revokeObjectURL(item.preview.url)
    }

    setItems(restored)
    setActiveId(
      snapshot.activeId &&
        restored.some((item) => item.id === snapshot.activeId)
        ? snapshot.activeId
        : (restored[0]?.id ?? null)
    )
    setTextRaw(snapshot.text)
    setTextName(snapshot.textName)
    setDocumentName(snapshot.documentName)
    setMode(snapshot.mode)
    // The half-drawn crop and the half-drawn mask belong to the state that
    // is being left behind.
    setCropDraft(null)
    setMaskShapes([])
    // A result that was read from the old state no longer describes the
    // document.
    setResults([])
    setActiveResultId(null)
  }, [])

  const undo = React.useCallback(() => {
    const history = historyRef.current
    const entry = history.past.pop()
    if (!entry) return
    history.future.push({
      snapshot: takeSnapshot(),
      kind: entry.kind,
      at: Date.now(),
    })
    restoreSnapshot(entry.snapshot)
    setHistoryState({
      canUndo: history.past.length > 0,
      canRedo: true,
    })
  }, [restoreSnapshot, takeSnapshot])

  const redo = React.useCallback(() => {
    const history = historyRef.current
    const entry = history.future.pop()
    if (!entry) return
    history.past.push({
      snapshot: takeSnapshot(),
      kind: entry.kind,
      at: Date.now(),
    })
    restoreSnapshot(entry.snapshot)
    setHistoryState({
      canUndo: true,
      canRedo: history.future.length > 0,
    })
  }, [restoreSnapshot, takeSnapshot])

  /** Typing is a change too — a burst of it counts as one step. */
  const changeText = React.useCallback(
    (value: string) => {
      recordHistory("text")
      setTextRaw(value)
    },
    [recordHistory]
  )

  // --- the tool dock -------------------------------------------------------

  const toolRef = React.useRef<EditorTool>(tool)
  React.useEffect(() => {
    toolRef.current = tool
  }, [tool])
  // The tools the user came from, so "apply" can go back to where they were.
  const toolHistoryRef = React.useRef<EditorTool[]>([])

  const setTool = React.useCallback((next: EditorTool) => {
    if (toolRef.current !== next) {
      toolHistoryRef.current = [
        ...toolHistoryRef.current,
        toolRef.current,
      ].slice(-10)
    }
    toolRef.current = next
    setToolState(next)
  }, [])

  const goBackToPreviousTool = React.useCallback(() => {
    const previous = toolHistoryRef.current.pop()
    if (!previous) return
    toolRef.current = previous
    setToolState(previous)
  }, [])

  // --- the document --------------------------------------------------------

  const clearDocument = () => {
    // The pages are gone; the history keeps their blobs, not their URLs.
    for (const item of itemsRef.current) {
      if (item.preview) URL.revokeObjectURL(item.preview.url)
    }
    setItems([])
    setActiveId(null)
    setResults([])
    setActiveResultId(null)
    setTextRaw("")
    setTextName(null)
    setDocumentName(null)
    setMode("images")
    setTool("corners")
    setCropDraft(null)
    setMaskShapes([])
    setAlignError(null)
    setExtractError(null)
  }

  const makeItem = (
    file: File,
    sourceUrl: string,
    thumbUrl: string,
    width: number,
    height: number
  ): NoticeItem => ({
    id: nextItemId(),
    label: "",
    sourceFile: file,
    sourceUrl,
    thumbUrl,
    sourceWidth: width,
    sourceHeight: height,
    baseFile: file,
    ops: [],
    points: [],
    autoFilled: [],
    revision: 0,
    edited: false,
  })

  /**
   * Number the pages by their place in the document.
   *
   * The pages of a document are called "1", "2", "3" — whatever they were
   * called before. The file they came from is still on the page itself.
   */
  const withPageNumbers = (list: NoticeItem[]): NoticeItem[] =>
    list.map((item, index) => ({ ...item, label: String(index + 1) }))

  /**
   * Read a set of files into pages, telling the world how far along it is.
   *
   * Every photo is decoded and drawn, and a PDF is rendered by the backend
   * — a dozen files take a moment, and a screen that does nothing reads as
   * a hang.
   */
  const readFiles = async (
    files: File[],
    onPage: (item: NoticeItem) => void
  ) => {
    const photos = files.filter(isImage)
    const pdfs = files.filter(isPdf)
    const total = photos.length + pdfs.length
    let done = 0

    setUploadProgress({ done, total, label: "Reading your files" })

    try {
      for (const file of photos) {
        setUploadProgress({
          done,
          total,
          label: `Reading ${file.name}`,
        })
        const sourceUrl = URL.createObjectURL(file)
        const thumb = await makeThumbnail(file)
        onPage(makeItem(file, sourceUrl, thumb.url, thumb.width, thumb.height))
        done += 1
        setUploadProgress({ done, total, label: `Reading ${file.name}` })
      }

      for (const file of pdfs) {
        setUploadProgress({
          done,
          total,
          label: `Rendering ${file.name}`,
        })
        try {
          const rendered = await renderPdfPages(file)
          if (rendered.totalPages > rendered.pages.length) {
            toast.info(
              `Only the first ${rendered.pages.length} of ${rendered.totalPages} pages were opened`
            )
          }
          for (const page of rendered.pages) {
            const pageFile = new File(
              [page.blob],
              `${file.name.replace(/\.pdf$/i, "")}-page-${page.page}.png`,
              { type: "image/png" }
            )
            onPage(
              makeItem(
                pageFile,
                page.url,
                page.thumbUrl,
                page.width,
                page.height
              )
            )
          }
        } catch (err) {
          const message =
            err instanceof Error ? err.message : "Could not read the PDF"
          setAlignError(message)
          toast.error(message)
        }
        done += 1
        setUploadProgress({ done, total, label: `Rendering ${file.name}` })
      }
    } finally {
      setUploadProgress(null)
    }
  }

  /** Open a new document: photos, the pages of a PDF, or a text file. */
  const handleFiles = async (files: File[]) => {
    if (files.length === 0) return
    recordHistory()
    setAlignError(null)
    setExtractError(null)

    const photos = files.filter(isImage)
    const pdfs = files.filter(isPdf)
    const texts = files.filter(isText)

    // A text file is its own mode: the workbench becomes a plain editor.
    if (photos.length === 0 && pdfs.length === 0 && texts.length > 0) {
      const file = texts[0]
      const content = await file.text()
      clearDocument()
      setMode("text")
      setTextRaw(content)
      setTextName(file.name)
      setDocumentName(file.name)
      if (texts.length > 1) {
        toast.info("Only the first text file was opened")
      }
      return
    }

    const next: NoticeItem[] = []
    await readFiles(files, (item) => {
      next.push(item)
    })

    if (next.length === 0) {
      toast.error("That file type is not supported")
      return
    }

    clearDocument()
    setMode("images")
    setDocumentName(files[0].name)
    setItems(withPageNumbers(next))
    setActiveId(next[0].id)

    if (texts.length > 0) {
      toast.info("Text files were ignored — this document is made of pages")
    }
  }

  const handleFileSelect = (file: File) => {
    void handleFiles([file])
  }

  /** Add more pages to the document that is already open. */
  const appendFiles = async (files: File[]) => {
    if (files.length === 0) return
    recordHistory()
    const added: NoticeItem[] = []

    await readFiles(files, (item) => {
      added.push(item)
    })

    if (added.length === 0) {
      toast.error("That file type is not supported")
      return
    }

    setItems((previous) => withPageNumbers([...previous, ...added]))
    setActiveId(added[0].id)
    toast.success(
      added.length === 1
        ? "A page was added"
        : `${added.length} pages were added`
    )
  }

  /**
   * Draw a page's thumbnail again.
   *
   * A thumbnail is a blob URL, and a phone under memory pressure can drop
   * one. When that happens the tile shows a broken picture; this puts it
   * back.
   */
  const refreshThumbnail = async (id: string, file?: File) => {
    const item = itemsRef.current.find((entry) => entry.id === id)
    if (!item) return
    try {
      const thumb = await makeThumbnail(file ?? item.sourceFile)
      setItems((previous) =>
        previous.map((entry) =>
          entry.id === id ? { ...entry, thumbUrl: thumb.url } : entry
        )
      )
    } catch {
      // The thumbnail is a nicety; the page itself is what matters.
    }
  }

  /** Take a page out of the document. */
  const removeItem = (id: string) => {
    const target = itemsRef.current.find((item) => item.id === id)
    if (!target) return
    recordHistory()
    // The page's URLs are left alone: the history keeps the page, and an
    // undo has to be able to bring it back whole.
    if (target.preview) URL.revokeObjectURL(target.preview.url)
    setItems((previous) => {
      const next = withPageNumbers(previous.filter((item) => item.id !== id))
      if (id === activeId) {
        setActiveId(next[0]?.id ?? null)
      }
      return next
    })
    setResults((previous) => previous.filter((result) => result.id !== id))
  }

  /** Put a draft that was kept in the browser back into the editor. */
  const restoreDraft = async (draft: DraftDocument) => {
    recordHistory()
    const stored = await readDraftItems(draft)
    const restored: NoticeItem[] = []
    for (const item of stored) {
      const sourceUrl = URL.createObjectURL(item.sourceFile)
      const thumb = await makeThumbnail(item.sourceFile)
      restored.push({
        id: item.id,
        label: item.label,
        sourceFile: item.sourceFile,
        sourceUrl,
        thumbUrl: thumb.url,
        sourceWidth: item.sourceWidth,
        sourceHeight: item.sourceHeight,
        baseFile: item.sourceFile,
        ops: item.ops,
        points: item.points,
        autoFilled: item.autoFilled,
        revision: 0,
        edited: item.edited,
      })
    }

    clearDocument()
    setMode(draft.mode)
    setDocumentName(draft.documentName)
    setTextRaw(draft.text)
    setTextName(draft.textName)
    setItems(withPageNumbers(restored))
    setActiveId(restored[0]?.id ?? null)
  }

  /** Start over with a blank workbench — used after a notice is saved. */
  const resetAll = () => {
    recordHistory()
    clearDocument()
    setIsExtracting(false)
    setExtractStartedAt(null)
    setExtractProgress(null)
  }

  const selectItem = (id: string) => {
    if (id === activeId) return
    setActiveId(id)
    setTool("corners")
  }

  const selectNext = () => {
    if (items.length === 0) return
    const next = (activeIndex + 1) % items.length
    selectItem(items[next].id)
  }

  const selectPrevious = () => {
    if (items.length === 0) return
    const previous = (activeIndex - 1 + items.length) % items.length
    selectItem(items[previous].id)
  }

  // --- the corners ---------------------------------------------------------

  /** Run the backend detector against the image currently on the screen. */
  const detectCorners = async () => {
    if (!preview || !activeItem) return
    recordHistory()
    setIsDetecting(true)
    setAlignError(null)
    try {
      const formData = new FormData()
      formData.append(
        "file",
        new File([preview.blob], UPLOAD_NAME, {
          type: preview.blob.type || "image/jpeg",
        })
      )
      const response = await fetch("/api/pipeline/align", {
        method: "POST",
        body: formData,
      })
      if (!response.ok) {
        throw new Error(
          await readErrorDetail(response, "Could not detect the corners")
        )
      }

      // The backend may wrap the payload in a `{ success, data }` envelope.
      const payload = (await response.json()) as AlignResponse & {
        data?: AlignResponse
      }
      const data: AlignResponse = payload.data ?? payload
      if (!Array.isArray(data?.corners)) {
        throw new Error("Could not detect the corners")
      }

      // The backend returns percentages (0-100) — never divide again.
      const detected = data.corners.map((corner) =>
        corner ? clampCorner(corner) : null
      )

      // Pre-fill any corner the backend could not detect, at the inset image
      // corner, and flag it so the UI can mark it as needing review.
      const isAuto = detected.map((corner) => corner === null)
      const filled = detected.map((corner, index) =>
        corner
          ? corner
          : {
              x: index === 0 || index === 3 ? 5 : 95,
              y: index < 2 ? 5 : 95,
            }
      )

      pointsRef.current = filled
      updateActive((item) => ({
        ...item,
        points: filled,
        autoFilled: isAuto,
      }))
      toast.success(
        isAuto.some(Boolean)
          ? "Corners detected — check the highlighted ones"
          : "Corners detected"
      )
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Could not detect the corners"
      setAlignError(message)
      toast.error(message)
    } finally {
      setIsDetecting(false)
    }
  }

  /** Place the four corners on the corners of the image. */
  const addFourCorners = () => {
    recordHistory()
    const corners: Corner[] = [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 100, y: 100 },
      { x: 0, y: 100 },
    ]
    pointsRef.current = corners
    updateActive((item) => ({
      ...item,
      points: corners,
      autoFilled: [false, false, false, false],
    }))
  }

  /** Drop every corner. */
  const clearCorners = () => {
    recordHistory()
    pointsRef.current = []
    updateActive((item) => ({ ...item, points: [], autoFilled: [] }))
  }

  const handlePointChange = (newPoints: Corner[]) => {
    const clamped = newPoints.map(clampCorner)
    const previous = pointsRef.current
    pointsRef.current = clamped
    // A dragged corner is no longer "auto" — clear its flag, but only if the
    // value actually changed.
    const autoFilled = (current: boolean[]) =>
      current.map((flag, index) => {
        if (!flag) return flag
        const before = previous[index]
        const after = clamped[index]
        if (!after) return flag
        if (!before) return false
        return before.x === after.x && before.y === after.y ? flag : false
      })
    updateActive((item) => ({
      ...item,
      points: clamped,
      autoFilled: autoFilled(item.autoFilled),
    }))
  }

  /**
   * Wrap the page with the four corners.
   *
   * The corners pull the notice back into a rectangle, correcting the
   * perspective of the photograph, and the result becomes the page: the
   * pending changes are baked in and the corners become the whole
   * rectangle, so nothing about the picture has to be told to the model
   * later.
   */
  const applyWarp = async () => {
    if (!preview || !activeItem) return
    if (activeItem.points.length !== 4) return
    recordHistory()
    setIsProcessing(true)
    try {
      // The picture goes to the server with the four corners (as
      // percentages of it) and comes back wrapped. OpenCV resamples the
      // whole picture in one pass, so there are none of the seams a mesh
      // of triangles drawn in the browser leaves behind.
      const formData = new FormData()
      formData.append(
        "file",
        new File([preview.blob], UPLOAD_NAME, {
          type: preview.blob.type || "image/jpeg",
        })
      )
      formData.append(
        "corners",
        JSON.stringify(activeItem.points.map((point) => [point.x, point.y]))
      )

      const response = await fetch("/api/pipeline/warp", {
        method: "POST",
        body: formData,
      })
      if (!response.ok) {
        throw new Error(
          await readErrorDetail(response, "Could not wrap the page")
        )
      }
      const payload = (await response.json()) as {
        success: boolean
        data?: { image: string }
        detail?: string
      }
      const dataUrl = payload.data?.image
      if (!dataUrl) {
        throw new Error(payload.detail ?? "Could not wrap the page")
      }

      const blob = await (await fetch(dataUrl)).blob()
      const file = new File([blob], UPLOAD_NAME, { type: "image/jpeg" })

      // The page is a rectangle now, so its corners are the whole frame.
      const square: Corner[] = [
        { x: 0, y: 0 },
        { x: 100, y: 0 },
        { x: 100, y: 100 },
        { x: 0, y: 100 },
      ]
      pointsRef.current = square
      updateActive((item) => ({
        ...item,
        baseFile: file,
        ops: [],
        points: square,
        autoFilled: [false, false, false, false],
        revision: item.revision + 1,
        edited: true,
      }))
      setCropDraft(null)
      setMaskShapes([])
      await refreshThumbnail(activeItem.id, file)
      toast.success("The page is wrapped now")
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Could not wrap the page"
      setAlignError(message)
      toast.error(message)
    } finally {
      setIsProcessing(false)
    }
  }

  // --- the crop ------------------------------------------------------------

  const setCrop = (rect: Rect) => {
    setCropDraft(rect)
  }

  /** Commit the crop and go back to where the user came from. */
  const applyCrop = () => {
    if (!cropDraft || !preview || !activeItem) return
    recordHistory()
    const rect = normalizeRect(cropDraft)
    if (rect.width < 1 || rect.height < 1) return

    const cropsBefore = toCropFrames(activeItem.ops)
    const cropsAfter = [
      ...cropsBefore,
      {
        rect,
        frameWidth: preview.width,
        frameHeight: preview.height,
      },
    ]

    // The corners and the shapes being drawn move with the crop.
    setMaskShapes((current) => remapShapes(current, cropsBefore, cropsAfter))

    updateActive((item) => ({
      ...item,
      points: remapPoints(item.points, cropsBefore, cropsAfter).map(
        clampCorner
      ),
      ops: [
        ...item.ops,
        {
          id: nextOpId(),
          kind: "crop",
          rect,
          frameWidth: preview.width,
          frameHeight: preview.height,
        },
      ],
      revision: item.revision + 1,
      edited: true,
    }))
    setCropDraft(null)
    goBackToPreviousTool()
    toast.success("Crop applied")
  }

  const cancelCrop = () => {
    setCropDraft(null)
    goBackToPreviousTool()
  }

  // --- the hidden regions --------------------------------------------------

  const addMaskShape = (shape: MaskShape) => {
    setMaskShapes((current) => [...current, shape])
  }

  const updateMaskShapes = (shapes: MaskShape[]) => {
    setMaskShapes(shapes)
  }

  const removeMaskShape = (id: string) => {
    setMaskShapes((current) => current.filter((shape) => shape.id !== id))
  }

  const clearMaskShapes = () => {
    setMaskShapes([])
  }

  /** Burn the hidden regions into the image. */
  const applyMask = () => {
    if (maskShapes.length === 0 || !preview || !activeItem) return
    recordHistory()
    updateActive((item) => ({
      ...item,
      ops: [
        ...item.ops,
        {
          id: nextOpId(),
          kind: "mask",
          shapes: maskShapes,
          frameWidth: preview.width,
          frameHeight: preview.height,
        },
      ],
      revision: item.revision + 1,
      edited: true,
    }))
    setMaskShapes([])
    goBackToPreviousTool()
    toast.success("The region is hidden")
  }

  // --- the adjustments -----------------------------------------------------

  const addGrayscale = () => {
    recordHistory()
    updateActive((item) => ({
      ...item,
      ops: [...item.ops, { id: nextOpId(), kind: "grayscale" }],
      revision: item.revision + 1,
      edited: true,
    }))
  }

  const addSharpen = () => {
    recordHistory()
    updateActive((item) => ({
      ...item,
      ops: [...item.ops, { id: nextOpId(), kind: "sharpen" }],
      revision: item.revision + 1,
      edited: true,
    }))
  }

  /**
   * Remove a pending change.
   *
   * Removing a crop also removes everything that was drawn on the cropped
   * image, because those changes were positioned against the smaller frame.
   */
  const removeOp = (id: string) => {
    if (!activeItem) return
    const index = activeItem.ops.findIndex((op) => op.id === id)
    if (index === -1) return
    recordHistory()
    const target = activeItem.ops[index]
    const nextOps =
      target.kind === "crop"
        ? activeItem.ops.slice(0, index)
        : activeItem.ops.filter((op) => op.id !== id)
    const cropsBefore = toCropFrames(activeItem.ops)
    const cropsAfter = toCropFrames(nextOps)
    const nextPoints = remapPoints(
      activeItem.points,
      cropsBefore,
      cropsAfter
    ).map(clampCorner)
    pointsRef.current = nextPoints
    updateActive((item) => ({
      ...item,
      ops: nextOps,
      points: nextPoints,
      revision: item.revision + 1,
      edited: item.edited || nextOps.length > 0,
    }))
  }

  /** Throw away every pending change. */
  const discardOps = () => {
    if (!activeItem) return
    recordHistory()
    const cropsBefore = toCropFrames(activeItem.ops)
    const nextPoints = remapPoints(activeItem.points, cropsBefore, []).map(
      clampCorner
    )
    pointsRef.current = nextPoints
    updateActive((item) => ({
      ...item,
      ops: [],
      points: nextPoints,
      revision: item.revision + 1,
      edited: false,
    }))
    setCropDraft(null)
    setMaskShapes([])
  }

  /**
   * Bake the pending changes into the image. The confirmed image becomes the
   * new base, so the next change is applied on top of it.
   */
  const confirmEdits = () => {
    if (!preview || !activeItem) return
    const file = new File([preview.blob], UPLOAD_NAME, {
      type: preview.blob.type || "image/jpeg",
    })
    updateActive((item) => ({
      ...item,
      baseFile: file,
      ops: [],
      revision: item.revision + 1,
    }))
    setCropDraft(null)
    setMaskShapes([])
    toast.success("Changes applied to the image")
  }

  /** Go back to the photo exactly as it was uploaded. */
  const resetImage = () => {
    recordHistory()
    updateActive((item) => ({
      ...item,
      baseFile: item.sourceFile,
      ops: [],
      points: [],
      autoFilled: [],
      revision: item.revision + 1,
      edited: false,
    }))
    pointsRef.current = []
    setCropDraft(null)
    setMaskShapes([])
  }

  // --- the extraction ------------------------------------------------------

  const fingerprintOf = React.useCallback(
    (item: NoticeItem) =>
      [
        item.preview?.url ?? "",
        item.points
          .map((point) => `${point.x.toFixed(2)},${point.y.toFixed(2)}`)
          .join(" "),
        model,
      ].join("|"),
    [model]
  )

  const documentFingerprint = React.useMemo(
    () => [items.map(fingerprintOf).join("||"), model].join("|"),
    [items, fingerprintOf, model]
  )

  const textFingerprint = [text, model].join("|")

  /** The fingerprint a stored result should be compared against. */
  const currentFingerprint = (result: ItemResult | null): string => {
    if (!result) return ""
    if (result.id === "document") return documentFingerprint
    if (result.id === "text") return textFingerprint
    const item = items.find((entry) => entry.id === result.id)
    return item ? fingerprintOf(item) : ""
  }

  const isResultStale =
    activeResult !== null &&
    activeResult.fingerprint !== currentFingerprint(activeResult)

  /**
   * Read the whole document.
   *
   * Every page is put into one PDF and the model is given that single
   * file. The pages are already straightened — the user did that in the
   * editor — so there are no corners to send.
   */
  const readDocument = async (): Promise<ExtractResult> => {
    const pages = items.map((item) => {
      const blob = item.preview?.blob ?? item.sourceFile
      return {
        blob,
        width: item.preview?.width ?? item.sourceWidth,
        height: item.preview?.height ?? item.sourceHeight,
      }
    })
    const pdf = await buildDocumentPdf(pages)

    const formData = new FormData()
    formData.append(
      "file",
      new File([pdf], "notice.pdf", { type: "application/pdf" })
    )

    const response = await fetch("/api/pipeline/extract", {
      method: "POST",
      body: formData,
    })
    if (!response.ok) {
      throw new Error(
        await readErrorDetail(response, "Could not extract the text")
      )
    }
    return (await response.json()) as ExtractResult
  }

  const readText = async (): Promise<ExtractResult> => {
    const formData = new FormData()
    formData.append("text", text)

    const response = await fetch("/api/pipeline/extract", {
      method: "POST",
      body: formData,
    })
    if (!response.ok) {
      throw new Error(
        await readErrorDetail(response, "Could not extract the text")
      )
    }
    return (await response.json()) as ExtractResult
  }

  const extractText = async () => {
    setIsExtracting(true)
    setExtractError(null)
    setExtractStartedAt(Date.now())
    setExtractProgress(null)
    try {
      if (mode === "text") {
        const result = await readText()
        const entry: ItemResult = {
          id: "text",
          label: textName ?? "Text",
          result,
          fingerprint: textFingerprint,
        }
        setResults([entry])
        setActiveResultId(entry.id)
        return
      }

      if (items.length === 0) return

      // One document, one notice: every page is read as one document.
      setExtractProgress("Reading the document")
      const result = await readDocument()
      const entry: ItemResult = {
        id: "document",
        label: documentName ?? "Notice",
        result,
        fingerprint: documentFingerprint,
      }
      setResults([entry])
      setActiveResultId(entry.id)
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Could not extract the text"
      setExtractError(message)
      toast.error(message)
    } finally {
      setIsExtracting(false)
      setExtractStartedAt(null)
      setExtractProgress(null)
    }
  }

  return {
    mode,
    documentName,
    items,
    activeId,
    activeItem,
    activeIndex,
    preview,
    points,
    autoFilled,
    ops,
    tool,
    setTool,
    goBackToPreviousTool,
    cropDraft,
    setCrop,
    cropAspect,
    setCropAspect,
    applyCrop,
    cancelCrop,
    maskShapes,
    maskKind,
    setMaskKind,
    addMaskShape,
    updateMaskShapes,
    removeMaskShape,
    clearMaskShapes,
    applyMask,
    text,
    setText: changeText,
    textName,
    results,
    activeResult,
    activeResultId,
    setActiveResultId,
    isProcessing,
    isDetecting,
    isExtracting,
    extractStartedAt,
    extractProgress,
    alignError,
    extractError,
    isResultStale,
    models,
    model,
    setModel: setSelectedModel,
    handleFileSelect,
    handleFiles,
    appendFiles,
    removeItem,
    restoreDraft,
    resetAll,
    selectItem,
    selectNext,
    selectPrevious,
    handlePointChange,
    detectCorners,
    addFourCorners,
    clearCorners,
    addCrop: setCrop,
    addGrayscale,
    addSharpen,
    removeOp,
    discardOps,
    confirmEdits,
    resetImage,
    applyWarp,
    refreshThumbnail,
    extractText,
    canUndo: historyState.canUndo,
    canRedo: historyState.canRedo,
    undo,
    redo,
    /** Remember the document as it is, so a change can be taken back. */
    beginEdit: recordHistory,
  }
}

const NO_CORNERS: Corner[] = []

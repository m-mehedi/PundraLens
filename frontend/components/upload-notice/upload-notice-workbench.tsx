"use client"

import * as React from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import { Redo01Icon, Undo03Icon } from "@hugeicons/core-free-icons"
import { toast } from "sonner"

import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { Spinner } from "@/components/ui/spinner"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import type { Department } from "@/lib/notice-types"

import { CornerOverlay } from "./polygon-overlay"
import { DraftRestorePrompt } from "./draft-restore-prompt"
import { CropOverlay } from "./crop-overlay"
import { EditorContextBar } from "./editor-context-bar"
import { ExtractPanel } from "./extract-panel"
import { MaskOverlay } from "./mask-overlay"
import { NoticeCanvas, type NoticeCanvasHandle } from "./notice-canvas"
import { PagePanel } from "./page-panel"
import { TextEditor } from "./text-editor"
import { ToolDock } from "./tool-dock"
import { ToolOptions } from "./tool-options"
import { UploadDropzone } from "./upload-dropzone"
import { UploadProgressToast, useUploadProgress } from "./upload-progress"
import { useUploadNotice } from "./use-upload-notice"
import { deleteDraft, getDraftId, saveDraft, toDraft } from "@/lib/draft-store"

export interface UploadNoticeWorkbenchProps {
  /** Seeded by the backend; empty when it cannot be reached. */
  departments: Department[]
  /** Who the work belongs to — the draft in the browser is theirs. */
  userId: string
}

export function UploadNoticeWorkbench({
  departments,
  userId,
}: UploadNoticeWorkbenchProps) {
  const {
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
    cropDraft,
    setCrop,
    cropAspect,
    setCropAspect,
    applyCrop,
    cancelCrop,
    maskShapes,
    maskKind,
    setMaskKind,
    updateMaskShapes,
    removeMaskShape,
    clearMaskShapes,
    applyMask,
    text,
    setText,
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
    setModel,
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
    addGrayscale,
    addSharpen,
    removeOp,
    resetImage,
    applyWarp,
    refreshThumbnail,
    extractText,
    canUndo,
    canRedo,
    undo,
    redo,
    beginEdit,
  } = useUploadNotice()

  const [activeTab, setActiveTab] = React.useState("edit")
  const canvasRef = React.useRef<NoticeCanvasHandle | null>(null)
  const [zoomPercent, setZoomPercent] = React.useState(100)
  const [isComparing, setIsComparing] = React.useState(false)

  const detectedCount = points.filter((_, index) => !autoFilled[index]).length

  // Move between pages with the arrow keys, the way every photo browser
  // does it. Typing in a field is left alone.
  React.useEffect(() => {
    if (items.length < 2) return
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable)
      ) {
        return
      }
      if (event.key === "ArrowRight") {
        event.preventDefault()
        selectNext()
      } else if (event.key === "ArrowLeft") {
        event.preventDefault()
        selectPrevious()
      }
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [items.length, selectNext, selectPrevious])

  // Undo and redo work wherever the cursor is, as long as it is not in a
  // field: ⌘Z on a Mac, Ctrl+Z everywhere else.
  React.useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable)
      ) {
        return
      }
      if (!event.metaKey && !event.ctrlKey) return
      const key = event.key.toLowerCase()
      if (key === "z") {
        event.preventDefault()
        if (event.shiftKey) {
          redo()
        } else {
          undo()
        }
        return
      }
      if (key === "y") {
        event.preventDefault()
        redo()
      }
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [undo, redo])

  // While the files are being read, a toast in the corner says how far
  // along it is — the toast itself watches the progress, so it is published
  // once and not for every file.
  const uploadProgress = useUploadProgress()
  const isUploading = uploadProgress !== null
  React.useEffect(() => {
    if (!isUploading) return
    const id = toast.custom((toastId) => <UploadProgressToast id={toastId} />, {
      duration: Infinity,
      unstyled: true,
    })
    return () => {
      toast.dismiss(id)
    }
  }, [isUploading])

  const isTextMode = mode === "text"
  const hasPages = items.length > 0

  // The draft id identifies this piece of work in this browser.
  const [draftId] = React.useState(() => getDraftId())

  // Keep the unsaved work in the browser, so a refresh does not lose it.
  React.useEffect(() => {
    if (!userId) return
    if (items.length === 0 && !text) return
    const timer = setTimeout(() => {
      const { doc, files } = toDraft(userId, draftId, {
        mode,
        documentName,
        text,
        textName,
        items,
      })
      void saveDraft(doc, files).catch(() => {
        // A full disk or a private window — the work simply is not kept.
      })
    }, 1500)
    return () => clearTimeout(timer)
  }, [userId, draftId, mode, documentName, text, textName, items])

  return (
    <>
      <DraftRestorePrompt
        userId={userId}
        draftId={draftId}
        onLoad={(draft) => void restoreDraft(draft)}
      />
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList variant="line" className="grid w-full grid-cols-2">
          <TabsTrigger value="edit">Edit</TabsTrigger>
          <TabsTrigger value="extract">
            Extract
            {isResultStale ? (
              <span
                className="size-1.5 rounded-full bg-destructive"
                aria-label="The photo changed after the last extraction"
              />
            ) : null}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="edit" className="mt-6 flex flex-col gap-4">
          {isTextMode ? (
            <div className="flex flex-col gap-3">
              <TextEditor
                value={text}
                onChange={setText}
                fileName={textName}
                disabled={isExtracting}
              />
              <div>
                <button
                  type="button"
                  onClick={resetAll}
                  className="text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
                >
                  Open a photo or PDF instead
                </button>
              </div>
            </div>
          ) : !hasPages ? (
            <UploadDropzone onFiles={handleFiles} />
          ) : (
            <div className="flex flex-col gap-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <ToolDock tool={tool} onToolChange={setTool} />
                  <Separator orientation="vertical" className="h-6" />
                  <Tooltip>
                    <TooltipTrigger
                      render={
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={undo}
                          disabled={!canUndo}
                          aria-label="Undo"
                        >
                          <HugeiconsIcon icon={Undo03Icon} />
                        </Button>
                      }
                    />
                    <TooltipContent>
                      Undo · <kbd data-slot="kbd">⌘Z</kbd> or{" "}
                      <kbd data-slot="kbd">Ctrl Z</kbd>
                    </TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger
                      render={
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={redo}
                          disabled={!canRedo}
                          aria-label="Redo"
                        >
                          <HugeiconsIcon icon={Redo01Icon} />
                        </Button>
                      }
                    />
                    <TooltipContent>
                      Redo · <kbd data-slot="kbd">⇧⌘Z</kbd> or{" "}
                      <kbd data-slot="kbd">Ctrl Y</kbd>
                    </TooltipContent>
                  </Tooltip>
                </div>
                <EditorContextBar
                  position={activeIndex + 1}
                  total={items.length}
                  zoom={zoomPercent}
                  onZoomIn={() => canvasRef.current?.zoomIn()}
                  onZoomOut={() => canvasRef.current?.zoomOut()}
                  onFit={() => canvasRef.current?.fit()}
                  onCompareStart={() => setIsComparing(true)}
                  onCompareEnd={() => setIsComparing(false)}
                  canCompare={Boolean(activeItem?.sourceUrl)}
                  isComparing={isComparing}
                  onResetPage={resetImage}
                  canResetPage={ops.length > 0}
                />
              </div>

              <ToolOptions
                tool={tool}
                points={points}
                autoFilled={autoFilled}
                detectedCount={detectedCount}
                isDetecting={isDetecting}
                isProcessing={isProcessing}
                error={alignError}
                onDetectCorners={detectCorners}
                onAddFourCorners={addFourCorners}
                onClearCorners={clearCorners}
                onWrap={() => void applyWarp()}
                cropDraft={cropDraft}
                cropAspect={cropAspect}
                onCropAspectChange={setCropAspect}
                onApplyCrop={applyCrop}
                onCancelCrop={cancelCrop}
                maskShapes={maskShapes}
                maskKind={maskKind}
                onMaskKindChange={setMaskKind}
                onRemoveMaskShape={removeMaskShape}
                onClearMaskShapes={clearMaskShapes}
                onApplyMask={applyMask}
                onAddGrayscale={addGrayscale}
                onAddSharpen={addSharpen}
                ops={ops}
                onRemoveOp={removeOp}
              />

              <div className="flex h-[62vh] min-h-[440px] items-stretch gap-3">
                <Card className="min-w-0 flex-1">
                  <CardContent className="h-full p-0">
                    <div className="relative h-full">
                      {preview ? (
                        <NoticeCanvas
                          ref={canvasRef}
                          src={
                            isComparing
                              ? (activeItem?.sourceUrl ?? preview.url)
                              : preview.url
                          }
                          naturalWidth={
                            isComparing
                              ? (activeItem?.sourceWidth ?? preview.width)
                              : preview.width
                          }
                          naturalHeight={
                            isComparing
                              ? (activeItem?.sourceHeight ?? preview.height)
                              : preview.height
                          }
                          pageKey={activeItem?.id}
                          panning={tool === "move"}
                          onZoomChange={(zoom) =>
                            setZoomPercent(Math.round(zoom * 100))
                          }
                        >
                          {!isComparing ? (
                            <CornerOverlay
                              points={points}
                              onChange={handlePointChange}
                              onGestureStart={beginEdit}
                              frameWidth={preview?.width ?? 0}
                              frameHeight={preview?.height ?? 0}
                              interactive={tool === "corners"}
                            />
                          ) : null}

                          <CropOverlay
                            crop={cropDraft}
                            onCropChange={setCrop}
                            aspect={cropAspect}
                            frameWidth={preview?.width ?? 0}
                            frameHeight={preview?.height ?? 0}
                            active={tool === "crop"}
                          />

                          <MaskOverlay
                            shapes={maskShapes}
                            onChange={updateMaskShapes}
                            kind={maskKind}
                            frameWidth={preview?.width ?? 0}
                            frameHeight={preview?.height ?? 0}
                            active={tool === "hide"}
                          />
                        </NoticeCanvas>
                      ) : null}

                      {isProcessing ? (
                        <div className="absolute inset-0 flex items-center justify-center bg-background/60">
                          <div className="flex items-center gap-2 rounded-lg bg-card px-3 py-2 text-sm shadow-lg">
                            <Spinner />
                            Applying changes...
                          </div>
                        </div>
                      ) : null}
                    </div>
                  </CardContent>
                </Card>

                <PagePanel
                  items={items}
                  activeId={activeId}
                  onSelect={selectItem}
                  onPrevious={selectPrevious}
                  onNext={selectNext}
                  onRemove={removeItem}
                  onAdd={appendFiles}
                  onThumbnailError={(id) => void refreshThumbnail(id)}
                  extractedIds={results
                    .filter((result) => result.id !== "combined")
                    .map((result) => result.id)}
                />
              </div>
            </div>
          )}

          {alignError && !hasPages ? (
            <p className="text-sm text-destructive" role="alert">
              {alignError}
            </p>
          ) : null}
        </TabsContent>

        <TabsContent value="extract" className="mt-6">
          <ExtractPanel
            hasImage={hasPages || isTextMode}
            isTextMode={isTextMode}
            sourceName={activeItem?.sourceFile.name ?? textName}
            sourceUrl={preview?.url ?? null}
            sourceWidth={activeItem?.sourceWidth ?? preview?.width ?? 0}
            sourceHeight={activeItem?.sourceHeight ?? preview?.height ?? 0}
            cornerCount={points.length}
            pendingChanges={ops.length}
            pageCount={items.length}
            models={models}
            model={model}
            onModelChange={setModel}
            onExtract={extractText}
            isExtracting={isExtracting}
            extractStartedAt={extractStartedAt}
            extractProgress={extractProgress}
            error={extractError}
            results={results}
            activeResult={activeResult}
            activeResultId={activeResultId}
            onSelectResult={setActiveResultId}
            isResultStale={isResultStale}
            departments={departments}
            onGoToEdit={() => setActiveTab("edit")}
            onChoosePhoto={(file) => void handleFiles([file])}
            onResetAll={() => {
              resetAll()
              void deleteDraft(userId, draftId)
            }}
            onNoticeSaved={() => void deleteDraft(userId, draftId)}
          />
        </TabsContent>
      </Tabs>
    </>
  )
}

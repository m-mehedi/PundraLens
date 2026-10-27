"use client"

import * as React from "react"
import { AnimatePresence, motion } from "motion/react"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  ArrowRight01Icon,
  Redo01Icon,
  Undo03Icon,
} from "@hugeicons/core-free-icons"
import { toast } from "sonner"

import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { Spinner } from "@/components/ui/spinner"
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
import { ExtractStep } from "./extract-step"
import { MaskOverlay } from "./mask-overlay"
import { NoticeCanvas, type NoticeCanvasHandle } from "./notice-canvas"
import { PagePanel } from "./page-panel"
import { PipelineStepper } from "./pipeline-stepper"
import { ReviewPanel } from "./review-panel"
import { TextEditor } from "./text-editor"
import { ToolDock } from "./tool-dock"
import { ToolOptions } from "./tool-options"
import { UploadDropzone } from "./upload-dropzone"
import { UploadProgressToast, useUploadProgress } from "./upload-progress"
import { useUploadNotice } from "./use-upload-notice"
import { deleteDraft, getDraftId, saveDraft, toDraft } from "@/lib/draft-store"

const STEPS = [
  { id: 1, label: "Prepare" },
  { id: 2, label: "Extract" },
  { id: 3, label: "Review & Save" },
]

const SLIDE_VARIANTS = {
  enter: (direction: number) => ({
    x: direction > 0 ? 40 : -40,
    opacity: 0,
  }),
  center: { x: 0, opacity: 1 },
  exit: (direction: number) => ({
    x: direction > 0 ? -40 : 40,
    opacity: 0,
  }),
}

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
    alignError,
    extractError,
    isResultStale,
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

  const [activeStep, setActiveStep] = React.useState(1)
  const [direction, setDirection] = React.useState(1)
  const canvasRef = React.useRef<NoticeCanvasHandle | null>(null)
  const [zoomPercent, setZoomPercent] = React.useState(100)
  const [isComparing, setIsComparing] = React.useState(false)

  const detectedCount = points.filter((_, index) => !autoFilled[index]).length

  const isTextMode = mode === "text"
  const hasPages = items.length > 0
  const hasContent = hasPages || isTextMode
  const hasResults = results.length > 0

  // Auto-advance to Review when extraction finishes successfully.
  const prevIsExtractingRef = React.useRef(isExtracting)
  React.useEffect(() => {
    const wasExtracting = prevIsExtractingRef.current
    prevIsExtractingRef.current = isExtracting
    if (wasExtracting && !isExtracting && hasResults && !extractError) {
      setDirection(1)
      setActiveStep(3)
    }
  }, [isExtracting, hasResults, extractError])

  const goToStep = (step: number) => {
    if (step === activeStep) return
    setDirection(step > activeStep ? 1 : -1)
    setActiveStep(step)
  }

  const completedSteps = React.useMemo(() => {
    const completed: number[] = []
    if (hasContent) completed.push(1)
    if (hasResults) completed.push(2)
    return completed
  }, [hasContent, hasResults])

  const staleSteps = React.useMemo(() => {
    const stale: number[] = []
    if (isResultStale) {
      if (hasResults) stale.push(2)
      stale.push(3)
    }
    return stale
  }, [isResultStale, hasResults])

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

      <div className="flex flex-col gap-6">
        <PipelineStepper
          steps={STEPS}
          activeStep={activeStep}
          completedSteps={completedSteps}
          staleSteps={staleSteps}
          onStepClick={goToStep}
        />

        <AnimatePresence mode="wait" custom={direction} initial={false}>
          {activeStep === 1 && (
            <motion.div
              key="step-1"
              custom={direction}
              variants={SLIDE_VARIANTS}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.25, ease: "easeInOut" }}
              className="flex flex-col gap-4"
            >
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

              {hasContent && (
                <div className="sticky bottom-0 z-10 flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-card p-4 shadow-sm">
                  <p className="text-sm text-muted-foreground">
                    {isTextMode
                      ? "Text is ready to be extracted."
                      : `${items.length} page${items.length === 1 ? "" : "s"} ready.`}
                  </p>
                  <Button
                    onClick={() => goToStep(2)}
                    disabled={isExtracting}
                  >
                    Continue to Extract
                    <HugeiconsIcon
                      icon={ArrowRight01Icon}
                      data-icon="inline-end"
                    />
                  </Button>
                </div>
              )}
            </motion.div>
          )}

          {activeStep === 2 && (
            <motion.div
              key="step-2"
              custom={direction}
              variants={SLIDE_VARIANTS}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.25, ease: "easeInOut" }}
            >
              <ExtractStep
                hasImage={hasContent}
                isTextMode={isTextMode}
                sourceName={activeItem?.sourceFile.name ?? textName}
                pageCount={items.length}
                cornerCount={points.length}
                onExtract={extractText}
                isExtracting={isExtracting}
                extractStartedAt={extractStartedAt}
                error={extractError}
                results={results}
                activeResultId={activeResultId}
                onSelectResult={setActiveResultId}
                onGoToReview={() => goToStep(3)}
                onChoosePhoto={(file) => void handleFiles([file])}
              />
            </motion.div>
          )}

          {activeStep === 3 && (
            <motion.div
              key="step-3"
              custom={direction}
              variants={SLIDE_VARIANTS}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.25, ease: "easeInOut" }}
            >
              <ReviewPanel
                activeResult={activeResult}
                isResultStale={isResultStale}
                departments={departments}
                onGoBack={() => goToStep(2)}
                onExtractAgain={extractText}
                onResetAll={() => {
                  resetAll()
                  void deleteDraft(userId, draftId)
                }}
                onNoticeSaved={() => void deleteDraft(userId, draftId)}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </>
  )
}

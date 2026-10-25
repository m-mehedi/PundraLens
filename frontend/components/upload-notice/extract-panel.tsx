"use client"

import * as React from "react"
import { AnimatePresence, motion } from "motion/react"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  Alert02Icon,
  ArrowRight01Icon,
  File01Icon,
  ImageAddIcon,
  Tick02Icon,
} from "@hugeicons/core-free-icons"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import type { Department } from "@/lib/notice-types"

import { ExtractButton, ExtractionProgress } from "./extraction-progress"
import { NoticeForm } from "./notice-form"
import { NoticeSheet } from "./notice-sheet"
import { SaveNoticePanel } from "./save-notice-panel"
import type { ItemResult, ModelOption } from "./types"
import { useNoticeForm } from "./use-notice-form"

export interface ExtractPanelProps {
  hasImage: boolean
  /** True when the document is typed text rather than a photo. */
  isTextMode: boolean
  sourceName: string | null
  sourceUrl: string | null
  sourceWidth: number
  sourceHeight: number
  cornerCount: number
  pendingChanges: number
  /** How many pages the document has. */
  pageCount: number
  /** How many of them "each page" would read. */
  models: ModelOption[]
  model: string
  onModelChange: (model: string) => void
  onExtract: () => void
  isExtracting: boolean
  extractStartedAt: number | null
  /** Which page is being read, when several are read one after another. */
  extractProgress: string | null
  error: string | null
  /** One entry per notice that was read. */
  results: ItemResult[]
  activeResult: ItemResult | null
  activeResultId: string | null
  onSelectResult: (id: string) => void
  /** True when the photo moved on after the result was produced. */
  isResultStale: boolean
  departments: Department[]
  onGoToEdit: () => void
  onChoosePhoto: (file: File) => void
  onResetAll: () => void
  /** Called once the notice is safely on the board. */
  onNoticeSaved?: () => void
}

export function ExtractPanel({
  hasImage,
  isTextMode,
  sourceName,
  sourceUrl,
  sourceWidth,
  sourceHeight,
  cornerCount,
  pendingChanges,
  pageCount,
  models,
  model,
  onModelChange,
  onExtract,
  isExtracting,
  extractStartedAt,
  extractProgress,
  error,
  results,
  activeResult,
  activeResultId,
  onSelectResult,
  isResultStale,
  departments,
  onGoToEdit,
  onChoosePhoto,
  onResetAll,
  onNoticeSaved,
}: ExtractPanelProps) {
  const fileInputRef = React.useRef<HTMLInputElement | null>(null)
  const result = activeResult?.result ?? null
  const form = useNoticeForm(result, departments)

  // A page without corners is read as it is — the whole picture is the
  // extraction area. So the corners are a nicety, never a blocker.
  const canExtract = hasImage

  const previewImageSrc = null

  const pickFile = (file: File | undefined) => {
    if (!file) return
    onChoosePhoto(file)
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-0.5">
          <span className="text-sm font-medium">
            {!hasImage ? "Nothing loaded yet" : "Ready to extract"}
          </span>
          <span className="text-sm text-muted-foreground">
            {!hasImage
              ? isTextMode
                ? "Type the notice on the Edit tab to read it."
                : "Pick a photo, a PDF or a text file to read it."
              : pageCount > 1
                ? `${pageCount} pages, ready to read.`
                : cornerCount === 4
                  ? "The page is straightened and the four corners are in place."
                  : "The whole page will be read as it is."}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {!hasImage ? (
            <Button
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
            >
              <HugeiconsIcon icon={ImageAddIcon} data-icon="inline-start" />
              Choose a file
            </Button>
          ) : null}
          {hasImage && !isTextMode ? (
            <Button variant="outline" onClick={onGoToEdit}>
              Adjust the page
              <HugeiconsIcon icon={ArrowRight01Icon} data-icon="inline-end" />
            </Button>
          ) : null}
          <ExtractButton
            isExtracting={isExtracting}
            onExtract={onExtract}
            disabled={!canExtract}
            label={result ? "Extract again" : "Extract"}
          />
        </div>
      </div>

      {results.length > 1 ? (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-muted-foreground">
            {results.length} notices were read
          </span>
          {results.map((entry) => (
            <Button
              key={entry.id}
              size="xs"
              variant={entry.id === activeResultId ? "secondary" : "outline"}
              onClick={() => onSelectResult(entry.id)}
            >
              <HugeiconsIcon icon={Tick02Icon} data-icon="inline-start" />
              {entry.label}
            </Button>
          ))}
        </div>
      ) : null}

      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="image/*,application/pdf,text/plain"
        className="sr-only"
        onChange={(event) => {
          const file = event.target.files?.[0]
          pickFile(file)
          event.target.value = ""
        }}
      />

      <ExtractionProgress
        isExtracting={isExtracting}
        startedAt={extractStartedAt}
        message={extractProgress}
      />

      {error ? (
        <Alert variant="destructive">
          <HugeiconsIcon icon={Alert02Icon} />
          <AlertTitle>The notice could not be extracted</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      {!hasImage ? (
        <Empty className="border border-dashed">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <HugeiconsIcon icon={ImageAddIcon} />
            </EmptyMedia>
            <EmptyTitle>Nothing loaded yet</EmptyTitle>
            <EmptyDescription>
              Drop a photo, a PDF or a text file on the Edit tab — every page of
              a PDF can be straightened on its own.
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button variant="outline" onClick={onGoToEdit}>
              Open the editor
            </Button>
          </EmptyContent>
        </Empty>
      ) : null}

      {hasImage ? (
        <div className="grid gap-8 lg:grid-cols-[minmax(0,20rem)_minmax(0,1fr)]">
          <div className="min-w-0">
            <NoticeSheet
              sourceUrl={sourceUrl}
              sourceName={sourceName}
              sourceWidth={sourceWidth}
              sourceHeight={sourceHeight}
              previewImageSrc={previewImageSrc}
              cornerCount={cornerCount}
              pendingChanges={pendingChanges}
              models={models}
              model={model}
              onModelChange={onModelChange}
              rawText={null}
              deadline={form.values.deadline}
              onGoToEdit={onGoToEdit}
              onChoosePhoto={pickFile}
            />
          </div>

          <div className="flex min-w-0 flex-col gap-6">
            <AnimatePresence mode="wait" initial={false}>
              {result ? (
                <motion.div
                  key="result"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.24, ease: "easeOut" }}
                  className="flex flex-col gap-6"
                >
                  {isResultStale ? (
                    <Alert>
                      <HugeiconsIcon icon={Alert02Icon} />
                      <AlertTitle>
                        The photo changed after this extraction
                      </AlertTitle>
                      <AlertDescription className="flex flex-wrap items-center gap-3">
                        <span>
                          The fields below describe the previous photo. Extract
                          again to read the current one.
                        </span>
                        <Button
                          size="xs"
                          variant="outline"
                          onClick={onExtract}
                          disabled={!canExtract || isExtracting}
                        >
                          Extract again
                        </Button>
                      </AlertDescription>
                    </Alert>
                  ) : null}

                  <NoticeForm
                    values={form.values}
                    set={form.set}
                    missing={form.missing}
                    isDirty={form.isDirty}
                    onReset={form.reset}
                    departments={departments}
                  />
                </motion.div>
              ) : (
                <motion.div
                  key="idle"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.2 }}
                >
                  <Empty className="border border-dashed">
                    <EmptyHeader>
                      <EmptyMedia variant="icon">
                        <HugeiconsIcon icon={File01Icon} />
                      </EmptyMedia>
                      <EmptyTitle>Nothing read yet</EmptyTitle>
                      <EmptyDescription>
                        Extract the notice to pull out its title, dates, venue
                        and fees. You can correct every field before it goes on
                        the board.
                      </EmptyDescription>
                    </EmptyHeader>
                  </Empty>
                </motion.div>
              )}
            </AnimatePresence>

            {result ? (
              <SaveNoticePanel
                key={activeResultId ?? "result"}
                buildInput={() => form.toSaveInput()}
                missingCount={form.missing.length}
                isDirty={form.isDirty}
                onResetAll={onResetAll}
                onSaved={onNoticeSaved}
              />
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  )
}

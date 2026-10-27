"use client"

import * as React from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  Alert02Icon,
  ArrowRight01Icon,
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

import { ExtractButton } from "./extraction-progress"
import { ExtractionOverlay } from "./extraction-overlay"
import type { ItemResult } from "./types"

export interface ExtractStepProps {
  hasImage: boolean
  isTextMode: boolean
  sourceName: string | null
  pageCount: number
  cornerCount: number
  onExtract: () => void
  isExtracting: boolean
  extractStartedAt: number | null
  error: string | null
  results: ItemResult[]
  activeResultId: string | null
  onSelectResult: (id: string) => void
  onGoToReview: () => void
  onChoosePhoto: (file: File) => void
}

export function ExtractStep({
  hasImage,
  isTextMode,
  sourceName,
  pageCount,
  cornerCount,
  onExtract,
  isExtracting,
  extractStartedAt,
  error,
  results,
  activeResultId,
  onSelectResult,
  onGoToReview,
  onChoosePhoto,
}: ExtractStepProps) {
  const fileInputRef = React.useRef<HTMLInputElement | null>(null)
  const canExtract = hasImage
  const hasResults = results.length > 0

  const pickFile = (file: File | undefined) => {
    if (!file) return
    onChoosePhoto(file)
  }

  return (
    <div className="relative z-0 flex min-h-[50vh] flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-0.5">
          <span className="text-sm font-medium">
            {!hasImage ? "Nothing loaded yet" : "Ready to extract"}
          </span>
          <span className="text-sm text-muted-foreground">
            {!hasImage
              ? isTextMode
                ? "Type the notice on the Prepare step to read it."
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
          <ExtractButton
            isExtracting={isExtracting}
            onExtract={onExtract}
            disabled={!canExtract}
            label={hasResults ? "Extract again" : "Extract"}
          />
          {hasResults && !isExtracting ? (
            <Button onClick={onGoToReview}>
              Review results
              <HugeiconsIcon icon={ArrowRight01Icon} data-icon="inline-end" />
            </Button>
          ) : null}
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

      <ExtractionOverlay
        isExtracting={isExtracting}
        startedAt={extractStartedAt}
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
              Drop a photo, a PDF or a text file on the Prepare step — every
              page of a PDF can be straightened on its own.
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
            >
              Choose a file
            </Button>
          </EmptyContent>
        </Empty>
      ) : null}

      {hasImage && !hasResults && !isExtracting ? (
        <div className="rounded-xl border border-dashed p-8 text-center">
          <p className="text-sm text-muted-foreground">
            {sourceName
              ? `"${sourceName}" is ready. Click Extract to read it.`
              : "Your document is ready. Click Extract to read it."}
          </p>
        </div>
      ) : null}
    </div>
  )
}

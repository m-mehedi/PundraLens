"use client"

import * as React from "react"
import { AnimatePresence, motion } from "motion/react"
import { HugeiconsIcon } from "@hugeicons/react"
import { SparklesIcon } from "@hugeicons/core-free-icons"

import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"

import type { ExtractionStage } from "./types"

/**
 * The steps the backend goes through, in order. The pipeline runs OCR and
 * the model in a single call, so the step is read off the clock rather than
 * reported — the wording stays loose enough not to promise a precision the
 * backend does not have.
 */
const STAGES: Array<{ id: ExtractionStage; label: string; after: number }> = [
  { id: "preparing", label: "Straightening the page", after: 0 },
  { id: "reading", label: "Reading the text", after: 1200 },
  {
    id: "understanding",
    label: "Pulling out dates, venue and fees",
    after: 4000,
  },
]

function stageAt(elapsed: number): ExtractionStage {
  let current: ExtractionStage = STAGES[0].id
  for (const stage of STAGES) {
    if (elapsed >= stage.after) current = stage.id
  }
  return current
}

function labelFor(stage: ExtractionStage): string {
  return STAGES.find((item) => item.id === stage)?.label ?? ""
}

function useElapsed(isRunning: boolean, startedAt: number | null): number {
  const [elapsed, setElapsed] = React.useState(0)

  React.useEffect(() => {
    if (!isRunning || startedAt === null) return
    const timer = setInterval(() => {
      setElapsed(Date.now() - startedAt)
    }, 500)
    return () => clearInterval(timer)
  }, [isRunning, startedAt])

  return isRunning && startedAt !== null ? elapsed : 0
}

export interface ExtractionProgressProps {
  isExtracting: boolean
  /** When the request went out — drives the clock. */
  startedAt: number | null
  /** What is being read, when several pages are read one after another. */
  message?: string | null
}

/**
 * What the pipeline is doing right now.
 *
 * Reading a notice takes half a minute to a minute. A button that just
 * spins reads as a hang, so the step is spelled out and the clock keeps
 * ticking to show the work is alive.
 */
export function ExtractionProgress({
  isExtracting,
  startedAt,
  message,
}: ExtractionProgressProps) {
  const elapsed = useElapsed(isExtracting, startedAt)
  const stage = stageAt(elapsed)
  const seconds = Math.floor(elapsed / 1000)

  if (!isExtracting) return null

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between gap-3 text-sm">
        <AnimatePresence mode="wait" initial={false}>
          <motion.span
            key={message ?? stage}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.12 }}
            className="truncate text-foreground"
          >
            {message ?? labelFor(stage)}
          </motion.span>
        </AnimatePresence>
        <span className="shrink-0 text-muted-foreground tabular-nums">
          {Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, "0")}
        </span>
      </div>

      <div className="relative h-1 overflow-hidden rounded-full bg-muted">
        <motion.div
          className="absolute inset-y-0 left-0 w-1/3 rounded-full bg-primary"
          animate={{ x: ["-110%", "330%"] }}
          transition={{
            duration: 1.4,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />
      </div>
    </div>
  )
}

export interface ExtractButtonProps {
  isExtracting: boolean
  onExtract: () => void
  disabled: boolean
  /** The label when the button is idle. */
  label?: string
}

/** The primary action of the Extract tab. */
export function ExtractButton({
  isExtracting,
  onExtract,
  disabled,
  label = "Extract",
}: ExtractButtonProps) {
  return (
    <Button onClick={onExtract} disabled={disabled || isExtracting}>
      {isExtracting ? (
        <Spinner data-icon="inline-start" />
      ) : (
        <HugeiconsIcon icon={SparklesIcon} data-icon="inline-start" />
      )}
      {isExtracting ? "Extracting…" : label}
    </Button>
  )
}

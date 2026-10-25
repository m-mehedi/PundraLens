"use client"

import * as React from "react"
import { motion } from "motion/react"

import { Spinner } from "@/components/ui/spinner"

/** How far along the upload is. */
export interface UploadProgress {
  /** How many files are done. */
  done: number
  /** How many files there are. */
  total: number
  /** What is being read right now. */
  label: string
}

/*
 * The progress lives outside React, so the toast — which sonner renders in
 * its own tree — can follow it without the toast being published again for
 * every file.
 */
let current: UploadProgress | null = null
const listeners = new Set<() => void>()

export function setUploadProgress(next: UploadProgress | null): void {
  current = next
  for (const listener of listeners) listener()
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

function getSnapshot(): UploadProgress | null {
  return current
}

/** The upload as it is right now, if there is one. */
export function useUploadProgress(): UploadProgress | null {
  return React.useSyncExternalStore(subscribe, getSnapshot, () => null)
}

export interface UploadProgressToastProps {
  /** The toast's own id — sonner passes it so a toast can dismiss itself. */
  id?: string | number
}

/**
 * "Reading 3 of 9".
 *
 * Picking a dozen photos takes a moment — every one of them is decoded and
 * drawn — and a screen that does nothing reads as a hang. The bar says how
 * much is left, and the file being read says what is happening.
 */
export function UploadProgressToast({ id }: UploadProgressToastProps) {
  const progress = useUploadProgress()
  if (!progress) return null

  const percent =
    progress.total > 0
      ? Math.min(100, Math.round((progress.done / progress.total) * 100))
      : 0

  return (
    <div
      className="flex w-72 flex-col gap-2 rounded-xl border bg-card p-3 text-card-foreground shadow-lg"
      role="status"
      id={String(id)}
    >
      <div className="flex items-center gap-2 text-sm">
        <Spinner className="shrink-0" />
        <span className="truncate">{progress.label}</span>
        <span className="ml-auto shrink-0 text-xs text-muted-foreground tabular-nums">
          {progress.done} / {progress.total}
        </span>
      </div>

      <div
        className="h-1.5 overflow-hidden rounded-full bg-muted"
        role="progressbar"
        aria-valuenow={percent}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Upload progress"
      >
        <motion.div
          className="h-full rounded-full bg-primary"
          initial={false}
          animate={{ width: `${percent}%` }}
          transition={{ type: "spring", stiffness: 260, damping: 30 }}
        />
      </div>
    </div>
  )
}

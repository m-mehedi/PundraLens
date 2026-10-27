"use client"

import * as React from "react"
import { motion, AnimatePresence } from "motion/react"
import { HashLoader } from "react-spinners"

const FUNNY_MESSAGES = [
  "Straightening the page...",
  "Teaching the AI to read Bangla...",
  "Deciphering handwriting...",
  "Connecting the dots...",
  "Finding the deadlines...",
  "Counting the fees...",
  "Almost there...",
]

function useElapsed(isRunning: boolean, startedAt: number | null): number {
  const [elapsed, setElapsed] = React.useState(0)

  React.useEffect(() => {
    if (!isRunning || startedAt === null) return
    const timer = setInterval(() => {
      setElapsed(Date.now() - startedAt)
    }, 1000)
    return () => clearInterval(timer)
  }, [isRunning, startedAt])

  return isRunning && startedAt !== null ? elapsed : 0
}

export interface ExtractionOverlayProps {
  isExtracting: boolean
  startedAt: number | null
}

export function ExtractionOverlay({
  isExtracting,
  startedAt,
}: ExtractionOverlayProps) {
  const elapsed = useElapsed(isExtracting, startedAt)
  const seconds = Math.floor(elapsed / 1000)
  const [messageIndex, setMessageIndex] = React.useState(0)

  React.useEffect(() => {
    if (!isExtracting) return
    const timer = setInterval(() => {
      setMessageIndex((i) => (i + 1) % FUNNY_MESSAGES.length)
    }, 3000)
    return () => clearInterval(timer)
  }, [isExtracting])

  if (!isExtracting) return null

  return (
    <div className="absolute inset-0 z-50 flex flex-col items-center justify-center gap-8 bg-background/80 backdrop-blur-sm">
      <HashLoader
        size={72}
        color="currentColor"
        cssOverride={{ color: "hsl(var(--primary))" }}
        aria-label="Extracting notice"
      />

      <div className="flex flex-col items-center gap-2 text-center">
        <AnimatePresence mode="wait" initial={false}>
          <motion.p
            key={messageIndex}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.25, ease: "easeInOut" }}
            className="text-lg font-medium text-foreground"
          >
            {FUNNY_MESSAGES[messageIndex]}
          </motion.p>
        </AnimatePresence>

        <span className="text-sm text-muted-foreground tabular-nums">
          {Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, "0")}
        </span>
      </div>
    </div>
  )
}

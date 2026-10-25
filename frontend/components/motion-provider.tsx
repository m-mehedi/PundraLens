"use client"

import { MotionConfig } from "motion/react"

/**
 * Respects the OS "reduce motion" setting for every Motion animation in
 * the app: transforms and layout animations are dropped, opacity and colour
 * changes are kept.
 */
export function MotionProvider({ children }: { children: React.ReactNode }) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>
}

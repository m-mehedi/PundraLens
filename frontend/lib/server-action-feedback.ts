"use client"

import { toast } from "sonner"

/**
 * Next.js reports a redirect as a thrown error. Swallowing it would strand
 * the caller on the page instead of sending them to the login screen, so it
 * is re-thrown and only real failures become a toast.
 */
function isRedirectError(error: unknown): boolean {
  if (typeof error !== "object" || error === null) return false
  const digest = (error as { digest?: unknown }).digest
  return typeof digest === "string" && digest.startsWith("NEXT_REDIRECT")
}

export interface ActionFeedback {
  /** Shown when the action succeeds. */
  success: string
  /** Shown when the action fails. */
  error: string
}

/**
 * Runs a server action and reports the outcome. Returns false when the action
 * failed, so the caller can keep its dialog open.
 */
export async function runServerAction(
  action: (formData: FormData) => Promise<void> | void,
  formData: FormData,
  feedback: ActionFeedback
): Promise<boolean> {
  try {
    await action(formData)
    toast.success(feedback.success)
    return true
  } catch (error) {
    if (isRedirectError(error)) throw error
    toast.error(feedback.error)
    return false
  }
}

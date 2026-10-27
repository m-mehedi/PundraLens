"use client"

import * as React from "react"
import { AnimatePresence, motion } from "motion/react"
import { HugeiconsIcon } from "@hugeicons/react"
import { Alert02Icon, ArrowLeft01Icon } from "@hugeicons/core-free-icons"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import type { Department } from "@/lib/notice-types"

import { NoticeForm } from "./notice-form"
import { SaveNoticePanel } from "./save-notice-panel"
import type { ItemResult } from "./types"
import { useNoticeForm } from "./use-notice-form"

export interface ReviewPanelProps {
  activeResult: ItemResult | null
  isResultStale: boolean
  departments: Department[]
  onGoBack: () => void
  onExtractAgain: () => void
  onResetAll: () => void
  onNoticeSaved?: () => void
}

export function ReviewPanel({
  activeResult,
  isResultStale,
  departments,
  onGoBack,
  onExtractAgain,
  onResetAll,
  onNoticeSaved,
}: ReviewPanelProps) {
  const result = activeResult?.result ?? null
  const form = useNoticeForm(result, departments)

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={onGoBack}>
            <HugeiconsIcon icon={ArrowLeft01Icon} data-icon="inline-start" />
            Back to Extract
          </Button>
        </div>
        <span className="text-sm text-muted-foreground">
          {result
            ? "Correct the fields before saving."
            : "No extraction results yet."}
        </span>
      </div>

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
                <AlertTitle>The photo changed after this extraction</AlertTitle>
                <AlertDescription className="flex flex-wrap items-center gap-3">
                  <span>
                    The fields below describe the previous photo. Extract again
                    to read the current one.
                  </span>
                  <Button size="xs" variant="outline" onClick={onExtractAgain}>
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

            <Separator />

            <SaveNoticePanel
              buildInput={() => form.toSaveInput()}
              missingCount={form.missing.length}
              isDirty={form.isDirty}
              onResetAll={onResetAll}
              onSaved={onNoticeSaved}
            />
          </motion.div>
        ) : (
          <motion.div
            key="idle"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="flex flex-col items-center gap-4 rounded-xl border border-dashed p-12 text-center"
          >
            <p className="text-sm text-muted-foreground">
              No results to review yet. Run extraction first.
            </p>
            <Button variant="outline" onClick={onGoBack}>
              Go to Extract
            </Button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

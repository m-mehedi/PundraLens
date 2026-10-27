"use client"

import { useState } from "react"

import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"

export interface NoticeSummaryToggleProps {
  summaryBn: string | null
  summaryEn: string | null
}

/**
 * A notice often carries two readings of the same text. The Bengali is the
 * one written first, so it opens by default; when it is missing the toggle
 * starts on English instead of showing an empty pane.
 */
export function NoticeSummaryToggle({
  summaryBn,
  summaryEn,
}: NoticeSummaryToggleProps) {
  const hasBn = Boolean(summaryBn?.trim())
  const hasEn = Boolean(summaryEn?.trim())

  const [language, setLanguage] = useState<"bn" | "en">(hasBn ? "bn" : "en")

  if (!hasBn && !hasEn) {
    return <p className="text-muted-foreground">No summary available.</p>
  }

  const active = language === "bn" && hasBn ? "bn" : "en"
  const text = active === "bn" ? summaryBn : summaryEn

  return (
    <div className="flex flex-col gap-4">
      {hasBn && hasEn ? (
        <ToggleGroup
          variant="outline"
          size="sm"
          value={[language]}
          onValueChange={(value) => {
            const next = value[0]
            if (next === "bn" || next === "en") setLanguage(next)
          }}
          aria-label="Summary language"
        >
          <ToggleGroupItem value="bn">বাংলা</ToggleGroupItem>
          <ToggleGroupItem value="en">English</ToggleGroupItem>
        </ToggleGroup>
      ) : null}

      <p
        lang={active === "bn" ? "bn" : "en"}
        className="leading-relaxed whitespace-pre-wrap text-foreground/90"
      >
        {text}
      </p>
    </div>
  )
}

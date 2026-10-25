"use client"

import * as React from "react"

import type { SaveNoticeInput } from "@/lib/notice-actions"
import type { Department, NoticeCategory } from "@/lib/notice-types"

import { isBlank } from "./field-meta"
import type { ExtractResult, NoticeFieldKey, NoticeFormValues } from "./types"

/** The fields the extraction is expected to fill in. */
const CHECKED_FIELDS: NoticeFieldKey[] = [
  "title",
  "issuingOffice",
  "dateOfIssue",
  "deadline",
  "requiredAction",
  "audience",
  "noticeSummaryBn",
  "noticeSummaryEn",
]

/**
 * Match extracted department strings against the list the backend knows.
 *
 * The model writes comma-separated names ("Computer Science & Engineering,
 * Electrical & Electronic Engineering") while the board filters on codes
 * ("CSE,EEE").  Returns an array of matched codes, or the original tokens
 * when no match is found.  A bare "all" token becomes ["all"].
 */
function matchDepartments(value: string, departments: Department[]): string[] {
  const trimmed = value.trim()
  if (!trimmed) return []

  const tokens = trimmed
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean)
  if (tokens.length === 0) return []

  const normalise = (text: string) =>
    text.toLowerCase().replace(/&/g, "and").replace(/\s+/g, " ").trim()

  return tokens.map((token) => {
    if (token.toLowerCase() === "all") return "all"

    const byCode = departments.find(
      (d) => d.code.toLowerCase() === token.toLowerCase()
    )
    if (byCode) return byCode.code

    const needle = normalise(token)
    const byName = departments.find((d) => {
      const name = normalise(d.name)
      return name === needle || name.includes(needle) || needle.includes(name)
    })
    return byName ? byName.code : token
  })
}

/** The values straight out of the extraction, before any correction. */
export function valuesFromResult(
  result: ExtractResult | null,
  departments: Department[] = []
): NoticeFormValues {
  return {
    title: result?.title ?? "",
    issuingOffice: result?.issuing_office ?? "",
    dateOfIssue: result?.date_of_issue ?? "",
    category: result?.category ?? "general",
    deadline: result?.deadline ?? "",
    eventDateTime: result?.event_date_and_time ?? "",
    venue: result?.venue ?? "",
    departments: matchDepartments(result?.departments ?? "", departments),
    batches: result?.batches ?? [],
    requiredAction: result?.required_action ?? "",
    fees: result?.fees ?? "",
    contact: result?.contact ?? "",
    noticeNo: result?.notice_no ?? "",
    noticeSummaryBn: result?.notice_summary_bn ?? "",
    noticeSummaryEn: result?.notice_summary_en ?? "",
  }
}

function valueOf(
  values: NoticeFormValues,
  key: NoticeFieldKey
): string | string[] {
  switch (key) {
    case "audience":
      return [
        values.departments.join(", "),
        values.batches
          .map((b) => (b === -1 ? "All batches" : String(b)))
          .join(", "),
      ]
    default:
      return values[key] as string
  }
}

function isEmpty(values: NoticeFormValues, key: NoticeFieldKey): boolean {
  const value = valueOf(values, key)
  if (Array.isArray(value)) {
    return value.length === 0 || value.every((item) => item.trim().length === 0)
  }
  return isBlank(value)
}

export interface UseNoticeFormResult {
  values: NoticeFormValues
  /** Set one field. */
  set: <K extends keyof NoticeFormValues>(
    key: K,
    value: NoticeFormValues[K]
  ) => void
  /** The fields the model could not read and the user has not filled in. */
  missing: NoticeFieldKey[]
  /** True when the form no longer matches the extraction. */
  isDirty: boolean
  /** Throw away the corrections and go back to the extracted values. */
  reset: () => void
  /** The payload the save action expects. */
  toSaveInput: (raw?: {
    raw_text?: string
    file_name?: string | null
    source_type?: string
  }) => SaveNoticeInput
}

/**
 * Holds the editable copy of an extracted notice.
 *
 * The extraction is a first draft, not a verdict: every field stays in the
 * staff member's hands until they save it.
 */
export function useNoticeForm(
  result: ExtractResult | null,
  departments: Department[] = []
): UseNoticeFormResult {
  const baseline = React.useMemo(
    () => valuesFromResult(result, departments),
    [result, departments]
  )
  const [values, setValues] = React.useState<NoticeFormValues>(baseline)

  // A new extraction reseeds the form — the corrections made to the previous
  // one no longer describe the new photo.
  const seededFrom = React.useRef(result)
  React.useEffect(() => {
    if (seededFrom.current === result) return
    seededFrom.current = result
    setValues(valuesFromResult(result, departments))
  }, [result, departments])

  const set = React.useCallback(
    <K extends keyof NoticeFormValues>(key: K, value: NoticeFormValues[K]) => {
      setValues((current) => ({ ...current, [key]: value }))
    },
    []
  )

  const missing = React.useMemo(
    () =>
      CHECKED_FIELDS.filter(
        (key) => isEmpty(baseline, key) && isEmpty(values, key)
      ),
    [baseline, values]
  )

  const isDirty = React.useMemo(
    () => JSON.stringify(values) !== JSON.stringify(baseline),
    [values, baseline]
  )

  const reset = React.useCallback(() => {
    setValues(baseline)
  }, [baseline])

  const toSaveInput = React.useCallback(
    (raw?: {
      raw_text?: string
      file_name?: string | null
      source_type?: string
    }): SaveNoticeInput => {
      const departmentsStr =
        values.departments.length > 0 ? values.departments.join(",") : null
      const batches = values.batches.length > 0 ? values.batches : null

      return {
        title: values.title.trim() || null,
        issuing_office: values.issuingOffice.trim() || null,
        date_of_issue: values.dateOfIssue.trim() || null,
        deadline: values.deadline.trim() || null,
        event_date_and_time: values.eventDateTime.trim() || null,
        venue: values.venue.trim() || null,
        departments: departmentsStr,
        batches,
        required_action: values.requiredAction.trim() || null,
        fees: values.fees.trim() || null,
        contact: values.contact.trim() || null,
        notice_no: values.noticeNo.trim() || null,
        category: values.category as NoticeCategory,
        notice_summary_bn: values.noticeSummaryBn.trim(),
        notice_summary_en: values.noticeSummaryEn.trim(),
        raw_text: raw?.raw_text ?? null,
        file_name: raw?.file_name ?? null,
        source_type: raw?.source_type ?? "photo",
      }
    },
    [values]
  )

  return {
    values,
    set,
    missing,
    isDirty,
    reset,
    toSaveInput,
  }
}

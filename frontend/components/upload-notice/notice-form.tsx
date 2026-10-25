"use client"

import * as React from "react"
import { motion } from "motion/react"
import { HugeiconsIcon } from "@hugeicons/react"
import { BellIcon, UndoIcon } from "@hugeicons/core-free-icons"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"

import { ALL_CATEGORIES } from "../dashboard/category-badge"
import type { Department } from "@/lib/notice-types"
import type { NoticeFieldKey, NoticeFormValues } from "./types"
import { BatchCombobox, DepartmentCombobox } from "./audience-controls"

export interface NoticeFormProps {
  values: NoticeFormValues
  set: <K extends keyof NoticeFormValues>(
    key: K,
    value: NoticeFormValues[K]
  ) => void
  /** The fields the model could not read and nobody has filled in yet. */
  missing: NoticeFieldKey[]
  isDirty: boolean
  onReset: () => void
  /** Official department list for the multi-select control. */
  departments?: Department[]
}

function Section({
  title,
  index,
  children,
}: {
  title: string
  index: number
  children: React.ReactNode
}) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: 0.26,
        ease: "easeOut",
        delay: index * 0.03,
      }}
      className="flex flex-col gap-3"
    >
      <h3 className="text-sm font-medium text-muted-foreground">{title}</h3>
      {children}
    </motion.section>
  )
}

/** A label with a "not found" marker on the fields the model had to skip. */
function LabelRow({
  htmlFor,
  children,
  missing,
}: {
  htmlFor: string
  children: React.ReactNode
  missing?: boolean
}) {
  return (
    <div className="flex items-center gap-2">
      <FieldLabel htmlFor={htmlFor}>{children}</FieldLabel>
      {missing ? (
        <Badge variant="outline" className="text-muted-foreground">
          not found
        </Badge>
      ) : null}
    </div>
  )
}

export function NoticeForm({
  values,
  set,
  missing,
  isDirty,
  onReset,
  departments = [],
}: NoticeFormProps) {
  const missingSet = React.useMemo(() => new Set(missing), [missing])

  // The model may hand back a category the app does not know about — keep
  // it visible instead of silently showing an empty trigger.
  const categoryItems = React.useMemo(() => {
    const known: Array<{
      value: string
      label: string
      icon: typeof BellIcon
    }> = ALL_CATEGORIES.map((category) => ({
      value: category.value,
      label: category.label,
      icon: category.icon,
    }))
    if (
      values.category &&
      !known.some((item) => item.value === values.category)
    ) {
      known.push({
        value: values.category,
        label: values.category,
        icon: BellIcon,
      })
    }
    return known
  }, [values.category])

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          {missing.length > 0
            ? `${missing.length} ${missing.length === 1 ? "field needs" : "fields need"} a check before this notice goes on the board.`
            : "Every field the model was expected to fill in has a value."}
        </p>
        {isDirty ? (
          <Button size="xs" variant="ghost" onClick={onReset}>
            <HugeiconsIcon icon={UndoIcon} data-icon="inline-start" />
            Back to the extracted values
          </Button>
        ) : null}
      </div>

      <Section title={"Heading"} index={0}>
        <FieldGroup>
          <Field data-missing={missingSet.has("title") || undefined}>
            <LabelRow htmlFor="notice-title" missing={missingSet.has("title")}>
              Title
            </LabelRow>
            <Input
              id="notice-title"
              value={values.title}
              onChange={(event) => set("title", event.target.value)}
              placeholder="What is this notice about?"
              data-missing={missingSet.has("title") || undefined}
            />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field>
              <LabelRow htmlFor="notice-category">Category</LabelRow>
              <Select
                value={values.category}
                onValueChange={(value) => set("category", value ?? "general")}
                items={categoryItems}
              >
                <SelectTrigger id="notice-category" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {categoryItems.map((item) => (
                      <SelectItem key={item.value} value={item.value}>
                        <HugeiconsIcon
                          icon={item.icon}
                          className="mr-1 size-3"
                        />
                        {item.label}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </Field>

            <Field>
              <LabelRow
                htmlFor="notice-office"
                missing={missingSet.has("issuingOffice")}
              >
                Issuing office
              </LabelRow>
              <Input
                id="notice-office"
                value={values.issuingOffice}
                onChange={(event) => set("issuingOffice", event.target.value)}
                placeholder="Office of the Registrar"
                data-missing={missingSet.has("issuingOffice") || undefined}
              />
            </Field>
          </div>

          <Field data-missing={missingSet.has("dateOfIssue") || undefined}>
            <LabelRow
              htmlFor="notice-date"
              missing={missingSet.has("dateOfIssue")}
            >
              Date of issue
            </LabelRow>
            <Input
              id="notice-date"
              type="date"
              value={values.dateOfIssue}
              onChange={(event) => set("dateOfIssue", event.target.value)}
              data-missing={missingSet.has("dateOfIssue") || undefined}
            />
          </Field>
        </FieldGroup>
      </Section>

      <Section title={"When"} index={1}>
        <FieldGroup>
          <Field data-missing={missingSet.has("deadline") || undefined}>
            <LabelRow
              htmlFor="notice-deadline"
              missing={missingSet.has("deadline")}
            >
              Deadline
            </LabelRow>
            <Input
              id="notice-deadline"
              type="date"
              value={values.deadline}
              onChange={(event) => set("deadline", event.target.value)}
              data-missing={missingSet.has("deadline") || undefined}
            />
          </Field>

          <Field>
            <LabelRow htmlFor="notice-event">Event date &amp; time</LabelRow>
            <Input
              id="notice-event"
              type="datetime-local"
              value={values.eventDateTime}
              onChange={(event) => set("eventDateTime", event.target.value)}
            />
          </Field>
        </FieldGroup>
      </Section>

      <Section title={"Who and where"} index={2}>
        <FieldGroup>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field data-missing={missingSet.has("audience") || undefined}>
              <LabelRow
                htmlFor="notice-departments"
                missing={missingSet.has("audience")}
              >
                Departments
              </LabelRow>
              <DepartmentCombobox
                value={values.departments}
                onChange={(deps) => set("departments", deps)}
                departments={departments}
                missing={missingSet.has("audience")}
              />
            </Field>

            <Field>
              <LabelRow htmlFor="notice-batches">Batches</LabelRow>
              <BatchCombobox
                value={values.batches}
                onChange={(batch) => set("batches", batch)}
              />
            </Field>
          </div>

          <Field>
            <LabelRow htmlFor="notice-venue">Venue</LabelRow>
            <Input
              id="notice-venue"
              value={values.venue}
              onChange={(event) => set("venue", event.target.value)}
              placeholder="Where it happens"
            />
          </Field>
        </FieldGroup>
      </Section>

      <Section title={"What to do"} index={3}>
        <FieldGroup>
          <Field data-missing={missingSet.has("requiredAction") || undefined}>
            <LabelRow
              htmlFor="notice-action"
              missing={missingSet.has("requiredAction")}
            >
              Required action
            </LabelRow>
            <Textarea
              id="notice-action"
              value={values.requiredAction}
              onChange={(event) => set("requiredAction", event.target.value)}
              className="min-h-24"
              placeholder="What the student has to do"
              data-missing={missingSet.has("requiredAction") || undefined}
            />
          </Field>
        </FieldGroup>
      </Section>

      <Section title={"Money and contact"} index={4}>
        <FieldGroup>
          <Field>
            <LabelRow htmlFor="notice-fees">Fees</LabelRow>
            <Input
              id="notice-fees"
              value={values.fees}
              onChange={(event) => set("fees", event.target.value)}
              placeholder="Fee information or NONE"
            />
          </Field>

          <Field>
            <LabelRow htmlFor="notice-no">Notice number</LabelRow>
            <Input
              id="notice-no"
              value={values.noticeNo}
              onChange={(event) => set("noticeNo", event.target.value)}
              placeholder="Notice number or NONE"
            />
          </Field>

          <Field>
            <LabelRow htmlFor="notice-contact">Contact</LabelRow>
            <Input
              id="notice-contact"
              value={values.contact}
              onChange={(event) => set("contact", event.target.value)}
              placeholder="Office, phone or email to ask"
            />
          </Field>
        </FieldGroup>
      </Section>

      <Section title={"Summary"} index={5}>
        <FieldGroup>
          <Field data-missing={missingSet.has("noticeSummaryBn") || undefined}>
            <LabelRow
              htmlFor="notice-summary-bn"
              missing={missingSet.has("noticeSummaryBn")}
            >
              Summary in Bangla
            </LabelRow>
            <Textarea
              id="notice-summary-bn"
              value={values.noticeSummaryBn}
              onChange={(event) => set("noticeSummaryBn", event.target.value)}
              className="min-h-28 text-base leading-relaxed"
              lang="bn"
              placeholder="একটি সংক্ষিপ্ত বিবরণ"
              data-missing={missingSet.has("noticeSummaryBn") || undefined}
            />
            <FieldDescription>
              This is the summary the students read first.
            </FieldDescription>
          </Field>

          <Field data-missing={missingSet.has("noticeSummaryEn") || undefined}>
            <LabelRow
              htmlFor="notice-summary-en"
              missing={missingSet.has("noticeSummaryEn")}
            >
              Summary in English
            </LabelRow>
            <Textarea
              id="notice-summary-en"
              value={values.noticeSummaryEn}
              onChange={(event) => set("noticeSummaryEn", event.target.value)}
              className="min-h-28"
              placeholder="A short summary in English"
              data-missing={missingSet.has("noticeSummaryEn") || undefined}
            />
          </Field>
        </FieldGroup>
      </Section>
    </div>
  )
}

"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
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
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { updateNoticeAction } from "@/lib/notice-actions"
import type { NoticeCategory, NoticeRecord } from "@/lib/notice-types"

const CATEGORIES: NoticeCategory[] = [
  "exam",
  "registration",
  "fee",
  "holiday",
  "event",
  "scholarship",
  "result",
  "general",
]

export function NoticeEditForm({ notice }: { notice: NoticeRecord }) {
  const router = useRouter()
  const [isSaving, setIsSaving] = React.useState(false)

  const [title, setTitle] = React.useState(notice.title ?? "")
  const [issuingOffice, setIssuingOffice] = React.useState(
    notice.issuing_office ?? ""
  )
  const [dateOfIssue, setDateOfIssue] = React.useState(
    notice.date_of_issue ?? ""
  )
  const [category, setCategory] = React.useState<NoticeCategory>(
    notice.category ?? "general"
  )
  const [venue, setVenue] = React.useState(notice.venue ?? "")
  const [requiredAction, setRequiredAction] = React.useState(
    notice.required_action ?? ""
  )
  const [contact, setContact] = React.useState(notice.contact ?? "")
  const [department, setDepartment] = React.useState(
    notice.target_students?.department ?? ""
  )
  const [batch, setBatch] = React.useState(notice.target_students?.batch ?? "")
  const [semester, setSemester] = React.useState(
    notice.target_students?.semester ?? ""
  )
  const [feeAmount, setFeeAmount] = React.useState(
    notice.fees ? String(notice.fees.amount) : ""
  )
  const [feeCurrency, setFeeCurrency] = React.useState(
    notice.fees?.currency ?? "BDT"
  )
  const [summaryBengali, setSummaryBengali] = React.useState(
    notice.summary_bengali ?? ""
  )
  const [summaryEnglish, setSummaryEnglish] = React.useState(
    notice.summary_english ?? ""
  )
  const [deadlines, setDeadlines] = React.useState(
    (notice.deadlines ?? [])
      .map((d) => `${d.date} | ${d.description}`)
      .join("\n")
  )

  const handleSave = async () => {
    setIsSaving(true)
    const result = await updateNoticeAction({
      id: notice.id ?? 0,
      patch: {
        title: title.trim() || null,
        issuing_office: issuingOffice.trim() || null,
        date_of_issue: dateOfIssue.trim() || null,
        category,
        venue: venue.trim() || null,
        required_action: requiredAction.trim() || null,
        contact: contact.trim() || null,
        target_students: {
          department: department.trim() || null,
          batch: batch.trim() || null,
          semester: semester.trim() || null,
        },
        fees: feeAmount.trim()
          ? {
              amount: Number(feeAmount),
              currency: feeCurrency.trim() || "BDT",
            }
          : null,
        summary_bengali: summaryBengali.trim(),
        summary_english: summaryEnglish.trim(),
        deadlines: deadlines
          .split("\n")
          .map((line) => line.trim())
          .filter(Boolean)
          .map((line) => {
            const [date, ...rest] = line.split("|")
            return {
              date: date.trim(),
              description: rest.join("|").trim(),
            }
          }),
      },
    })
    setIsSaving(false)

    if (result.error) {
      toast.error(result.error)
      return
    }

    toast.success("Notice updated")
    router.replace("/dashboard/manage-notice")
    router.refresh()
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Notice fields</CardTitle>
        <CardDescription>
          Fix the extracted fields before the notice is published.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <FieldGroup className="gap-4">
          <Field>
            <FieldLabel htmlFor="edit-title">Title</FieldLabel>
            <Input
              id="edit-title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
            />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field>
              <FieldLabel htmlFor="edit-office">Issuing office</FieldLabel>
              <Input
                id="edit-office"
                value={issuingOffice}
                onChange={(event) => setIssuingOffice(event.target.value)}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="edit-date">Date of issue</FieldLabel>
              <Input
                id="edit-date"
                type="date"
                value={dateOfIssue}
                onChange={(event) => setDateOfIssue(event.target.value)}
              />
            </Field>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field>
              <FieldLabel htmlFor="edit-category">Category</FieldLabel>
              <Select
                value={category}
                onValueChange={(value) => setCategory(value as NoticeCategory)}
              >
                <SelectTrigger id="edit-category" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((item) => (
                    <SelectItem key={item} value={item}>
                      {item}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field>
              <FieldLabel htmlFor="edit-venue">Venue</FieldLabel>
              <Input
                id="edit-venue"
                value={venue}
                onChange={(event) => setVenue(event.target.value)}
              />
            </Field>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <Field>
              <FieldLabel htmlFor="edit-department">Department</FieldLabel>
              <Input
                id="edit-department"
                value={department}
                onChange={(event) => setDepartment(event.target.value)}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="edit-batch">Batch</FieldLabel>
              <Input
                id="edit-batch"
                value={batch}
                onChange={(event) => setBatch(event.target.value)}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="edit-semester">Semester</FieldLabel>
              <Input
                id="edit-semester"
                value={semester}
                onChange={(event) => setSemester(event.target.value)}
              />
            </Field>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field>
              <FieldLabel htmlFor="edit-fee-amount">Fee amount</FieldLabel>
              <Input
                id="edit-fee-amount"
                inputMode="decimal"
                value={feeAmount}
                onChange={(event) => setFeeAmount(event.target.value)}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="edit-fee-currency">Fee currency</FieldLabel>
              <Input
                id="edit-fee-currency"
                value={feeCurrency}
                onChange={(event) => setFeeCurrency(event.target.value)}
              />
            </Field>
          </div>

          <Field>
            <FieldLabel htmlFor="edit-action">Required action</FieldLabel>
            <Textarea
              id="edit-action"
              value={requiredAction}
              onChange={(event) => setRequiredAction(event.target.value)}
              className="min-h-20"
            />
          </Field>

          <Field>
            <FieldLabel htmlFor="edit-deadlines">Deadlines</FieldLabel>
            <Textarea
              id="edit-deadlines"
              value={deadlines}
              onChange={(event) => setDeadlines(event.target.value)}
              className="min-h-24 font-mono text-xs"
            />
            <FieldDescription>
              One per line, as <code>YYYY-MM-DD | description</code>.
            </FieldDescription>
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field>
              <FieldLabel htmlFor="edit-summary-bn">
                Summary (Bengali)
              </FieldLabel>
              <Textarea
                id="edit-summary-bn"
                value={summaryBengali}
                onChange={(event) => setSummaryBengali(event.target.value)}
                className="min-h-24"
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="edit-summary-en">
                Summary (English)
              </FieldLabel>
              <Textarea
                id="edit-summary-en"
                value={summaryEnglish}
                onChange={(event) => setSummaryEnglish(event.target.value)}
                className="min-h-24"
              />
            </Field>
          </div>

          <Field>
            <FieldLabel htmlFor="edit-contact">Contact</FieldLabel>
            <Input
              id="edit-contact"
              value={contact}
              onChange={(event) => setContact(event.target.value)}
            />
          </Field>

          <div className="flex flex-wrap items-center gap-3 border-t pt-4">
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving ? "Saving…" : "Save changes"}
            </Button>
            <Button
              variant="outline"
              nativeButton={false}
              render={<Link href="/dashboard/manage-notice" />}
            >
              Cancel
            </Button>
            <span className="text-sm text-muted-foreground">
              Notice #{notice.id} · v{notice.version}
            </span>
          </div>
        </FieldGroup>
      </CardContent>
    </Card>
  )
}

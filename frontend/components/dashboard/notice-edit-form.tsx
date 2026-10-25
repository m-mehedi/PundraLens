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
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { listDepartments } from "@/lib/notice-lookups"
import { updateNoticeAction } from "@/lib/notice-actions"
import type { NoticeCategory, NoticeRecord } from "@/lib/notice-types"

import { ALL_CATEGORIES } from "./category-badge"
import {
  BatchCombobox,
  DepartmentCombobox,
} from "@/components/upload-notice/audience-controls"

export function NoticeEditForm({ notice }: { notice: NoticeRecord }) {
  const router = useRouter()
  const [isSaving, setIsSaving] = React.useState(false)
  const departmentsList = React.useMemo(() => listDepartments(), [])

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
  const [deadline, setDeadline] = React.useState(notice.deadline ?? "")
  const [eventDateTime, setEventDateTime] = React.useState(
    notice.event_date_and_time ?? ""
  )
  const [contact, setContact] = React.useState(notice.contact ?? "")
  const [departments, setDepartments] = React.useState<string[]>(
    notice.departments
      ? notice.departments
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean)
      : []
  )
  const [batches, setBatches] = React.useState<number[]>(notice.batches ?? [])
  const [fees, setFees] = React.useState(notice.fees ?? "")
  const [noticeNo, setNoticeNo] = React.useState(notice.notice_no ?? "")
  const [noticeSummaryBn, setNoticeSummaryBn] = React.useState(
    notice.notice_summary_bn ?? ""
  )
  const [noticeSummaryEn, setNoticeSummaryEn] = React.useState(
    notice.notice_summary_en ?? ""
  )

  const handleSave = async () => {
    setIsSaving(true)
    const departmentsStr = departments.length > 0 ? departments.join(",") : null
    const batchesArr = batches.length > 0 ? batches : null
    const result = await updateNoticeAction({
      id: notice.id ?? 0,
      patch: {
        title: title.trim() || null,
        issuing_office: issuingOffice.trim() || null,
        date_of_issue: dateOfIssue.trim() || null,
        category,
        deadline: deadline.trim() || null,
        event_date_and_time: eventDateTime.trim() || null,
        venue: venue.trim() || null,
        departments: departmentsStr,
        batches: batchesArr,
        required_action: requiredAction.trim() || null,
        fees: fees.trim() || null,
        contact: contact.trim() || null,
        notice_no: noticeNo.trim() || null,
        notice_summary_bn: noticeSummaryBn.trim(),
        notice_summary_en: noticeSummaryEn.trim(),
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
                  {ALL_CATEGORIES.map((item) => (
                    <SelectItem key={item.value} value={item.value}>
                      {item.label}
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

          <div className="grid gap-4 sm:grid-cols-2">
            <Field>
              <FieldLabel htmlFor="edit-deadline">Deadline</FieldLabel>
              <Input
                id="edit-deadline"
                type="date"
                value={deadline}
                onChange={(event) => setDeadline(event.target.value)}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="edit-event">
                Event date &amp; time
              </FieldLabel>
              <Input
                id="edit-event"
                type="datetime-local"
                value={eventDateTime}
                onChange={(event) => setEventDateTime(event.target.value)}
              />
            </Field>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field>
              <FieldLabel htmlFor="edit-departments">Departments</FieldLabel>
              <DepartmentCombobox
                value={departments}
                onChange={setDepartments}
                departments={departmentsList}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="edit-batches">Batches</FieldLabel>
              <BatchCombobox value={batches} onChange={setBatches} />
            </Field>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field>
              <FieldLabel htmlFor="edit-fees">Fees</FieldLabel>
              <Input
                id="edit-fees"
                value={fees}
                onChange={(event) => setFees(event.target.value)}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="edit-notice-no">Notice number</FieldLabel>
              <Input
                id="edit-notice-no"
                value={noticeNo}
                onChange={(event) => setNoticeNo(event.target.value)}
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

          <div className="grid gap-4 sm:grid-cols-2">
            <Field>
              <FieldLabel htmlFor="edit-summary-bn">
                Summary (Bengali)
              </FieldLabel>
              <Textarea
                id="edit-summary-bn"
                value={noticeSummaryBn}
                onChange={(event) => setNoticeSummaryBn(event.target.value)}
                className="min-h-24 leading-relaxed"
                lang="bn"
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="edit-summary-en">
                Summary (English)
              </FieldLabel>
              <Textarea
                id="edit-summary-en"
                value={noticeSummaryEn}
                onChange={(event) => setNoticeSummaryEn(event.target.value)}
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

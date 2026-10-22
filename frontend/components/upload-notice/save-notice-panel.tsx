"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { saveNoticeAction } from "@/lib/notice-actions"
import type { NoticeCategory } from "@/lib/notice-types"
import type { ExtractResult } from "./types"

/**
 * Saves the extracted notice into the backend so staff can publish it.
 */
export function SaveNoticePanel({ data }: { data: ExtractResult["data"] }) {
  const router = useRouter()
  const [isSaving, setIsSaving] = React.useState<"draft" | "publish" | null>(
    null
  )
  const [savedId, setSavedId] = React.useState<number | null>(null)

  const [department, setDepartment] = React.useState(
    data.target_students?.department ?? ""
  )
  const [batch, setBatch] = React.useState(data.target_students?.batch ?? "")
  const [semester, setSemester] = React.useState(
    data.target_students?.semester ?? ""
  )

  const save = async (publish: boolean) => {
    setIsSaving(publish ? "publish" : "draft")
    const result = await saveNoticeAction({
      title: data.title,
      issuing_office: data.issuing_office,
      date_of_issue: data.date_of_issue,
      deadlines: data.deadlines,
      event_date_time: data.event_date_time,
      venue: data.venue,
      target_students: data.target_students,
      required_action: data.required_action,
      fees: data.fees,
      contact: data.contact,
      category: data.category as NoticeCategory,
      summary_bengali: data.summary_bengali,
      summary_english: data.summary_english,
      raw_text: data.raw_text,
      file_name: data.file_name,
      source_type: data.source_type,
      department,
      batch,
      semester,
      publish,
    })
    setIsSaving(null)

    if (result.error) {
      toast.error(result.error)
      return
    }

    setSavedId(result.id ?? null)
    toast.success(publish ? "Notice published" : "Notice saved as draft", {
      description: `Notice #${result.id}`,
    })
    router.refresh()
  }

  return (
    <div className="flex flex-col gap-4 border-t pt-4">
      <div>
        <h3 className="text-sm font-medium">Save to the notice board</h3>
        <p className="text-sm text-muted-foreground">
          Drafts stay hidden from students until a staff member publishes them.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="save-department">Department</Label>
          <Input
            id="save-department"
            placeholder="ALL"
            value={department}
            onChange={(event) => setDepartment(event.target.value)}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="save-batch">Batch</Label>
          <Input
            id="save-batch"
            placeholder="ALL"
            value={batch}
            onChange={(event) => setBatch(event.target.value)}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="save-semester">Semester</Label>
          <Input
            id="save-semester"
            placeholder="—"
            value={semester}
            onChange={(event) => setSemester(event.target.value)}
          />
        </div>
      </div>

      <Separator />

      <div className="flex flex-wrap items-center gap-3">
        <Button
          variant="outline"
          onClick={() => void save(false)}
          disabled={isSaving !== null || savedId !== null}
        >
          {isSaving === "draft" ? "Saving…" : "Save as draft"}
        </Button>
        <Button
          onClick={() => void save(true)}
          disabled={isSaving !== null || savedId !== null}
        >
          {isSaving === "publish" ? "Publishing…" : "Save & publish"}
        </Button>
        {savedId !== null ? (
          <span className="text-sm text-muted-foreground">
            Saved as notice #{savedId}.
          </span>
        ) : null}
      </div>
    </div>
  )
}

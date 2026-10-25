"use client"

import * as React from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import { ImageAddIcon } from "@hugeicons/core-free-icons"

import { Button } from "@/components/ui/button"
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"

export interface UploadDropzoneProps {
  onFiles: (files: File[]) => void
  disabled?: boolean
  /** Name of the document that is already loaded, if any. */
  loadedName?: string | null
}

const ACCEPTED = "image/*,application/pdf,text/plain"

export function UploadDropzone({
  onFiles,
  disabled,
  loadedName,
}: UploadDropzoneProps) {
  const inputRef = React.useRef<HTMLInputElement | null>(null)
  const [isDragging, setIsDragging] = React.useState(false)

  const pick = (files: FileList | null) => {
    if (!files || files.length === 0) return
    onFiles(Array.from(files))
  }

  return (
    <div
      onDragOver={(event) => {
        event.preventDefault()
        setIsDragging(true)
      }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={(event) => {
        event.preventDefault()
        setIsDragging(false)
        pick(event.dataTransfer.files)
      }}
      className={
        isDragging
          ? "rounded-2xl border-2 border-primary bg-primary/5"
          : "rounded-2xl"
      }
    >
      <Empty className="border-2 border-dashed border-border">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <HugeiconsIcon icon={ImageAddIcon} />
          </EmptyMedia>
          <EmptyTitle>
            {loadedName ? "Document loaded" : "No document loaded"}
          </EmptyTitle>
          <EmptyDescription>
            {loadedName
              ? "Drop another document to replace it, or open the editor to straighten the pages."
              : "Drop a photo, a scan, a PDF or a text file. Every page of a PDF becomes a photo you can straighten on its own."}
          </EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <input
            ref={inputRef}
            type="file"
            multiple
            accept={ACCEPTED}
            className="sr-only"
            onChange={(event) => {
              pick(event.target.files)
              event.target.value = ""
            }}
          />
          <Button
            variant="outline"
            disabled={disabled}
            onClick={() => inputRef.current?.click()}
          >
            Choose a file
          </Button>
        </EmptyContent>
      </Empty>
    </div>
  )
}

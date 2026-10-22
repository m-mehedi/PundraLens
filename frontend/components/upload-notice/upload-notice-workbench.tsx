"use client"

import * as React from "react"
import Image from "next/image"
import {
  Cropper,
  type CropperRef,
  type CropperState,
} from "react-advanced-cropper"
import { toast } from "sonner"
import { cn } from "@/lib/utils"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Separator } from "@/components/ui/separator"
import { ModelPicker } from "@/components/model-picker"
import { PolygonOverlay } from "./polygon-overlay"
import { SaveNoticePanel } from "./save-notice-panel"
import { useUploadNotice } from "./use-upload-notice"
import type { ExtractResult } from "./types"
import "react-advanced-cropper/dist/style.css"

const CORNER_LABELS = ["TL", "TR", "BR", "BL"] as const

function formatValue(
  key: keyof ExtractResult["data"],
  value: ExtractResult["data"][keyof ExtractResult["data"]]
): string {
  if (value === null || value === undefined) return "—"
  if (typeof value === "object") return JSON.stringify(value, null, 2)
  return String(value)
}

export function UploadNoticeWorkbench() {
  const {
    input,
    imageUrl,
    points,
    autoFilled,
    imageWidth,
    imageHeight,
    isDetecting,
    isExtracting,
    error,
    result,
    models,
    model,
    setModel,
    handleFileSelect,
    handlePointChange,
    extractText,
  } = useUploadNotice()

  const [activeTab, setActiveTab] = React.useState("photo")
  const cropperRef = React.useRef<CropperRef | null>(null)
  const [cropperState, setCropperState] = React.useState<CropperState | null>(
    null
  )
  const [stencilRect, setStencilRect] = React.useState<{
    left: number
    top: number
    width: number
    height: number
  } | null>(null)

  // Jump to the Corners tab as soon as a detection round completes.
  const wasDetecting = React.useRef(false)
  React.useEffect(() => {
    if (wasDetecting.current && !isDetecting && points.length === 4) {
      setActiveTab("corners")
    }
    wasDetecting.current = isDetecting
  }, [isDetecting, points.length])

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) handleFileSelect(file)
  }

  const handleReDetect = () => {
    if (input) handleFileSelect(input)
  }

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      toast.success("Copied to clipboard")
    } catch {
      toast.error("Failed to copy")
    }
  }

  const detectedCount = points.filter((_, index) => !autoFilled[index]).length

  const renderResultFields = (data: ExtractResult["data"]) => {
    const fields: Array<[keyof ExtractResult["data"], string]> = [
      ["title", "Title"],
      ["issuing_office", "Issuing Office"],
      ["date_of_issue", "Date of Issue"],
      ["deadlines", "Deadlines"],
      ["event_date_time", "Event Date/Time"],
      ["venue", "Venue"],
      ["target_students", "Target Students"],
      ["required_action", "Required Action"],
      ["fees", "Fees"],
      ["contact", "Contact"],
      ["category", "Category"],
      ["summary_bengali", "Bengali Summary"],
      ["summary_english", "English Summary"],
    ]

    return (
      <dl className="grid gap-4 md:grid-cols-2">
        {fields.map(([key, label]) => (
          <div key={key} className="flex flex-col gap-1">
            <dt className="text-sm font-medium text-muted-foreground">
              {label}
            </dt>
            <dd className="font-mono text-sm break-words whitespace-pre-wrap text-foreground/80">
              {formatValue(key, data[key])}
            </dd>
          </div>
        ))}
      </dl>
    )
  }

  return (
    <div className={cn("flex flex-col gap-6")}>
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList variant="line" className="grid w-full grid-cols-3">
          <TabsTrigger value="photo">Photo</TabsTrigger>
          <TabsTrigger value="corners">Corners</TabsTrigger>
          <TabsTrigger value="result">Result</TabsTrigger>
        </TabsList>

        <TabsContent value="photo" className="mt-6 flex flex-col gap-4">
          <div className="flex flex-col items-center gap-4 rounded-2xl border-2 border-dashed border-border p-8">
            <input
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              className="sr-only"
              id="file-upload"
              disabled={isDetecting}
            />
            <label
              htmlFor="file-upload"
              className="flex cursor-pointer flex-col items-center gap-2 text-center"
            >
              <p className="text-lg font-medium">
                {input ? "Image loaded" : "Drop an image or click to select"}
              </p>
              <p className="text-sm text-muted-foreground">
                {input ? "Drag and drop to replace" : "PNG, JPG up to 10MB"}
              </p>
            </label>
            {input && (
              <Button
                variant="outline"
                onClick={handleReDetect}
                disabled={isDetecting}
                className="mt-2"
              >
                {isDetecting ? "Detecting..." : "Re-detect"}
              </Button>
            )}
          </div>

          {imageUrl && (
            <div className="relative aspect-video max-h-96 overflow-hidden rounded-xl bg-muted">
              <Image
                src={imageUrl}
                alt="Uploaded notice"
                fill
                unoptimized
                className="object-contain"
              />
            </div>
          )}

          {error && (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          )}
        </TabsContent>

        <TabsContent value="corners" className="mt-6 flex flex-col gap-4">
          {imageUrl ? (
            <div className="flex flex-col gap-6 lg:flex-row">
              <Card className="min-w-0 flex-1">
                <CardContent className="p-0">
                  <div className="relative">
                    <Cropper
                      ref={cropperRef}
                      src={imageUrl}
                      className="cropper h-[70vh] min-h-[500px] w-full"
                      checkOrientation
                      stencilProps={{
                        // The crop rectangle is unused — only the four detected
                        // corners are sent to the backend. Hide its border,
                        // handles and the dimming mask so only the polygon
                        // overlay remains.
                        boundingBoxClassName: "hidden",
                        overlayClassName: "hidden",
                        movable: false,
                        resizable: false,
                      }}
                      onUpdate={(cropper) => {
                        setCropperState(cropper.getState())
                        setStencilRect(cropper.getStencilCoordinates())
                      }}
                    />
                    <PolygonOverlay
                      points={points}
                      onChange={handlePointChange}
                      imageWidth={imageWidth}
                      imageHeight={imageHeight}
                      state={cropperState}
                      stencilRect={stencilRect}
                    />
                  </div>
                </CardContent>
              </Card>

              <Card className="w-full shrink-0 lg:w-72">
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    Corners
                    <Badge variant="secondary">
                      {detectedCount} of 4 detected
                    </Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col gap-4">
                  {points.length === 0 ? (
                    <p className="py-8 text-center text-sm text-muted-foreground">
                      Click &quot;Re-detect&quot; on the Photo tab or adjust
                      manually
                    </p>
                  ) : (
                    <div className="flex flex-col gap-3">
                      {points.map((point, index) => (
                        <div
                          key={index}
                          className="flex items-center justify-between gap-2 text-sm"
                        >
                          <span className="w-10 font-medium">
                            {CORNER_LABELS[index]}
                          </span>
                          <span className="font-mono text-muted-foreground">
                            {point.x.toFixed(2)}, {point.y.toFixed(2)}
                          </span>
                          {autoFilled[index] ? (
                            <Badge variant="outline">added — check it</Badge>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  )}

                  <Separator />

                  <ModelPicker
                    models={models}
                    value={model}
                    onChange={setModel}
                    label="Extraction model"
                    id="model"
                  />

                  <Button
                    className="w-full"
                    onClick={extractText}
                    disabled={points.length !== 4 || isExtracting}
                  >
                    {isExtracting ? "Extracting..." : "Extract"}
                  </Button>
                </CardContent>
              </Card>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-16 text-center text-muted-foreground">
              <p>Upload a photo first</p>
            </div>
          )}

          {error && (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          )}
        </TabsContent>

        <TabsContent value="result" className="mt-6 flex flex-col gap-4">
          {result ? (
            <div className="flex flex-col gap-6">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between gap-2">
                  <CardTitle className="flex items-center gap-2">
                    Extracted Fields
                    {result.data.model ? (
                      <Badge
                        variant="secondary"
                        title={result.data.model.provider_model_id}
                      >
                        {result.data.model.label}
                      </Badge>
                    ) : null}
                  </CardTitle>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => copyToClipboard(result.data.raw_text)}
                  >
                    Copy Raw Text
                  </Button>
                </CardHeader>
                <CardContent className="flex flex-col gap-4">
                  {result.data.ocr_unavailable ? (
                    <p
                      className="rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive"
                      role="alert"
                    >
                      OCR is unavailable right now — the text could not be read,
                      so no fields were extracted.
                    </p>
                  ) : null}

                  {result.data.potential_duplicates.length > 0 ? (
                    <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
                      <p className="font-medium">
                        Possible duplicates — check before saving
                      </p>
                      <ul className="mt-2 flex flex-col gap-1 text-muted-foreground">
                        {result.data.potential_duplicates.map((duplicate) => (
                          <li
                            key={duplicate.id}
                            className="flex flex-wrap gap-2"
                          >
                            <span className="font-mono text-xs">
                              #{duplicate.id}
                            </span>
                            <span className="truncate">{duplicate.title}</span>
                            <span className="text-xs">
                              {Math.round(duplicate.similarity * 100)}% similar
                              · {duplicate.status}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}

                  <div className="max-h-96 overflow-auto rounded-xl border bg-muted/50 p-4">
                    <pre className="font-mono text-sm whitespace-pre-wrap">
                      {result.data.raw_text}
                    </pre>
                  </div>

                  {renderResultFields(result.data)}

                  <SaveNoticePanel data={result.data} />

                  {result.data.preview_image_base64 && (
                    <div className="border-t pt-4">
                      <h3 className="mb-2 text-sm font-medium text-muted-foreground">
                        Warped Preview
                      </h3>
                      <div className="relative aspect-[4/3] max-h-96 w-full overflow-hidden rounded-lg border">
                        <Image
                          src={`data:image/png;base64,${result.data.preview_image_base64}`}
                          alt="Warped preview"
                          fill
                          unoptimized
                          className="object-contain"
                        />
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-16 text-center text-muted-foreground">
              <p>Complete the corners step and click Extract</p>
            </div>
          )}

          {error && (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}

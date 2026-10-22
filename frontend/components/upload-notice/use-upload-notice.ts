"use client"

import * as React from "react"
import { toast } from "sonner"
import { useModels } from "@/hooks/use-models"
import { readErrorDetail } from "@/lib/backend-error"
import type { Corner, AlignResponse, ExtractResult } from "./types"

export function useUploadNotice() {
  const [input, setInput] = React.useState<File | null>(null)
  const [imageUrl, setImageUrl] = React.useState<string>("")
  const [points, setPoints] = React.useState<Corner[]>([])
  const [autoFilled, setAutoFilled] = React.useState<boolean[]>([])
  const [imageWidth, setImageWidth] = React.useState(0)
  const [imageHeight, setImageHeight] = React.useState(0)
  const [isDetecting, setIsDetecting] = React.useState(false)
  const [isExtracting, setIsExtracting] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [result, setResult] = React.useState<ExtractResult | null>(null)
  const [selectedModel, setSelectedModel] = React.useState("")

  // The catalogue is shared with every other screen that talks to the LLM.
  const { models, defaultKey } = useModels()
  const model = selectedModel || defaultKey

  // Mirrors `points` so `handlePointChange` can tell which corner actually
  // moved (and therefore drop its "auto filled" flag).
  const pointsRef = React.useRef<Corner[]>([])

  const handleFileSelect = (file: File) => {
    const url = URL.createObjectURL(file)
    setInput(file)
    setImageUrl(url)
    setError(null)
    setResult(null)
    setPoints([])
    setAutoFilled([])
    pointsRef.current = []
    detectCorners(file)
  }

  const detectCorners = async (file: File) => {
    setIsDetecting(true)
    setError(null)
    try {
      const formData = new FormData()
      formData.append("file", file)
      const response = await fetch("/api/pipeline/align", {
        method: "POST",
        body: formData,
      })
      if (!response.ok) {
        throw new Error(
          await readErrorDetail(response, "Failed to detect corners")
        )
      }

      // The backend may wrap the payload in a `{ success, data }` envelope.
      const payload = (await response.json()) as AlignResponse & {
        data?: AlignResponse
      }
      const data: AlignResponse = payload.data ?? payload
      if (!Array.isArray(data?.corners)) {
        throw new Error("Failed to detect corners")
      }

      // The backend ALREADY returns percentages (0-100). Do NOT divide by the
      // image dimensions again — that was a bug.
      const detected: Corner[] = data.corners.map((c) =>
        c ? { x: c.x, y: c.y } : { x: 0, y: 0 }
      )

      // Pre-fill any corner the backend could not detect, at the inset image
      // corner, and flag it so the UI can mark it as needing review.
      const isAuto = data.corners.map((c) => c === null)
      const filled: Corner[] = detected.map((c, i) =>
        isAuto[i] ? { x: i === 0 || i === 3 ? 5 : 95, y: i < 2 ? 5 : 95 } : c
      )

      setPoints(filled)
      pointsRef.current = filled
      setAutoFilled(isAuto)
      setImageWidth(data.image_width)
      setImageHeight(data.image_height)
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to detect corners"
      setError(message)
      toast.error(message)
    } finally {
      setIsDetecting(false)
    }
  }

  const extractText = async () => {
    if (!input) return
    setIsExtracting(true)
    setError(null)
    try {
      const formData = new FormData()
      formData.append("file", input)
      // The backend expects a list of [x, y] PAIRS — objects are rejected
      // with HTTP 400.
      formData.append("corners", JSON.stringify(points.map((p) => [p.x, p.y])))
      if (model) formData.append("model", model)
      const response = await fetch("/api/pipeline/extract", {
        method: "POST",
        body: formData,
      })
      if (!response.ok) {
        throw new Error(
          await readErrorDetail(response, "Failed to extract text")
        )
      }
      const data: ExtractResult = await response.json()
      setResult(data)
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to extract text"
      setError(message)
      toast.error(message)
    } finally {
      setIsExtracting(false)
    }
  }

  const handlePointChange = (newPoints: Corner[]) => {
    const previous = pointsRef.current
    setPoints(() => newPoints)
    pointsRef.current = newPoints
    // A dragged corner is no longer "auto" — clear its flag, but only if the
    // value actually changed.
    setAutoFilled((prev) =>
      prev.map((flag, i) => {
        if (!flag) return flag
        const before = previous[i]
        const after = newPoints[i]
        if (!after) return flag
        if (!before) return false
        return before.x === after.x && before.y === after.y ? flag : false
      })
    )
  }

  const reset = () => {
    if (imageUrl) URL.revokeObjectURL(imageUrl)
    setInput(null)
    setImageUrl("")
    setPoints([])
    setAutoFilled([])
    pointsRef.current = []
    setImageWidth(0)
    setImageHeight(0)
    setIsDetecting(false)
    setIsExtracting(false)
    setError(null)
    setResult(null)
  }

  return {
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
    setModel: setSelectedModel,
    handleFileSelect,
    handlePointChange,
    extractText,
    reset,
    setAutoFilled,
  }
}

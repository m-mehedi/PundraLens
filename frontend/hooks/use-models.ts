"use client"

import * as React from "react"
import type {
  ModelOption,
  ModelsResponse,
} from "@/components/upload-notice/types"

// The catalogue is shared by every screen that talks to the LLM, so it is
// fetched once per page load and shared between consumers.
let cataloguePromise: Promise<ModelsResponse | null> | null = null

function loadCatalogue(): Promise<ModelsResponse | null> {
  if (!cataloguePromise) {
    cataloguePromise = fetch("/api/pipeline/models")
      .then(async (response) => {
        if (!response.ok) return null
        return (await response.json()) as ModelsResponse
      })
      .catch(() => null)
  }
  return cataloguePromise
}

export interface UseModelsResult {
  models: ModelOption[]
  defaultKey: string
  isLoading: boolean
}

export function useModels(): UseModelsResult {
  const [payload, setPayload] = React.useState<ModelsResponse | null>(null)
  const [isLoading, setIsLoading] = React.useState(true)

  React.useEffect(() => {
    let cancelled = false
    void loadCatalogue().then((result) => {
      if (cancelled) return
      setPayload(result)
      setIsLoading(false)
    })
    return () => {
      cancelled = true
    }
  }, [])

  return {
    models: payload?.data?.models ?? [],
    defaultKey: payload?.data?.default ?? "",
    isLoading,
  }
}

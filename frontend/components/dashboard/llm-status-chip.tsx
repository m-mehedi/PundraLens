"use client"

import * as React from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import { Alert02Icon, AiBrain04Icon } from "@hugeicons/core-free-icons"

import { Badge } from "@/components/ui/badge"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"

interface HealthPayload {
  status?: string
  model?: string
  llm?: {
    provider: string
    model: string
    key: string
    label: string
    available: boolean
  }
}

/** Shows which LLM the backend is currently serving notices with. */
export function LLMStatusChip() {
  const [health, setHealth] = React.useState<HealthPayload | null>(null)
  const [isOffline, setIsOffline] = React.useState(false)

  React.useEffect(() => {
    let cancelled = false

    const load = async () => {
      try {
        const response = await fetch("/api/pipeline/health")
        if (!response.ok) {
          if (!cancelled) setIsOffline(true)
          return
        }
        const payload = (await response.json()) as HealthPayload
        if (!cancelled) {
          setHealth(payload)
          setIsOffline(false)
        }
      } catch {
        if (!cancelled) setIsOffline(true)
      }
    }

    void load()
    const timer = setInterval(load, 60_000)
    return () => {
      cancelled = true
      clearInterval(timer)
    }
  }, [])

  if (isOffline) {
    return (
      <Badge variant="destructive" className="gap-1">
        <HugeiconsIcon icon={Alert02Icon} strokeWidth={2} />
        Backend offline
      </Badge>
    )
  }

  const llm = health?.llm
  if (!llm) return null

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Badge
            variant={llm.available ? "secondary" : "outline"}
            className="gap-1"
          />
        }
      >
        <HugeiconsIcon icon={AiBrain04Icon} strokeWidth={2} />
        {llm.provider} · {llm.label}
      </TooltipTrigger>
      <TooltipContent>
        <p className="font-medium">{llm.label}</p>
        <p className="text-xs text-muted-foreground">
          {llm.model} · {llm.available ? "ready" : "no API key configured"}
        </p>
      </TooltipContent>
    </Tooltip>
  )
}

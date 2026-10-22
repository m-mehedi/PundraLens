/**
 * Server-only helpers for the notice API.
 *
 * These run on the Next.js server, so the API key never reaches the browser
 * and the browser never has to deal with CORS preflights.
 */

import type {
  Category,
  Department,
  NoticePatch,
  NoticeRecord,
  NoticeStatus,
} from "./notice-types"

const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:8000"
const API_KEY = process.env.API_KEY || ""

export class BackendError extends Error {
  status: number

  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}

interface RequestOptions {
  method?: "GET" | "POST" | "PUT" | "DELETE"
  body?: unknown
  query?: Record<string, string | number | undefined | null>
}

async function request<T>(
  path: string,
  options: RequestOptions = {}
): Promise<T> {
  const { method = "GET", body, query } = options

  const url = new URL(`${BACKEND_URL}${path}`)
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value === undefined || value === null || value === "") continue
      url.searchParams.set(key, String(value))
    }
  }

  const headers: HeadersInit = {}
  if (API_KEY) {
    headers["X-API-Key"] = API_KEY
  }
  if (body !== undefined) {
    headers["Content-Type"] = "application/json"
  }

  const response = await fetch(url, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  })

  const text = await response.text()
  let payload: unknown = null
  if (text) {
    try {
      payload = JSON.parse(text)
    } catch {
      payload = { detail: text.slice(0, 300) }
    }
  }

  if (!response.ok) {
    const detail = (payload as { detail?: unknown } | null)?.detail
    const message =
      typeof detail === "string"
        ? detail
        : `Backend request failed (${response.status})`
    throw new BackendError(message, response.status)
  }

  return payload as T
}

export interface NoticeFilters {
  status?: NoticeStatus | "all"
  category?: string
  department?: string
  batch?: string
  search_query?: string
  offset?: number
  limit?: number
}

export async function listNotices(
  filters: NoticeFilters = {}
): Promise<{ count: number; notices: NoticeRecord[] }> {
  const payload = await request<{
    success: boolean
    count: number
    notices: NoticeRecord[]
  }>("/api/notices", { query: { ...filters } })
  return { count: payload.count, notices: payload.notices ?? [] }
}

export async function getNotice(id: number): Promise<NoticeRecord | null> {
  try {
    const payload = await request<{ notice: NoticeRecord }>(
      `/api/notices/${id}`
    )
    return payload.notice ?? null
  } catch (error) {
    if (error instanceof BackendError && error.status === 404) return null
    throw error
  }
}

export async function createNotice(
  record: Partial<NoticeRecord>
): Promise<{ id: number; status: NoticeStatus }> {
  return request<{ id: number; status: NoticeStatus }>("/api/notices", {
    method: "POST",
    body: record,
  })
}

export async function publishNotice(
  id: number,
  publishedBy: string
): Promise<void> {
  await request(`/api/notices/${id}/publish`, {
    method: "PUT",
    query: { published_by: publishedBy },
  })
}

export async function updateNotice(
  id: number,
  patch: NoticePatch
): Promise<void> {
  await request(`/api/notices/${id}`, { method: "PUT", body: patch })
}

export async function deleteNotice(id: number): Promise<void> {
  await request(`/api/notices/${id}`, { method: "DELETE" })
}

export async function listDepartments(): Promise<Department[]> {
  const payload = await request<{ departments: Department[] }>(
    "/api/departments"
  )
  return payload.departments ?? []
}

export async function listCategories(): Promise<Category[]> {
  const payload = await request<{ categories: Category[] }>("/api/categories")
  return payload.categories ?? []
}

export interface BackendHealth {
  status: string
  service: string
  model: string
  llm?: {
    provider: string
    model: string
    key: string
    label: string
    available: boolean
  }
}

export async function getHealth(): Promise<BackendHealth | null> {
  try {
    return await request<BackendHealth>("/api/health")
  } catch {
    return null
  }
}

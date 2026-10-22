import { NextResponse } from "next/server"

const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:8000"
const API_KEY = process.env.API_KEY || ""

export async function callBackend(
  path: string,
  formData: FormData
): Promise<Response> {
  const url = `${BACKEND_URL}${path}`
  const headers: HeadersInit = {}
  if (API_KEY) {
    headers["X-API-Key"] = API_KEY
  }
  return fetch(url, { method: "POST", body: formData, headers })
}

export async function getBackend(path: string): Promise<Response> {
  const url = `${BACKEND_URL}${path}`
  const headers: HeadersInit = {}
  if (API_KEY) {
    headers["X-API-Key"] = API_KEY
  }
  // The model catalogue changes rarely — cache it for 5 minutes, matching the
  // backend's own cache of the provider model list.
  return fetch(url, { method: "GET", headers, next: { revalidate: 300 } })
}

export async function postJsonBackend(
  path: string,
  body: unknown
): Promise<Response> {
  const url = `${BACKEND_URL}${path}`
  const headers: HeadersInit = { "Content-Type": "application/json" }
  if (API_KEY) {
    headers["X-API-Key"] = API_KEY
  }
  return fetch(url, { method: "POST", body: JSON.stringify(body), headers })
}

/**
 * Forward a backend response as JSON.
 *
 * The backend always answers with JSON, but an unreachable backend or an
 * intermediary error page would break `res.json()` and hide the real reason
 * behind a generic parsing error — so fall back to a plain-text detail.
 */
export async function forwardBackend(res: Response): Promise<NextResponse> {
  const text = await res.text()
  let body: unknown
  try {
    body = text ? JSON.parse(text) : {}
  } catch {
    body = { detail: text.slice(0, 300) || `Backend error ${res.status}` }
  }
  return NextResponse.json(body, { status: res.status })
}

/** Error response used when the backend itself cannot be reached. */
export function backendUnreachable(error: unknown): NextResponse {
  const message = error instanceof Error ? error.message : String(error)
  return NextResponse.json(
    { detail: `Backend unreachable: ${message}` },
    { status: 502 }
  )
}

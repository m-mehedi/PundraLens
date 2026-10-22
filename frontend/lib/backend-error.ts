/**
 * Pull the backend's error message out of a failed response so the UI shows
 * the actual cause instead of a generic "request failed".
 */
export async function readErrorDetail(
  response: Response,
  fallback: string
): Promise<string> {
  try {
    const body = (await response.json()) as { detail?: unknown }
    const detail = body?.detail
    if (typeof detail === "string" && detail.trim()) return detail
    if (Array.isArray(detail) && detail.length > 0) {
      return detail
        .map((item) =>
          typeof item === "string"
            ? item
            : ((item as { msg?: string })?.msg ?? JSON.stringify(item))
        )
        .join("; ")
    }
  } catch {
    // Body was not JSON.
  }
  return fallback
}

import { apiSession } from "@/lib/api-auth"
import { forwardBackend, getBackend } from "@/lib/backend"

export async function GET() {
  const { error } = await apiSession("student")
  if (error) return error

  try {
    const res = await getBackend("/health")
    return forwardBackend(res)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return Response.json(
      { detail: `Backend unreachable: ${message}` },
      { status: 502 }
    )
  }
}

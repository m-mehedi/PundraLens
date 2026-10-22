import { forwardBackend, getBackend } from "@/lib/backend"

export async function GET() {
  try {
    const res = await getBackend("/api/health")
    return forwardBackend(res)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return Response.json(
      { detail: `Backend unreachable: ${message}` },
      { status: 502 }
    )
  }
}

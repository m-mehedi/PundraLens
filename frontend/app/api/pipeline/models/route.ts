import { backendUnreachable, forwardBackend, getBackend } from "@/lib/backend"

export async function GET() {
  try {
    const res = await getBackend("/api/models")
    return forwardBackend(res)
  } catch (error) {
    return backendUnreachable(error)
  }
}

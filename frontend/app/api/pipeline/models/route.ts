import { apiSession } from "@/lib/api-auth"
import { backendUnreachable, forwardBackend, getBackend } from "@/lib/backend"

export async function GET() {
  const { error } = await apiSession("student")
  if (error) return error

  try {
    const res = await getBackend("/api/models")
    return forwardBackend(res)
  } catch (error) {
    return backendUnreachable(error)
  }
}

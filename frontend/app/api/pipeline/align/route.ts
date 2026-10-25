import { apiSession } from "@/lib/api-auth"
import { backendUnreachable, callBackend, forwardBackend } from "@/lib/backend"

export async function POST(request: Request) {
  const { error } = await apiSession("staff")
  if (error) return error

  const formData = await request.formData()
  try {
    const res = await callBackend("/api/align", formData)
    return forwardBackend(res)
  } catch (error) {
    return backendUnreachable(error)
  }
}

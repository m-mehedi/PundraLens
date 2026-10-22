import { backendUnreachable, callBackend, forwardBackend } from "@/lib/backend"

export async function POST(request: Request) {
  const formData = await request.formData()
  try {
    const res = await callBackend("/api/extract", formData)
    return forwardBackend(res)
  } catch (error) {
    return backendUnreachable(error)
  }
}

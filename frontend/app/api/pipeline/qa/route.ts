import {
  backendUnreachable,
  forwardBackend,
  postJsonBackend,
} from "@/lib/backend"

export async function POST(request: Request) {
  const body = await request.json()
  try {
    const res = await postJsonBackend("/api/qa", body)
    return forwardBackend(res)
  } catch (error) {
    return backendUnreachable(error)
  }
}

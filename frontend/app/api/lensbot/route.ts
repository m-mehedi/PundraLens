import { NextResponse } from "next/server"
import { apiSession } from "@/lib/api-auth"
import { answerQuestion } from "@/lib/lensbot/answer"
import { retrieve } from "@/lib/lensbot/retrieve"

interface LensbotBody {
  query?: string
}

export async function POST(request: Request) {
  const { error } = await apiSession("student")
  if (error) return error

  let body: LensbotBody
  try {
    body = (await request.json()) as LensbotBody
  } catch {
    return NextResponse.json({ detail: "Invalid JSON body" }, { status: 400 })
  }

  const query = body.query?.trim()
  if (!query) {
    return NextResponse.json(
      { detail: "A question is required" },
      { status: 400 }
    )
  }

  try {
    const chunks = await retrieve(query)
    const result = await answerQuestion(query, chunks)
    return NextResponse.json(result)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json(
      { detail: `LensBot failed: ${message}` },
      { status: 502 }
    )
  }
}

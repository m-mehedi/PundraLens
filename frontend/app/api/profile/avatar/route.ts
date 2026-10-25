import { NextResponse } from "next/server"
import { headers } from "next/headers"
import { mkdir, writeFile, unlink } from "node:fs/promises"
import path from "node:path"

import { auth } from "@/lib/auth"
import { roleOf } from "@/lib/roles"

const MAX_BYTES = 2 * 1024 * 1024

const EXTENSIONS: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
}

const AVATAR_DIR = path.join(process.cwd(), "public", "uploads", "avatars")

export async function POST(request: Request) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 })
  }
  if (roleOf(session.user) === "revoked") {
    return NextResponse.json({ error: "Account revoked." }, { status: 403 })
  }

  let formData: FormData
  try {
    formData = await request.formData()
  } catch {
    return NextResponse.json(
      { error: "Expected a multipart form upload." },
      { status: 400 }
    )
  }

  const file = formData.get("file")
  if (!(file instanceof File)) {
    return NextResponse.json(
      { error: "No image was uploaded." },
      { status: 400 }
    )
  }

  const extension = EXTENSIONS[file.type]
  if (!extension) {
    return NextResponse.json(
      { error: "Use a PNG, JPEG or WebP image." },
      { status: 415 }
    )
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      { error: "The image must be 2 MB or smaller." },
      { status: 413 }
    )
  }

  const userId = session.user.id
  const fileName = `${userId}.${extension}`
  const absolutePath = path.join(AVATAR_DIR, fileName)

  try {
    await mkdir(AVATAR_DIR, { recursive: true })
    await writeFile(absolutePath, Buffer.from(await file.arrayBuffer()))
  } catch (error) {
    console.error("Avatar upload failed", error)
    return NextResponse.json(
      { error: "Could not store the image." },
      { status: 500 }
    )
  }

  // Remove any avatar left over from a previous upload with another extension.
  await Promise.all(
    Object.entries(EXTENSIONS)
      .filter(([, ext]) => ext !== extension)
      .map(([, ext]) =>
        unlink(path.join(AVATAR_DIR, `${userId}.${ext}`)).catch(() => undefined)
      )
  )

  const url = `/uploads/avatars/${fileName}?v=${Date.now()}`

  try {
    await auth.api.updateUser({
      headers: await headers(),
      body: { image: url },
    })
  } catch (error) {
    console.error("Could not persist avatar URL", error)
    return NextResponse.json(
      { error: "Could not save the avatar." },
      { status: 500 }
    )
  }

  return NextResponse.json({ url })
}

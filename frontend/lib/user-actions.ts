"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { headers } from "next/headers"
import { auth } from "@/lib/auth"
import { db } from "@/db"
import { user } from "@/auth-schema"
import { eq } from "drizzle-orm"

export async function revokeUser(formData: FormData) {
  const userId = formData.get("userId") as string

  const session = await auth.api.getSession({
    headers: await headers(),
  })

  if (!session) {
    redirect("/login")
  }

  const userRole = (session.user as { role?: string }).role
  if (userRole !== "admin") {
    redirect("/unauthorized")
  }

  const targetUser = await db
    .select({ role: user.role })
    .from(user)
    .where(eq(user.id, userId))
    .limit(1)
  const originalRole = targetUser[0]?.role ?? "student"

  await db.update(user).set({ originalRole }).where(eq(user.id, userId))

  await auth.api.setRole({
    headers: await headers(),
    body: { userId, role: "revoked" as any },
  })

  await auth.api.revokeUserSessions({
    headers: await headers(),
    body: { userId },
  })

  revalidatePath("/dashboard")
}

export async function restoreUser(formData: FormData) {
  const userId = formData.get("userId") as string

  const session = await auth.api.getSession({
    headers: await headers(),
  })

  if (!session) {
    redirect("/login")
  }

  const userRole = (session.user as { role?: string }).role
  if (userRole !== "admin") {
    redirect("/unauthorized")
  }

  const targetUser = await db
    .select({ originalRole: user.originalRole })
    .from(user)
    .where(eq(user.id, userId))
    .limit(1)
  const roleToRestore = targetUser[0]?.originalRole ?? "student"

  await auth.api.setRole({
    headers: await headers(),
    body: { userId, role: roleToRestore as any },
  })

  await db.update(user).set({ originalRole: null }).where(eq(user.id, userId))

  revalidatePath("/dashboard")
}

export async function bulkRevokeUsers(formData: FormData) {
  const userIds = formData.getAll("userIds") as string[]

  const session = await auth.api.getSession({
    headers: await headers(),
  })

  if (!session) {
    redirect("/login")
  }

  const userRole = (session.user as { role?: string }).role
  if (userRole !== "admin") {
    redirect("/unauthorized")
  }

  for (const userId of userIds) {
    const targetUser = await db
      .select({ role: user.role })
      .from(user)
      .where(eq(user.id, userId))
      .limit(1)
    const originalRole = targetUser[0]?.role ?? "student"

    await db.update(user).set({ originalRole }).where(eq(user.id, userId))

    await auth.api.setRole({
      headers: await headers(),
      body: { userId, role: "revoked" as any },
    })

    await auth.api.revokeUserSessions({
      headers: await headers(),
      body: { userId },
    })
  }

  revalidatePath("/dashboard")
}

export async function bulkRestoreUsers(formData: FormData) {
  const userIds = formData.getAll("userIds") as string[]

  const session = await auth.api.getSession({
    headers: await headers(),
  })

  if (!session) {
    redirect("/login")
  }

  const userRole = (session.user as { role?: string }).role
  if (userRole !== "admin") {
    redirect("/unauthorized")
  }

  for (const userId of userIds) {
    const targetUser = await db
      .select({ originalRole: user.originalRole })
      .from(user)
      .where(eq(user.id, userId))
      .limit(1)
    const roleToRestore = targetUser[0]?.originalRole ?? "student"

    await auth.api.setRole({
      headers: await headers(),
      body: { userId, role: roleToRestore as any },
    })

    await db.update(user).set({ originalRole: null }).where(eq(user.id, userId))
  }

  revalidatePath("/dashboard")
}

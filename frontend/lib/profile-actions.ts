"use server"

import { revalidatePath } from "next/cache"
import { headers } from "next/headers"
import { auth } from "@/lib/auth"
import { requireRole } from "@/lib/auth-guard"
import { roleOf } from "@/lib/roles"
import {
  PROFILE_FIELDS_BY_ROLE,
  type ProfileFieldKey,
} from "@/lib/profile-fields"
import type { ActionState } from "@/lib/action-state"

function readString(formData: FormData, key: string): string {
  const value = formData.get(key)
  return typeof value === "string" ? value.trim() : ""
}

/**
 * Updates the signed-in user's own profile. Only the fields that belong to
 * their role are written, so a student cannot rewrite staff-only columns.
 */
export async function updateProfile(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const { session } = await requireRole("student")

  const name = readString(formData, "name")
  if (!name) {
    return { error: "Full name is required.", success: null }
  }

  const role = roleOf(session.user)
  const allowed = new Set<ProfileFieldKey>(PROFILE_FIELDS_BY_ROLE[role])

  const body: Record<string, string> = { name }

  for (const field of [
    "phone",
    "department",
    "batch",
    "semester",
    "designation",
  ] as const) {
    if (!allowed.has(field)) continue
    body[field] = readString(formData, field)
  }

  try {
    await auth.api.updateUser({
      headers: await headers(),
      body,
    })
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Could not save your profile."
    return { error: message, success: null }
  }

  revalidatePath("/dashboard")
  revalidatePath("/dashboard/profile")

  return { error: null, success: "Profile updated." }
}

/** Changes the signed-in user's own password. */
export async function changePassword(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  await requireRole("student")

  const currentPassword = readString(formData, "currentPassword")
  const newPassword = readString(formData, "newPassword")
  const confirmPassword = readString(formData, "confirmPassword")

  if (!currentPassword || !newPassword) {
    return { error: "Fill in both password fields.", success: null }
  }
  if (newPassword.length < 8) {
    return {
      error: "New password must be at least 8 characters.",
      success: null,
    }
  }
  if (newPassword !== confirmPassword) {
    return { error: "The new passwords do not match.", success: null }
  }

  try {
    await auth.api.changePassword({
      headers: await headers(),
      body: {
        currentPassword,
        newPassword,
        revokeOtherSessions: true,
      },
    })
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Could not change your password."
    return { error: message, success: null }
  }

  return { error: null, success: "Password changed." }
}

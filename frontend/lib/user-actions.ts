"use server"

import { revalidatePath } from "next/cache"
import { headers } from "next/headers"
import { auth } from "@/lib/auth"
import { db } from "@/db"
import { user } from "@/auth-schema"
import { eq } from "drizzle-orm"
import { requireAdmin, requireRole } from "@/lib/auth-guard"
import { ASSIGNABLE_ROLES, asAuthRole, type Role } from "@/lib/roles"
import { isValidEmail, type ActionState } from "@/lib/action-state"

function readString(formData: FormData, key: string): string {
  const value = formData.get(key)
  return typeof value === "string" ? value.trim() : ""
}

/**
 * Loads the role of the account an action is aimed at.
 *
 * Staff may only act on students, but Better Auth's permission statements are
 * global (a "staff" role either has `set-role` or it does not), so the target
 * restriction has to be enforced here, per action.
 */
async function targetRoleOf(
  userId: string
): Promise<{ role: Role; originalRole: Role | null } | null> {
  const [target] = await db
    .select({ role: user.role, originalRole: user.originalRole })
    .from(user)
    .where(eq(user.id, userId))
    .limit(1)

  if (!target) return null

  return {
    role: asAuthRole(target.role ?? "") ?? "student",
    originalRole: asAuthRole(target.originalRole ?? ""),
  }
}

/**
 * True when `actor` may manage an account currently holding `target`.
 *
 * Staff handle the student roster, which includes undoing a revoke — a
 * `revoked` account is in reach because the only role staff can set is
 * `student`. They can never touch a `staff` or `admin` account.
 */
function canManage(
  actor: Role,
  target: { role: Role; originalRole: Role | null }
): boolean {
  if (actor === "admin") return true
  if (target.role === "student") return true
  return (
    target.role === "revoked" &&
    (target.originalRole === null || target.originalRole === "student")
  )
}

/**
 * Requires at least a staff session and confirms the caller may manage the
 * given account. Returns the actor's role, or `null` when the caller may not
 * touch that account (so the action can bow out silently).
 */
async function requireCanManage(
  userId: string
): Promise<{ actor: Role; target: Role } | null> {
  const { role: actor } = await requireRole("staff")

  const target = await targetRoleOf(userId)
  if (!target) return null

  if (!canManage(actor, target)) return null

  return { actor, target: target.role }
}

/** Stashes the role a user had before it was revoked, so it can be restored. */
async function stashRestorePoint(userId: string) {
  const [target] = await db
    .select({ role: user.role })
    .from(user)
    .where(eq(user.id, userId))
    .limit(1)

  if (!target) return null
  // Revoking an already-revoked account must not overwrite the restore
  // point with "revoked", otherwise restoring it restores the ban.
  if (target.role === "revoked") return null

  await db
    .update(user)
    .set({ originalRole: target.role })
    .where(eq(user.id, userId))
  return target.role
}

export async function revokeUser(formData: FormData) {
  const userId = readString(formData, "userId")
  if (!userId) return

  const permission = await requireCanManage(userId)
  if (!permission) return

  await stashRestorePoint(userId)

  await auth.api.setRole({
    headers: await headers(),
    body: { userId, role: "revoked" },
  })

  await auth.api.revokeUserSessions({
    headers: await headers(),
    body: { userId },
  })

  revalidatePath("/dashboard")
  revalidatePath("/dashboard/manage-students")
  revalidatePath("/dashboard/manage-staffs")
  revalidatePath("/dashboard/manage-revoked")
}

export async function restoreUser(formData: FormData) {
  await requireAdmin()

  const userId = readString(formData, "userId")
  if (!userId) return

  const [target] = await db
    .select({ originalRole: user.originalRole })
    .from(user)
    .where(eq(user.id, userId))
    .limit(1)

  const stored = target?.originalRole
  const roleToRestore = asAuthRole(stored ?? "") ?? "student"

  await auth.api.setRole({
    headers: await headers(),
    body: { userId, role: roleToRestore },
  })

  await db.update(user).set({ originalRole: null }).where(eq(user.id, userId))

  revalidatePath("/dashboard")
  revalidatePath("/dashboard/manage-students")
  revalidatePath("/dashboard/manage-staffs")
  revalidatePath("/dashboard/manage-revoked")
}

export async function bulkRevokeUsers(formData: FormData) {
  const { role: actor } = await requireRole("staff")

  const userIds = formData.getAll("userIds").map(String).filter(Boolean)

  for (const userId of userIds) {
    const target = await targetRoleOf(userId)
    if (!target || !canManage(actor, target)) continue

    await stashRestorePoint(userId)

    await auth.api.setRole({
      headers: await headers(),
      body: { userId, role: "revoked" },
    })

    await auth.api.revokeUserSessions({
      headers: await headers(),
      body: { userId },
    })
  }

  revalidatePath("/dashboard")
  revalidatePath("/dashboard/manage-students")
  revalidatePath("/dashboard/manage-staffs")
  revalidatePath("/dashboard/manage-revoked")
}

export async function bulkRestoreUsers(formData: FormData) {
  await requireAdmin()

  const userIds = formData.getAll("userIds").map(String).filter(Boolean)

  for (const userId of userIds) {
    const [target] = await db
      .select({ originalRole: user.originalRole })
      .from(user)
      .where(eq(user.id, userId))
      .limit(1)

    const stored = target?.originalRole
    const roleToRestore = asAuthRole(stored ?? "") ?? "student"

    await auth.api.setRole({
      headers: await headers(),
      body: { userId, role: roleToRestore },
    })

    await db.update(user).set({ originalRole: null }).where(eq(user.id, userId))
  }

  revalidatePath("/dashboard")
  revalidatePath("/dashboard/manage-students")
  revalidatePath("/dashboard/manage-staffs")
  revalidatePath("/dashboard/manage-revoked")
}

/**
 * Provisions a staff account. Staff accounts are never self-registered — an
 * administrator creates them here and shares the temporary password.
 */
export async function createStaffUser(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  await requireAdmin()

  const name = readString(formData, "name")
  const email = readString(formData, "email").toLowerCase()
  const password = readString(formData, "password")
  const phone = readString(formData, "phone")
  const department = readString(formData, "department")
  const employeeId = readString(formData, "employeeId")
  const designation = readString(formData, "designation")

  if (!name) {
    return { error: "Full name is required.", success: null }
  }
  if (!isValidEmail(email)) {
    return { error: "Enter a valid email address.", success: null }
  }
  if (password.length < 8) {
    return { error: "Password must be at least 8 characters.", success: null }
  }

  const existing = await db
    .select({ id: user.id })
    .from(user)
    .where(eq(user.email, email))
    .limit(1)

  if (existing.length > 0) {
    return {
      error: "An account with this email address already exists.",
      success: null,
    }
  }

  const data: Record<string, string> = {}
  if (phone) data.phone = phone
  if (department) data.department = department
  if (employeeId) data.employeeId = employeeId
  if (designation) data.designation = designation

  try {
    await auth.api.createUser({
      headers: await headers(),
      body: {
        email,
        password,
        name,
        role: "staff",
        data,
      },
    })
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to create the account."
    return { error: message, success: null }
  }

  revalidatePath("/dashboard/manage-staffs")
  return {
    error: null,
    success: `${name} can now sign in with ${email}.`,
  }
}

/**
 * Moves an account between the student and staff roles. Administrator
 * accounts are created by `bun run scripts:create-admin`, never from the UI.
 *
 * Admin-only: promoting a student to staff grants a privilege, so staff may
 * not do it.
 */
export async function changeUserRole(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const { session } = await requireAdmin()

  const userId = readString(formData, "userId")
  const role = readString(formData, "role")

  if (!userId) {
    return { error: "Missing user.", success: null }
  }
  const nextRole = asAuthRole(role)
  if (
    !nextRole ||
    !ASSIGNABLE_ROLES.includes(nextRole as "student" | "staff")
  ) {
    return { error: "That role cannot be assigned here.", success: null }
  }
  if (userId === session.user.id) {
    return { error: "You cannot change your own role.", success: null }
  }

  const [target] = await db
    .select({ role: user.role, name: user.name })
    .from(user)
    .where(eq(user.id, userId))
    .limit(1)

  if (!target) {
    return { error: "That user no longer exists.", success: null }
  }
  if (target.role === nextRole) {
    return {
      error: `${target.name} already has the ${nextRole} role.`,
      success: null,
    }
  }

  await auth.api.setRole({
    headers: await headers(),
    body: { userId, role: nextRole },
  })

  revalidatePath("/dashboard")
  revalidatePath("/dashboard/manage-students")
  revalidatePath("/dashboard/manage-staffs")

  return {
    error: null,
    success: `${target.name} is now a ${nextRole}.`,
  }
}

/**
 * Issues a new temporary password for an account. Staff may reset student
 * passwords; only an admin may reset a staff or administrator password.
 */
export async function resetUserPassword(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const userId = readString(formData, "userId")
  const newPassword = readString(formData, "newPassword")

  if (!userId) {
    return { error: "Missing user.", success: null }
  }
  if (newPassword.length < 8) {
    return { error: "Password must be at least 8 characters.", success: null }
  }

  const permission = await requireCanManage(userId)
  if (!permission) {
    return {
      error: "You do not have permission to reset that account's password.",
      success: null,
    }
  }

  const [target] = await db
    .select({ name: user.name })
    .from(user)
    .where(eq(user.id, userId))
    .limit(1)

  if (!target) {
    return { error: "That user no longer exists.", success: null }
  }

  try {
    await auth.api.setUserPassword({
      headers: await headers(),
      body: { userId, newPassword },
    })
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to reset the password."
    return { error: message, success: null }
  }

  return {
    error: null,
    success: `New password issued for ${target.name}.`,
  }
}

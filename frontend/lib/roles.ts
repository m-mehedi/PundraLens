/**
 * Canonical role vocabulary for the whole app.
 *
 * This module must stay free of server-only imports so it can be used from
 * client components as well as server components.
 */

export const ROLES = ["student", "staff", "admin", "revoked"] as const

export type Role = (typeof ROLES)[number]

/**
 * The role union Better Auth's admin plugin accepts in `setRole` / `createUser`
 * bodies. It must match the roles declared in `lib/auth.ts`.
 */
export type AuthRole = "student" | "staff" | "admin" | "revoked"

/**
 * Hierarchy used by `requireRole`. `revoked` is deliberately outside the
 * hierarchy: a revoked account has no role at all, it is simply banned.
 */
export const ROLE_WEIGHTS: Record<Role, number> = {
  revoked: 0,
  student: 1,
  staff: 2,
  admin: 3,
}

export const ROLE_LABELS: Record<Role, string> = {
  student: "Student",
  staff: "Staff",
  admin: "Administrator",
  revoked: "Revoked",
}

/** Narrows an arbitrary value (e.g. a session field) to a known role. */
export function isRole(value: unknown): value is Role {
  return (
    typeof value === "string" && (ROLES as readonly string[]).includes(value)
  )
}

/** Narrows an arbitrary string to a role Better Auth accepts. */
export function asAuthRole(value: string): AuthRole | null {
  return (ROLES as readonly string[]).includes(value)
    ? (value as AuthRole)
    : null
}

/** Reads a role off a session user, defaulting to `student`. */
export function roleOf(user: unknown): Role {
  const role = (user as { role?: unknown } | null)?.role
  return isRole(role) ? role : "student"
}

/** True when `role` is at least as privileged as `minimum`. */
export function hasRole(role: Role, minimum: Role): boolean {
  return ROLE_WEIGHTS[role] >= ROLE_WEIGHTS[minimum]
}

/** Roles an administrator may hand out from the management screens. */
export const ASSIGNABLE_ROLES = ["student", "staff"] as const

export type AssignableRole = (typeof ASSIGNABLE_ROLES)[number]

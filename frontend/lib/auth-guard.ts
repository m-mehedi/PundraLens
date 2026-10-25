import { headers } from "next/headers"
import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { ROLE_WEIGHTS, hasRole, roleOf, type Role } from "@/lib/roles"

export type { Role }
export { ROLE_WEIGHTS, hasRole, roleOf }

/**
 * Checks if the current user meets or exceeds the minimum required role.
 *
 * - No session  -> `/login`
 * - Revoked     -> `/revoked`
 * - Not enough  -> `/unauthorized`
 *
 * Intended for use in Server Components and Route Handlers.
 */
export async function requireRole(minimumRole: Role) {
  const session = await auth.api.getSession({
    headers: await headers(),
  })

  if (!session) {
    redirect("/login")
  }

  const userRole = roleOf(session.user)

  if (userRole === "revoked") {
    redirect("/revoked")
  }

  if (!hasRole(userRole, minimumRole)) {
    redirect("/unauthorized")
  }

  return { session, role: userRole }
}

/** Shorthand for `requireRole("staff")` — staff and administrators pass. */
export async function requireStaff() {
  return requireRole("staff")
}

/** Shorthand for `requireRole("admin")`. */
export async function requireAdmin() {
  return requireRole("admin")
}

import { headers } from "next/headers"
import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"

export type Role = "student" | "staff" | "admin"

export const ROLE_WEIGHTS: Record<Role, number> = {
  student: 1,
  staff: 2,
  admin: 3,
}

/**
 * Checks if the current user meets or exceeds the minimum required role.
 * If not, redirects to /unauthorized.
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

  const userRole = (session.user as { role?: Role }).role
  if (!userRole || !(userRole in ROLE_WEIGHTS)) {
    redirect("/unauthorized")
  }

  const userWeight = ROLE_WEIGHTS[userRole as Role]
  const requiredWeight = ROLE_WEIGHTS[minimumRole]

  if (userWeight < requiredWeight) {
    redirect("/unauthorized")
  }

  return session
}

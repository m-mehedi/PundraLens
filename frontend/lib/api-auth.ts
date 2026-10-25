import { NextResponse } from "next/server"
import { headers } from "next/headers"

import { auth } from "@/lib/auth"
import { hasRole, roleOf, type Role } from "@/lib/roles"

/**
 * Session check for route handlers.
 *
 * Route handlers cannot reuse `requireRole` because that redirects, which is
 * meaningless for a fetch from the browser. This returns either the session or
 * a ready-to-return error response.
 */
export async function apiSession(minimum: Role = "student") {
  const session = await auth.api.getSession({ headers: await headers() })

  if (!session) {
    return {
      session: null,
      error: NextResponse.json({ detail: "Not signed in" }, { status: 401 }),
    } as const
  }

  const role = roleOf(session.user)

  if (role === "revoked") {
    return {
      session: null,
      error: NextResponse.json({ detail: "Account revoked" }, { status: 403 }),
    } as const
  }

  if (!hasRole(role, minimum)) {
    return {
      session: null,
      error: NextResponse.json(
        { detail: "You do not have permission to do that" },
        { status: 403 }
      ),
    } as const
  }

  return { session, error: null } as const
}

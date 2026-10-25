import { NextResponse } from "next/server"
import { toNextJsHandler } from "better-auth/next-js"

import { auth } from "@/lib/auth"
import { db } from "@/db"
import { user } from "@/auth-schema"
import { eq } from "drizzle-orm"
import { asAuthRole, roleOf, type Role } from "@/lib/roles"

const handler = toNextJsHandler(auth)

/**
 * Admin-plugin endpoints that a staff member may use, but only against a
 * student account.
 *
 * Better Auth's permission statements are global — giving `staff` the
 * `set-role` permission (needed to revoke a student) also lets the raw
 * `/api/auth/admin/set-role` endpoint act on any account. The server actions
 * in `lib/user-actions.ts` restrict the target, but those actions are not the
 * only way to reach the plugin: the endpoints are mounted here. This guard
 * makes the same "students only" rule apply to direct calls.
 */
const STUDENT_SCOPED_ENDPOINTS = new Set([
  "/admin/set-role",
  "/admin/set-user-password",
  "/admin/ban-user",
  "/admin/unban-user",
  "/admin/update-user",
  "/admin/remove-user",
])

/**
 * Decides whether a staff caller may act on `userId`.
 *
 * Staff manage the student roster. That means:
 *  - the target must currently be a `student`, or a `revoked` account that was
 *    a student (so a revoke can be undone), and
 *  - the request must not land the account in `staff` or `admin`.
 *
 * A revoked *staff* account has `originalRole: "staff"`, so it stays out of
 * reach even though its current role is `revoked`.
 */
async function staffMayManage(
  userId: string,
  nextRole: Role | null
): Promise<boolean> {
  const [target] = await db
    .select({ role: user.role, originalRole: user.originalRole })
    .from(user)
    .where(eq(user.id, userId))
    .limit(1)

  if (!target) return false

  const currentRole = asAuthRole(target.role ?? "") ?? "student"
  const wasRole = asAuthRole(target.originalRole ?? "")

  const targetIsStudentish =
    currentRole === "student" ||
    (currentRole === "revoked" && (wasRole === null || wasRole === "student"))

  // `null` means the endpoint does not set a role (e.g. set-password).
  const nextRoleIsAllowed =
    nextRole === null || nextRole === "student" || nextRole === "revoked"

  return targetIsStudentish && nextRoleIsAllowed
}

/**
 * Returns a 403 response when a staff caller is trying to change a non-student
 * account. Admins are unrestricted; everyone else is rejected earlier by the
 * plugin's own permission checks.
 */
async function guardAdminEndpoint(
  request: Request
): Promise<NextResponse | null> {
  const { pathname } = new URL(request.url)

  // The catch-all route receives the full path (`/api/auth/admin/set-role`).
  const endpoint = pathname.replace(/^\/api\/auth/, "")
  if (!STUDENT_SCOPED_ENDPOINTS.has(endpoint)) return null

  const session = await auth.api.getSession({ headers: request.headers })
  if (!session) return null

  const actor = roleOf(session.user)
  if (actor !== "staff") return null

  let body: unknown
  try {
    body = await request.clone().json()
  } catch {
    return null
  }

  const userId = (body as { userId?: unknown } | null)?.userId
  if (typeof userId !== "string" || !userId) return null

  const rawRole = (body as { role?: unknown } | null)?.role
  const nextRole = typeof rawRole === "string" ? asAuthRole(rawRole) : null

  if (await staffMayManage(userId, nextRole)) return null

  return NextResponse.json(
    { message: "Staff can only manage student accounts", code: "FORBIDDEN" },
    { status: 403 }
  )
}

async function withGuard(
  request: Request,
  run: (request: Request) => Promise<Response>
): Promise<Response> {
  const blocked = await guardAdminEndpoint(request)
  if (blocked) return blocked
  return run(request)
}

export function GET(request: Request) {
  return handler.GET(request)
}

export function POST(request: Request) {
  return withGuard(request, handler.POST)
}

import { createAuthClient } from "better-auth/react"
import { inferAdditionalFields, adminClient } from "better-auth/client/plugins"
import { auth } from "@/lib/auth"

/** Configurable domain suffix for converting Student IDs to synthetic emails */
export const STUDENT_EMAIL_DOMAIN = "@user.pundra"

/** Converts a Student ID to a synthetic email address for Better Auth */
export function studentIdToEmail(studentId: string): string {
  return `${studentId}${STUDENT_EMAIL_DOMAIN}`
}

export const authClient = createAuthClient({
    /** The base URL of the server (optional if you're using the same domain) */
    baseURL: "http://localhost:3000",
    plugins: [inferAdditionalFields<typeof auth>(), adminClient()]
})

import { createAuthClient } from "better-auth/react"
import { inferAdditionalFields, adminClient } from "better-auth/client/plugins"
import { auth } from "@/lib/auth"
import {
  STUDENT_EMAIL_DOMAIN,
  studentIdToEmail,
  getDisplayId,
  resolveLoginIdentifier,
} from "@/lib/user-id"

export {
  STUDENT_EMAIL_DOMAIN,
  studentIdToEmail,
  getDisplayId,
  resolveLoginIdentifier,
}

export const authClient = createAuthClient({
  // No `baseURL`: Better Auth falls back to the current origin, so the client
  // keeps working on any deployed host. Set `NEXT_PUBLIC_BETTER_AUTH_URL` only
  // when the auth API is served from a different origin.
  plugins: [inferAdditionalFields<typeof auth>(), adminClient()],
})

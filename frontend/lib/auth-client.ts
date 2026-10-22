import { createAuthClient } from "better-auth/react"
import { inferAdditionalFields, adminClient } from "better-auth/client/plugins"
import { auth } from "@/lib/auth"
import { STUDENT_EMAIL_DOMAIN, studentIdToEmail } from "@/lib/user-id"

export { STUDENT_EMAIL_DOMAIN, studentIdToEmail }

export const authClient = createAuthClient({
  /** The base URL of the server (optional if you're using the same domain) */
  baseURL: "http://localhost:3000",
  plugins: [inferAdditionalFields<typeof auth>(), adminClient()],
})

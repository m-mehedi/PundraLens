import { betterAuth } from "better-auth/minimal"
import { drizzleAdapter } from "@better-auth/drizzle-adapter/relations-v2"
import { admin } from "better-auth/plugins"
import { createAccessControl } from "better-auth/plugins/access"
import { db } from "@/db"

import * as schema from "@/auth-schema"

/**
 * Statements the admin plugin can guard. Mirrors Better Auth's built-in
 * admin statements — `user` and `session` management.
 */
const adminStatements = {
  user: [
    "create",
    "list",
    "set-role",
    "ban",
    "impersonate",
    "impersonate-admins",
    "delete",
    "set-password",
    "set-email",
    "get",
    "update",
  ],
  session: ["list", "revoke", "delete"],
} as const

const ac = createAccessControl(adminStatements)

/**
 * Roles recognised by Better Auth's admin plugin.
 *
 * Declaring them here is what makes `auth.api.setRole` accept `staff` and
 * `revoked` — without `roles`, the plugin rejects any role outside its own
 * `admin`/`user` pair.
 */
export const authRoles = {
  student: ac.newRole({ user: [], session: [] }),
  // Staff review the student roster: they can list students and revoke or
  // reset a student account. The plugin cannot scope these statements to a
  // target role, so the "students only" restriction is enforced per action in
  // `lib/user-actions.ts`. Deliberately NOT granted: `create` (provisioning
  // staff accounts), `delete`, `ban`, `set-email`, `impersonate`, `update`.
  staff: ac.newRole({
    user: ["list", "get", "set-role", "set-password"],
    session: ["revoke"],
  }),
  admin: ac.newRole(adminStatements),
  revoked: ac.newRole({ user: [], session: [] }),
}

export const auth = betterAuth({
  emailAndPassword: {
    enabled: true,
  },
  user: {
    additionalFields: {
      // NOTE: `role` is deliberately NOT declared here. The admin plugin
      // declares its own `role` field and plugin fields win over
      // `additionalFields`, so a duplicate declaration here would be dead
      // config. The plugin's `defaultRole` below is the single source of
      // truth for the role a new account starts with.
      department: {
        type: "string",
        required: false,
        input: true,
      },
      batch: {
        type: "string",
        required: false,
        input: true,
      },
      semester: {
        type: "string",
        required: false,
        input: true,
      },
      phone: {
        type: "string",
        required: false,
        input: true,
      },
      employeeId: {
        type: "string",
        required: false,
        input: true,
      },
      designation: {
        type: "string",
        required: false,
        input: true,
      },
    },
  },
  plugins: [
    admin({
      // Every self-registered account starts as a student. Without this the
      // plugin defaults to "user", which no screen in this app recognises.
      defaultRole: "student",
      adminRoles: ["admin"],
      roles: authRoles,
    }),
  ],
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: schema,
  }),
})

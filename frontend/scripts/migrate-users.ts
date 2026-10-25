import "dotenv/config"
import { db } from "@/db"
import { user } from "@/auth-schema"
import { ROLES } from "@/lib/roles"
import { inArray, sql } from "drizzle-orm"

/**
 * One-off data repair for databases created before the role model was fixed.
 *
 * Safe to run repeatedly — every statement is idempotent.
 *
 * What it repairs:
 *  1. `role = 'user'` — the Better Auth admin plugin used to default new
 *     accounts to "user". Nothing in this app knows that role, so those
 *     accounts were invisible to every role-filtered screen.
 *  2. `original_role = 'revoked'` — revoking an already-revoked account used
 *     to overwrite the restore point with "revoked", so restoring the account
 *     restored it straight back to banned.
 */

const LEGACY_ROLES = ["user"] as const

async function main() {
  const knownRoles = ROLES.filter((role) => role !== "revoked")

  const legacy = await db
    .select({ id: user.id, email: user.email, role: user.role })
    .from(user)
    .where(inArray(user.role, [...LEGACY_ROLES]))

  if (legacy.length > 0) {
    await db
      .update(user)
      .set({ role: "student" })
      .where(inArray(user.role, [...LEGACY_ROLES]))
    for (const row of legacy) {
      console.log(`- ${row.email}: role "${row.role}" -> "student"`)
    }
  }

  const brokenRestorePoints = await db
    .select({ id: user.id, email: user.email, originalRole: user.originalRole })
    .from(user)
    .where(
      sql`${user.role} = 'revoked' AND (${user.originalRole} IS NULL OR ${user.originalRole} = 'revoked')`
    )

  if (brokenRestorePoints.length > 0) {
    await db
      .update(user)
      .set({ originalRole: "student" })
      .where(
        sql`${user.role} = 'revoked' AND (${user.originalRole} IS NULL OR ${user.originalRole} = 'revoked')`
      )
    for (const row of brokenRestorePoints) {
      console.log(
        `- ${row.email}: original_role "${row.originalRole ?? "null"}" -> "student"`
      )
    }
  }

  const unknown = await db
    .select({ id: user.id, email: user.email, role: user.role })
    .from(user)
    .where(
      sql`${user.role} NOT IN (${sql.join(
        knownRoles.map((role) => sql`${role}`),
        sql`, `
      )}) AND ${user.role} != 'revoked'`
    )

  if (unknown.length > 0) {
    await db
      .update(user)
      .set({ role: "student" })
      .where(
        sql`${user.role} NOT IN (${sql.join(
          knownRoles.map((role) => sql`${role}`),
          sql`, `
        )}) AND ${user.role} != 'revoked'`
      )
    for (const row of unknown) {
      console.log(`- ${row.email}: unknown role "${row.role}" -> "student"`)
    }
  }

  const revokedWithoutRestore = await db
    .select({ id: user.id, email: user.email })
    .from(user)
    .where(sql`${user.role} = 'revoked' AND ${user.originalRole} IS NULL`)

  if (revokedWithoutRestore.length > 0) {
    await db
      .update(user)
      .set({ originalRole: "student" })
      .where(sql`${user.role} = 'revoked' AND ${user.originalRole} IS NULL`)
    for (const row of revokedWithoutRestore) {
      console.log(`- ${row.email}: missing restore point -> "student"`)
    }
  }

  const numericNames = await db
    .select({ id: user.id, email: user.email, name: user.name })
    .from(user)
    .where(sql`${user.name} ~ '^[0-9]'`)

  const total = await db.$count(user)

  console.log(`\nUsers checked: ${total}`)
  console.log(
    `Legacy roles fixed: ${legacy.length + unknown.length}, restore points fixed: ${
      brokenRestorePoints.length + revokedWithoutRestore.length
    }`
  )
  if (numericNames.length > 0) {
    console.log(
      `\n${numericNames.length} account(s) still use their ID as the display name. They can set a real name under Dashboard -> Profile.`
    )
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Failed to migrate users:", err)
    process.exit(1)
  })

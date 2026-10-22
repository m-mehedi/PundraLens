import "dotenv/config"
import { auth } from "@/lib/auth"
import { db } from "@/db"
import { user } from "@/auth-schema"
import { eq } from "drizzle-orm"
import { createLocalAccountIssuer } from "better-auth/db"
import { STUDENT_EMAIL_DOMAIN } from "@/lib/user-id"

type SeedRole = "student" | "staff" | "admin"

type SeedUser = {
  email: string
  name: string
  role: SeedRole
}

const DEFAULT_PASSWORD = "Pundra@123"

const STUDENT_IDS = [
  "0322512101",
  "0322512102",
  "0322512103",
  "0322512104",
  "0322512105",
  "0322512106",
  "0322512107",
  "0322512108",
  "0322512109",
  "0322512110",
]

function buildSeedUsers(): SeedUser[] {
  const users: SeedUser[] = []

  const adminEmail = process.env.ADMIN_EMAIL
  if (adminEmail) {
    users.push({
      email: adminEmail,
      name: "Admin",
      role: "admin",
    })
  }

  users.push(
    {
      email: `staff1${STUDENT_EMAIL_DOMAIN}`,
      name: "Staff One",
      role: "staff",
    },
    { email: `staff2${STUDENT_EMAIL_DOMAIN}`, name: "Staff Two", role: "staff" }
  )

  for (const studentId of STUDENT_IDS) {
    users.push({
      email: `${studentId}${STUDENT_EMAIL_DOMAIN}`,
      name: `Student ${studentId}`,
      role: "student",
    })
  }

  return users
}

async function main() {
  const password = process.env.SEED_PASSWORD ?? DEFAULT_PASSWORD

  if (password.length < 8) {
    console.error("SEED_PASSWORD must be at least 8 characters long.")
    process.exit(1)
  }

  const ctx = await auth.$context
  const hashedPassword = await ctx.password.hash(password)

  let created = 0
  let skipped = 0

  for (const seedUser of buildSeedUsers()) {
    const existing = await ctx.internalAdapter.findUserByEmail(seedUser.email)
    if (existing) {
      console.log(`- ${seedUser.email} (${seedUser.role}) exists, skipping.`)
      skipped += 1
      continue
    }

    const createdUser = await ctx.internalAdapter.createUser(
      {
        email: seedUser.email,
        name: seedUser.name,
        role: seedUser.role,
        emailVerified: true,
      },
      {
        method: "email-password",
      }
    )

    await ctx.internalAdapter.createAccount({
      userId: createdUser.id,
      providerId: "credential",
      issuer: createLocalAccountIssuer("credential"),
      accountId: createdUser.id,
      password: hashedPassword,
    })

    // The admin plugin may normalise the role on insert; force the seed role.
    await db
      .update(user)
      .set({ role: seedUser.role })
      .where(eq(user.id, createdUser.id))

    console.log(`+ ${seedUser.email} (${seedUser.role}) created.`)
    created += 1
  }

  console.log(`\nDone. ${created} created, ${skipped} skipped.`)
  console.log(`All seeded users share the password: ${password}`)
}

main().catch((err) => {
  console.error("Failed to seed users:", err)
  process.exit(1)
})

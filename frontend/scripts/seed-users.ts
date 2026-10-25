import "dotenv/config"
import { auth } from "@/lib/auth"
import { STUDENT_EMAIL_DOMAIN } from "@/lib/user-id"
import type { AuthRole } from "@/lib/roles"

type SeedUser = {
  email: string
  name: string
  role: AuthRole
  phone?: string
  department?: string
  batch?: string
  semester?: string
  employeeId?: string
  designation?: string
}

const DEFAULT_PASSWORD = "Pundra@123"

const STUDENTS: {
  id: string
  name: string
  batch: string
  semester: string
}[] = [
  { id: "0322512101", name: "Rafiqul Islam", batch: "54", semester: "5" },
  { id: "0322512102", name: "Nusrat Jahan", batch: "54", semester: "5" },
  { id: "0322512103", name: "Tanvir Ahmed", batch: "53", semester: "6" },
  { id: "0322512104", name: "Sadia Afrin", batch: "53", semester: "6" },
  { id: "0322512105", name: "Mahmudul Hasan", batch: "52", semester: "7" },
  { id: "0322512106", name: "Farhana Akter", batch: "52", semester: "7" },
  { id: "0322512107", name: "Imran Khan", batch: "51", semester: "8" },
  { id: "0322512108", name: "Sharmin Sultana", batch: "51", semester: "8" },
  { id: "0322512109", name: "Arif Hossain", batch: "54", semester: "5" },
  { id: "0322512110", name: "Jannatul Ferdous", batch: "53", semester: "6" },
]

function buildSeedUsers(): SeedUser[] {
  const users: SeedUser[] = []

  const adminEmail = process.env.ADMIN_EMAIL
  if (adminEmail) {
    users.push({
      email: adminEmail,
      name: process.env.ADMIN_NAME ?? "Portal Administrator",
      role: "admin",
      designation: "System Administrator",
    })
  }

  users.push(
    {
      email: `staff1${STUDENT_EMAIL_DOMAIN}`,
      name: "Mohammad Karim",
      role: "staff",
      employeeId: "PU-1001",
      designation: "Academic Officer",
      department: "Office of the Registrar",
    },
    {
      email: `staff2${STUDENT_EMAIL_DOMAIN}`,
      name: "Rehana Parvin",
      role: "staff",
      employeeId: "PU-1002",
      designation: "Examination Controller",
      department: "Controller of Examinations",
    }
  )

  for (const student of STUDENTS) {
    users.push({
      email: `${student.id}${STUDENT_EMAIL_DOMAIN}`,
      name: student.name,
      role: "student",
      department: "Computer Science & Engineering",
      batch: student.batch,
      semester: student.semester,
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

  let created = 0
  let skipped = 0

  for (const seedUser of buildSeedUsers()) {
    const existing = await ctx.internalAdapter.findUserByEmail(seedUser.email)
    if (existing) {
      console.log(`- ${seedUser.email} (${seedUser.role}) exists, skipping.`)
      skipped += 1
      continue
    }

    const { role, ...profile } = seedUser

    // `auth.api.createUser` runs through the admin plugin, so the role is
    // validated against the roles declared in `lib/auth.ts` and the profile
    // fields are written in the same insert.
    await auth.api.createUser({
      body: {
        email: seedUser.email,
        password,
        name: seedUser.name,
        role,
        data: profile,
      },
    })

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

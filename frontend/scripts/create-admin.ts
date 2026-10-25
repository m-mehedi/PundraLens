import "dotenv/config"
import { auth } from "@/lib/auth"
import { createLocalAccountIssuer } from "better-auth/db"

async function main() {
  const email = process.env.ADMIN_EMAIL
  const password = process.env.ADMIN_PASSWORD

  if (!email || !password) {
    console.error(
      "Missing environment variables. Set ADMIN_EMAIL and ADMIN_PASSWORD."
    )
    process.exit(1)
  }

  const ctx = await auth.$context

  // Check if an admin already exists
  const existing = await ctx.internalAdapter.findUserByEmail(email)
  if (existing) {
    console.log(`User ${email} already exists. Skipping.`)
    process.exit(0)
  }

  // Hash the password
  const hashedPassword = await ctx.password.hash(password)

  // Create the user with role: "admin"
  const user = await ctx.internalAdapter.createUser(
    {
      email,
      name: process.env.ADMIN_NAME ?? email.split("@")[0],
      role: "admin",
      emailVerified: true,
    },
    {
      method: "email-password",
    }
  )

  // Create the account with the hashed password
  await ctx.internalAdapter.createAccount({
    userId: user.id,
    providerId: "credential",
    issuer: createLocalAccountIssuer("credential"),
    accountId: user.id,
    password: hashedPassword,
  })

  console.log(`Admin user created successfully: ${email}`)
}

main().catch((err) => {
  console.error("Failed to create admin:", err)
  process.exit(1)
})

import "dotenv/config"
import { drizzle } from "drizzle-orm/postgres-js"
import postgres from "postgres"

const connectionString = process.env.DATABASE_URL

if (!connectionString) {
  throw new Error(
    "DATABASE_URL is not set (Supabase Postgres connection string)"
  )
}

// Reuse the connection across hot reloads in development so we do not exhaust
// the Supabase pooler's connection limit.
const globalForDb = globalThis as unknown as {
  pgClient?: ReturnType<typeof postgres>
}

const client =
  globalForDb.pgClient ??
  postgres(connectionString, {
    prepare: false,
    max: 5,
  })

if (process.env.NODE_ENV !== "production") {
  globalForDb.pgClient = client
}

export const db = drizzle({ client })

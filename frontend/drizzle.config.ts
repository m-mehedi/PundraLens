import "dotenv/config"
import { defineConfig } from "drizzle-kit"

export default defineConfig({
  out: "./drizzle",
  schema: "./schemas/index.ts",
  dialect: "postgresql",
  dbCredentials: {
    // Migrations need a session connection; the app runtime uses the
    // transaction pooler instead (see `.env`).
    url: process.env.DIRECT_DATABASE_URL ?? process.env.DATABASE_URL!,
  },
})

import { betterAuth } from "better-auth/minimal";
import { drizzleAdapter } from "@better-auth/drizzle-adapter/relations-v2";
import { admin } from "better-auth/plugins";
import {db} from "@/db"

import * as schema from '@/auth-schema'
export const auth = betterAuth({
  emailAndPassword: {
    enabled: true
  },
  user: {
    additionalFields: {
      role: {
        type: "string",
        required: true,
        defaultValue: "student",
        input: false,
      },
    },
  },
  plugins: [admin()],
  database: drizzleAdapter(db, {
      provider: "sqlite",
      schema: schema
    }),
});

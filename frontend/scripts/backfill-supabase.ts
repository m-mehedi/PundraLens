import "dotenv/config"
import Database from "better-sqlite3"
import { sql } from "drizzle-orm"
import { db } from "@/db"
import { user, session, account, verification } from "@/auth-schema"
import { notice } from "@/lib/notice-schema"

/**
 * One-off migration of the old local SQLite database (`DB_FILE_NAME`) into
 * Supabase Postgres (`DATABASE_URL`).
 *
 * Run it once, after `bun run db:migrate` has created the Postgres tables:
 *
 *   bun run scripts:backfill-supabase
 *
 * It is idempotent: every row is written with `ON CONFLICT DO NOTHING` on the
 * primary key, so re-running never duplicates and never clobbers a row that
 * already exists in Postgres. Date columns that SQLite stored as epoch
 * milliseconds are converted to real timestamps.
 */

const sqlitePath = process.env.DB_FILE_NAME
if (!sqlitePath) {
  throw new Error("DB_FILE_NAME is not set — point it at the old SQLite file")
}

const ms = (value: number | null | undefined): Date | null =>
  value === null || value === undefined ? null : new Date(value)

function bool(value: number | null | undefined): boolean {
  return value === 1
}

async function main() {
  const sqlite = new Database(sqlitePath, { readonly: true })

  const users = sqlite.prepare("SELECT * FROM user").all() as Record<
    string,
    unknown
  >[]
  const sessions = sqlite.prepare("SELECT * FROM session").all() as Record<
    string,
    unknown
  >[]
  const accounts = sqlite.prepare("SELECT * FROM account").all() as Record<
    string,
    unknown
  >[]
  const verifications = sqlite
    .prepare("SELECT * FROM verification")
    .all() as Record<string, unknown>[]
  const notices = sqlite.prepare("SELECT * FROM notice").all() as Record<
    string,
    unknown
  >[]

  console.log(
    `Read from SQLite: ${users.length} users, ${sessions.length} sessions, ` +
      `${accounts.length} accounts, ${verifications.length} verifications, ` +
      `${notices.length} notices.`
  )

  if (users.length) {
    await db
      .insert(user)
      .values(
        users.map((row) => ({
          id: String(row.id),
          name: String(row.name),
          email: String(row.email),
          emailVerified: bool(row.email_verified as number),
          image: (row.image as string) ?? null,
          role: (row.role as string) ?? "student",
          originalRole: (row.original_role as string) ?? null,
          banned: bool(row.banned as number),
          banReason: (row.ban_reason as string) ?? null,
          banExpires: ms(row.ban_expires as number),
          department: (row.department as string) ?? null,
          batch: (row.batch as string) ?? null,
          semester: (row.semester as string) ?? null,
          phone: (row.phone as string) ?? null,
          employeeId: (row.employee_id as string) ?? null,
          designation: (row.designation as string) ?? null,
          createdAt: ms(row.created_at as number) ?? new Date(),
          updatedAt: ms(row.updated_at as number) ?? new Date(),
        }))
      )
      .onConflictDoNothing()
  }

  if (accounts.length) {
    await db
      .insert(account)
      .values(
        accounts.map((row) => ({
          id: String(row.id),
          issuer: String(row.issuer),
          accountId: String(row.account_id),
          providerId: String(row.provider_id),
          userId: String(row.user_id),
          accessToken: (row.access_token as string) ?? null,
          refreshToken: (row.refresh_token as string) ?? null,
          idToken: (row.id_token as string) ?? null,
          accessTokenExpiresAt: ms(row.access_token_expires_at as number),
          refreshTokenExpiresAt: ms(row.refresh_token_expires_at as number),
          scope: (row.scope as string) ?? null,
          password: (row.password as string) ?? null,
          createdAt: ms(row.created_at as number) ?? new Date(),
          updatedAt: ms(row.updated_at as number) ?? new Date(),
        }))
      )
      .onConflictDoNothing()
  }

  if (sessions.length) {
    await db
      .insert(session)
      .values(
        sessions.map((row) => ({
          id: String(row.id),
          expiresAt: ms(row.expires_at as number) ?? new Date(),
          token: String(row.token),
          createdAt: ms(row.created_at as number) ?? new Date(),
          updatedAt: ms(row.updated_at as number) ?? new Date(),
          ipAddress: (row.ip_address as string) ?? null,
          userAgent: (row.user_agent as string) ?? null,
          userId: String(row.user_id),
          impersonatedBy: (row.impersonated_by as string) ?? null,
        }))
      )
      .onConflictDoNothing()
  }

  if (verifications.length) {
    await db
      .insert(verification)
      .values(
        verifications.map((row) => ({
          id: String(row.id),
          identifier: String(row.identifier),
          value: String(row.value),
          expiresAt: ms(row.expires_at as number) ?? new Date(),
          createdAt: ms(row.created_at as number) ?? new Date(),
          updatedAt: ms(row.updated_at as number) ?? new Date(),
        }))
      )
      .onConflictDoNothing()
  }

  for (const row of notices) {
    let batches: number[] | null = null
    if (typeof row.batches === "string" && row.batches) {
      try {
        batches = JSON.parse(row.batches)
      } catch {
        batches = null
      }
    }

    await db
      .insert(notice)
      .values({
        id: row.id as number,
        title: (row.title as string) ?? null,
        issuingOffice: (row.issuing_office as string) ?? null,
        dateOfIssue: (row.date_of_issue as string) ?? null,
        category: (row.category as string) ?? "general",
        deadline: (row.deadline as string) ?? null,
        eventDateAndTime: (row.event_date_and_time as string) ?? null,
        venue: (row.venue as string) ?? null,
        departments: (row.departments as string) ?? null,
        batches,
        requiredAction: (row.required_action as string) ?? null,
        fees: (row.fees as string) ?? null,
        contact: (row.contact as string) ?? null,
        noticeNo: (row.notice_no as string) ?? null,
        noticeSummaryBn: (row.notice_summary_bn as string) ?? null,
        noticeSummaryEn: (row.notice_summary_en as string) ?? null,
        rawText: (row.raw_text as string) ?? null,
        sourceType: (row.source_type as string) ?? "photo",
        fileName: (row.file_name as string) ?? null,
        status: (row.status as string) ?? "draft",
        createdAt: ms(row.created_at as number),
        publishedAt: ms(row.published_at as number),
        publishedBy: (row.published_by as string) ?? null,
        reviewNotes: (row.review_notes as string) ?? null,
        version: (row.version as number) ?? 1,
      })
      .onConflictDoNothing()
  }

  // Keep the identity sequence ahead of the explicit ids we just inserted.
  await db.execute(
    sql`SELECT setval(pg_get_serial_sequence('notice', 'id'), COALESCE((SELECT MAX(id) FROM notice), 1))`
  )

  sqlite.close()
  console.log("Backfill complete. Run `bun run scripts:index-notices` next.")
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Backfill failed:", error)
    process.exit(1)
  })

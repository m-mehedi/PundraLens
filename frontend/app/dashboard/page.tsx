import { redirect } from "next/navigation"
import { headers } from "next/headers"

import { auth } from "@/lib/auth"
import { listNotices } from "@/lib/backend-server"
import { noticeCalendarEvents } from "@/lib/notice-calendar"
import { NoticeCalendarCard } from "@/components/dashboard/notice-calendar-card"

export const dynamic = "force-dynamic"

export default async function OverviewPage() {
  const session = await auth.api.getSession({
    headers: await headers(),
  })

  if (!session) {
    redirect("/login")
  }

  const { notices } = await listNotices({ status: "published", limit: 500 })

  const rawBatch = (session.user as { batch?: string | null }).batch
  const parsedBatch = rawBatch ? Number.parseInt(rawBatch, 10) : Number.NaN
  const batch = Number.isNaN(parsedBatch) ? null : parsedBatch

  const events = noticeCalendarEvents(notices, batch)

  return (
    <div className="flex flex-col gap-6">
      <NoticeCalendarCard events={events} />
    </div>
  )
}

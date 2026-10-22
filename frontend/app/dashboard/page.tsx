import { redirect } from "next/navigation"
import { headers } from "next/headers"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  Calendar03Icon,
  DocumentAttachmentIcon,
  Pen02Icon,
} from "@hugeicons/core-free-icons"

import { auth } from "@/lib/auth"
import { listNotices } from "@/lib/backend-server"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

export const dynamic = "force-dynamic"

function formatDate(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  })
}

export default async function OverviewPage() {
  const session = await auth.api.getSession({
    headers: await headers(),
  })

  if (!session) {
    redirect("/login")
  }

  const { notices } = await listNotices({ status: "all", limit: 500 })

  const published = notices.filter((notice) => notice.status === "published")
  const drafts = notices.filter((notice) => notice.status === "draft")

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const weekAhead = new Date(today)
  weekAhead.setDate(weekAhead.getDate() + 7)

  const upcoming = published
    .flatMap((notice) =>
      (notice.deadlines ?? [])
        .filter((deadline) => {
          const date = new Date(deadline.date)
          if (Number.isNaN(date.getTime())) return false
          return date >= today && date <= weekAhead
        })
        .map((deadline) => ({ notice, deadline }))
    )
    .sort((a, b) => a.deadline.date.localeCompare(b.deadline.date))

  const stats = [
    {
      icon: DocumentAttachmentIcon,
      title: "Published notices",
      value: published.length,
      description: "Visible to students and cited by LensBot.",
    },
    {
      icon: Pen02Icon,
      title: "Drafts",
      value: drafts.length,
      description: "Waiting for a staff member to publish them.",
    },
    {
      icon: Calendar03Icon,
      title: "Deadlines this week",
      value: upcoming.length,
      description: "Between today and the next seven days.",
    },
  ]

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Overview</h1>
        <p className="mt-1 text-muted-foreground">
          What is happening across Pundra University notices right now.
        </p>
      </div>

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {stats.map((stat) => (
          <Card key={stat.title}>
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <HugeiconsIcon icon={stat.icon} className="size-5" />
                </div>
                <CardTitle className="text-lg">{stat.title}</CardTitle>
              </div>
              <CardDescription className="mt-2">
                {stat.description}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold tracking-tight">{stat.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Upcoming deadlines</CardTitle>
          <CardDescription>
            Deadlines from published notices in the next seven days.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {upcoming.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No deadlines in the coming week.
            </p>
          ) : (
            <ul className="flex flex-col gap-3">
              {upcoming.map(({ notice, deadline }) => (
                <li
                  key={`${notice.id}-${deadline.date}-${deadline.description}`}
                  className="flex flex-wrap items-center justify-between gap-3 border-b pb-3 last:border-0 last:pb-0"
                >
                  <div className="flex flex-col gap-0.5">
                    <p className="font-medium">
                      {notice.title ?? "Untitled notice"}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {deadline.description}
                    </p>
                  </div>
                  <Badge variant="outline">{formatDate(deadline.date)}</Badge>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

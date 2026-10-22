import Link from "next/link"
import { notFound, redirect } from "next/navigation"
import { headers } from "next/headers"
import { HugeiconsIcon } from "@hugeicons/react"
import { ArrowLeft01Icon } from "@hugeicons/core-free-icons"

import { auth } from "@/lib/auth"
import { getNotice } from "@/lib/backend-server"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { NoticeEditForm } from "@/components/dashboard/notice-edit-form"

export const dynamic = "force-dynamic"

export default async function EditNoticePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const session = await auth.api.getSession({
    headers: await headers(),
  })

  if (!session) {
    redirect("/login")
  }

  const userRole = (session.user as { role?: string }).role
  if (userRole !== "staff" && userRole !== "admin") {
    redirect("/unauthorized")
  }

  const { id } = await params
  const noticeId = Number(id)
  if (!Number.isFinite(noticeId)) {
    notFound()
  }

  const notice = await getNotice(noticeId)
  if (!notice) {
    notFound()
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <Button
          variant="ghost"
          size="sm"
          nativeButton={false}
          render={<Link href="/dashboard/manage-notice" />}
          className="w-fit"
        >
          <HugeiconsIcon icon={ArrowLeft01Icon} strokeWidth={2} />
          Back to manage notice
        </Button>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-bold tracking-tight">Edit notice</h1>
          <Badge variant="secondary">{notice.status}</Badge>
        </div>
        <p className="text-muted-foreground">
          {notice.title ?? "Untitled notice"}
          {notice.issuing_office ? ` · ${notice.issuing_office}` : ""}
        </p>
      </div>

      <NoticeEditForm notice={notice} />
    </div>
  )
}

import { notFound } from "next/navigation"

import { requireRole } from "@/lib/auth-guard"
import { getNotice } from "@/lib/backend-server"
import { NoticeEditForm } from "@/components/dashboard/notice-edit-form"

export const dynamic = "force-dynamic"

export default async function EditNoticePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  await requireRole("staff")

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
      <NoticeEditForm notice={notice} />
    </div>
  )
}

import { requireRole } from "@/lib/auth-guard"
import { listNotices } from "@/lib/backend-server"
import { listDepartments } from "@/lib/notice-lookups"
import { deleteNoticeAction, publishNoticeAction } from "@/lib/notice-actions"
import { ManageNotices } from "@/components/dashboard/manage-notices"

export const dynamic = "force-dynamic"

export default async function ManageNoticePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const { session } = await requireRole("staff")

  const params = await searchParams
  const first = (key: string) => {
    const value = params[key]
    return Array.isArray(value) ? value[0] : value
  }

  const status = first("status") ?? "all"
  const category = first("category")
  const department = first("department")
  const search = first("q")

  const [{ count, notices }, departments] = await Promise.all([
    listNotices({
      status: status as "published" | "draft" | "archived" | "all",
      category,
      department,
      search_query: search,
      limit: 200,
    }),
    listDepartments(),
  ])

  const publishedBy =
    (session.user as { name?: string; email?: string }).name ||
    (session.user as { email?: string }).email ||
    "Staff Reviewer"

  return (
    <ManageNotices
      notices={notices}
      count={count}
      departments={departments}
      publishAction={publishNoticeAction}
      deleteAction={deleteNoticeAction}
      publishedBy={publishedBy}
    />
  )
}

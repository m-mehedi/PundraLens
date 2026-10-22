import { redirect } from "next/navigation"
import { headers } from "next/headers"
import { auth } from "@/lib/auth"
import {
  listCategories,
  listDepartments,
  listNotices,
} from "@/lib/backend-server"
import { deleteNoticeAction, publishNoticeAction } from "@/lib/notice-actions"
import { NoticeFilters } from "@/components/dashboard/notice-filters"
import { NoticeTable } from "@/components/dashboard/notice-table"

export const dynamic = "force-dynamic"

export default async function ManageNoticePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
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

  const params = await searchParams
  const first = (key: string) => {
    const value = params[key]
    return Array.isArray(value) ? value[0] : value
  }

  const status = first("status") ?? "all"
  const category = first("category")
  const department = first("department")
  const search = first("q")

  const [{ notices }, departments, categories] = await Promise.all([
    listNotices({
      status: status as "published" | "draft" | "archived" | "all",
      category,
      department,
      search_query: search,
      limit: 200,
    }),
    listDepartments(),
    listCategories(),
  ])

  const publishedBy =
    (session.user as { name?: string; email?: string }).name ||
    (session.user as { email?: string }).email ||
    "Staff Reviewer"

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Manage Notice</h1>
        <p className="mt-1 text-muted-foreground">
          Review, edit and publish the notices uploaded by staff.
        </p>
      </div>

      <NoticeFilters
        departments={departments}
        categories={categories}
        showStatus
      />

      <NoticeTable
        notices={notices}
        publishAction={publishNoticeAction}
        deleteAction={deleteNoticeAction}
        publishedBy={publishedBy}
      />
    </div>
  )
}

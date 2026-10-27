import { redirect } from "next/navigation"
import { headers } from "next/headers"
import { auth } from "@/lib/auth"
import { listNotices } from "@/lib/backend-server"
import { listDepartments } from "@/lib/notice-lookups"
import { NoticeFilters } from "@/components/dashboard/notice-filters"
import { NoticeList } from "@/components/dashboard/notice-list"

export const dynamic = "force-dynamic"

export default async function NoticesPage({
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

  const params = await searchParams
  const first = (key: string) => {
    const value = params[key]
    return Array.isArray(value) ? value[0] : value
  }

  const status = first("status") ?? "published"
  const category = first("category")
  const department = first("department")
  const search = first("q")

  const [{ count, notices }, departments] = await Promise.all([
    listNotices({
      status: status as "published" | "draft" | "archived" | "all",
      category,
      department,
      search_query: search,
      limit: 100,
    }),
    listDepartments(),
  ])

  return (
    <div className="flex flex-col gap-6">
      <NoticeFilters
        departments={departments}
        count={count}
        shown={notices.length}
      />

      <NoticeList notices={notices} />
    </div>
  )
}

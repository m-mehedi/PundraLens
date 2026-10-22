import { redirect } from "next/navigation"
import { headers } from "next/headers"
import { auth } from "@/lib/auth"
import {
  listCategories,
  listDepartments,
  listNotices,
} from "@/lib/backend-server"
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

  const [{ notices, count }, departments, categories] = await Promise.all([
    listNotices({
      status: status as "published" | "draft" | "archived" | "all",
      category,
      department,
      search_query: search,
      limit: 100,
    }),
    listDepartments(),
    listCategories(),
  ])

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Notices</h1>
        <p className="mt-1 text-muted-foreground">
          {count} published {count === 1 ? "notice" : "notices"} from Pundra
          University.
        </p>
      </div>

      <NoticeFilters departments={departments} categories={categories} />

      <NoticeList notices={notices} />
    </div>
  )
}

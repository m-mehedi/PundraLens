import { redirect } from "next/navigation"
import { headers } from "next/headers"
import { auth } from "@/lib/auth"
import { UserDataTableClient } from "@/components/dashboard/user-data-table-client"
import { revokeUser, bulkRevokeUsers } from "@/lib/user-actions"
import { User02Icon } from "@hugeicons/core-free-icons"

export default async function ManageStaffsPage() {
  const session = await auth.api.getSession({
    headers: await headers(),
  })

  if (!session) {
    redirect("/login")
  }

  const userRole = (session.user as { role?: string }).role
  if (userRole !== "admin") {
    redirect("/unauthorized")
  }

  const { users } = await auth.api.listUsers({
    headers: await headers(),
    query: {
      filterField: "role",
      filterValue: "staff",
      filterOperator: "eq",
    },
  })

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Manage Staff</h1>
        <p className="mt-1 text-muted-foreground">
          View and manage staff members who can upload and manage notices.
        </p>
      </div>

      <UserDataTableClient
        users={users}
        actionType="revoke"
        emptyIcon={User02Icon}
        emptyTitle="No staff members found"
        emptyDescription="There are no staff members in the system yet."
        action={revokeUser}
        bulkAction={bulkRevokeUsers}
      />
    </div>
  )
}

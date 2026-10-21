import { redirect } from "next/navigation"
import { headers } from "next/headers"
import { auth } from "@/lib/auth"
import { UserDataTableClient } from "@/components/dashboard/user-data-table-client"
import { revokeUser, bulkRevokeUsers } from "@/lib/user-actions"
import { User02Icon } from "@hugeicons/core-free-icons"

export default async function ManageStudentsPage() {
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
      filterValue: "student",
      filterOperator: "eq",
    },
  })

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Manage Students</h1>
        <p className="text-muted-foreground mt-1">
          View and manage student accounts.
        </p>
      </div>

      <UserDataTableClient
        users={users}
        actionType="revoke"
        emptyIcon={User02Icon}
        emptyTitle="No students found"
        emptyDescription="There are no students in the system yet."
        action={revokeUser}
        bulkAction={bulkRevokeUsers}
      />
    </div>
  )
}

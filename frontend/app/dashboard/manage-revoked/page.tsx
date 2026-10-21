import { redirect } from "next/navigation"
import { headers } from "next/headers"
import { auth } from "@/lib/auth"
import { UserDataTableClient } from "@/components/dashboard/user-data-table-client"
import { restoreUser, bulkRestoreUsers } from "@/lib/user-actions"
import { User02Icon } from "@hugeicons/core-free-icons"

export default async function ManageRevokedPage() {
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
      filterValue: "revoked",
      filterOperator: "eq",
    },
  })

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Manage Revoked Users</h1>
        <p className="text-muted-foreground mt-1">
          View and restore users who have been revoked.
        </p>
      </div>

      <UserDataTableClient
        users={users}
        actionType="restore"
        emptyIcon={User02Icon}
        emptyTitle="No revoked users found"
        emptyDescription="There are no revoked users in the system."
        action={restoreUser}
        bulkAction={bulkRestoreUsers}
      />
    </div>
  )
}

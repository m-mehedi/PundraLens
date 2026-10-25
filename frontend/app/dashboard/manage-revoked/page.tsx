import { headers } from "next/headers"
import { auth } from "@/lib/auth"
import { requireAdmin } from "@/lib/auth-guard"
import { UserDataTable } from "@/components/dashboard/user-data-table"
import { restoreUser, bulkRestoreUsers } from "@/lib/user-actions"
import { User02Icon } from "@hugeicons/core-free-icons"

export default async function ManageRevokedPage() {
  await requireAdmin()

  const { users } = await auth.api.listUsers({
    headers: await headers(),
    query: {
      filterField: "role",
      filterValue: "revoked",
      filterOperator: "eq",
    },
  })

  return (
    <UserDataTable
      users={users}
      actionType="restore"
      rowLabel="accounts"
      rowLabelSingular="account"
      emptyIcon={User02Icon}
      emptyTitle="No revoked accounts"
      emptyDescription="Revoked students and staff land here so you can restore their access."
      action={restoreUser}
      bulkAction={bulkRestoreUsers}
      extraActions={["resetPassword"]}
    />
  )
}

import { headers } from "next/headers"
import { auth } from "@/lib/auth"
import { requireAdmin } from "@/lib/auth-guard"
import { UserDataTable } from "@/components/dashboard/user-data-table"
import { StaffForm } from "@/components/dashboard/staff-form"
import { revokeUser, bulkRevokeUsers } from "@/lib/user-actions"
import { User02Icon } from "@hugeicons/core-free-icons"

export default async function ManageStaffsPage() {
  await requireAdmin()

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
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold">Staff</h2>
          <p className="text-sm text-muted-foreground">
            Staff can upload and publish notices. Create their account here and
            share the temporary password.
          </p>
        </div>
        <StaffForm />
      </div>

      <UserDataTable
        users={users}
        actionType="revoke"
        rowLabel="staff members"
        rowLabelSingular="staff member"
        emptyIcon={User02Icon}
        emptyTitle="No staff members yet"
        emptyDescription="Add a staff member above to give someone access to the notice workflow."
        action={revokeUser}
        bulkAction={bulkRevokeUsers}
        extraActions={["changeRole", "resetPassword"]}
      />
    </div>
  )
}

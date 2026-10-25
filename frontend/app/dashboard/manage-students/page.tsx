import { headers } from "next/headers"
import { auth } from "@/lib/auth"
import { requireRole } from "@/lib/auth-guard"
import { UserDataTable } from "@/components/dashboard/user-data-table"
import { revokeUser, bulkRevokeUsers } from "@/lib/user-actions"
import { User02Icon } from "@hugeicons/core-free-icons"

export default async function ManageStudentsPage() {
  // Staff review the student roster; only admins may change roles.
  const { role } = await requireRole("staff")

  const { users } = await auth.api.listUsers({
    headers: await headers(),
    query: {
      filterField: "role",
      filterValue: "student",
      filterOperator: "eq",
    },
  })

  return (
    <UserDataTable
      users={users}
      viewerRole={role}
      actionType="revoke"
      rowLabel="students"
      rowLabelSingular="student"
      emptyIcon={User02Icon}
      emptyTitle="No students yet"
      emptyDescription="Students appear here once they sign up with their student ID."
      action={revokeUser}
      bulkAction={bulkRevokeUsers}
      extraActions={["changeRole", "resetPassword"]}
    />
  )
}

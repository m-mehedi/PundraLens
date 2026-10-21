"use client"

import { useState, useMemo, useCallback } from "react"
import { Input } from "@/components/ui/input"
import { UserDataTable, UserDataTableProps } from "./user-data-table"

interface UserDataTableClientProps extends Omit<UserDataTableProps, "users"> {
  users: { id: string; name: string; email: string; role?: string }[]
  bulkAction: (formData: FormData) => Promise<void> | void
}

export function UserDataTableClient({
  users,
  actionType,
  emptyIcon,
  emptyTitle,
  emptyDescription,
  action,
  bulkAction,
}: UserDataTableClientProps) {
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  const filteredUsers = useMemo(() => {
    if (!searchQuery.trim()) return users
    const query = searchQuery.toLowerCase().trim()
    return users.filter(
      (user) =>
        user.id.toLowerCase().includes(query) ||
        (user.name && user.name.toLowerCase().includes(query))
    )
  }, [users, searchQuery])

  const toggleSelect = useCallback((userId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(userId)) {
        next.delete(userId)
      } else {
        next.add(userId)
      }
      return next
    })
  }, [])

  const toggleSelectAll = useCallback(
    (checkAll: boolean) => {
      if (checkAll) {
        setSelectedIds(new Set(filteredUsers.map((u) => u.id)))
      } else {
        setSelectedIds(new Set())
      }
    },
    [filteredUsers]
  )

  const allFilteredSelected =
    filteredUsers.length > 0 &&
    filteredUsers.every((u) => selectedIds.has(u.id))

  const someFilteredSelected =
    filteredUsers.some((u) => selectedIds.has(u.id)) && !allFilteredSelected

  const selectedCount = selectedIds.size

  return (
    <div className="flex flex-col gap-3">
      <Input
        type="search"
        placeholder="Search by ID or name…"
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
      />

      <UserDataTable
        users={filteredUsers}
        actionType={actionType}
        emptyIcon={emptyIcon}
        emptyTitle={emptyTitle}
        emptyDescription={emptyDescription}
        action={action}
        selectedIds={selectedIds}
        onToggleSelect={toggleSelect}
        onSelectAll={toggleSelectAll}
        allSelected={allFilteredSelected}
        someSelected={someFilteredSelected}
        selectedCount={selectedCount}
        bulkAction={bulkAction}
        actionLabel={actionType === "revoke" ? "Revoke access" : "Restore"}
      />
    </div>
  )
}

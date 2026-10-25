"use client"

import * as React from "react"
import { cn } from "cn"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  AlertCircleIcon,
  Search01Icon,
  UserCheck01Icon,
  UserRemove01Icon,
  UserSwitchIcon,
  Key01Icon,
} from "@hugeicons/core-free-icons"

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardFooter } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  DropdownMenuGroup,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Spinner } from "@/components/ui/spinner"
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { runServerAction } from "@/lib/server-action-feedback"
import { getDisplayId } from "@/lib/user-id"
import { changeUserRole, resetUserPassword } from "@/lib/user-actions"
import { INITIAL_ACTION_STATE } from "@/lib/action-state"
import type { Role } from "@/lib/roles"

import { RowActionsMenu } from "./row-actions-menu"

export type ActionType = "revoke" | "restore"

/** Extra management actions an administrator can take on a row. */
export type UserExtraAction = "changeRole" | "resetPassword"

export interface UserRecord {
  id: string
  name: string
  email: string
  role?: string
}

export interface UserDataTableProps {
  users: UserRecord[]
  /**
   * Role of the person looking at the table. Admin-only actions (changing a
   * role) are hidden from staff. Defaults to `admin` so admin-only pages that
   * do not pass it keep the full action set.
   */
  viewerRole?: Role
  actionType: ActionType
  /** Plural noun for the people in this table, e.g. "students". */
  rowLabel: string
  /** The same noun for one person, e.g. "student". */
  rowLabelSingular: string
  emptyIcon: readonly (readonly [
    string,
    { readonly [key: string]: string | number },
  ])[]
  emptyTitle: string
  emptyDescription: string
  action: (formData: FormData) => Promise<void> | void
  bulkAction: (formData: FormData) => Promise<void> | void
  /** Optional per-row management actions. */
  extraActions?: UserExtraAction[]
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return "?"
  return parts
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("")
}

const COPY: Record<
  ActionType,
  { verb: string; past: string; failure: string; label: string }
> = {
  revoke: {
    verb: "revoke access",
    past: "revoked",
    failure: "Could not revoke access. Try again.",
    label: "Revoke access",
  },
  restore: {
    verb: "restore access",
    past: "restored",
    failure: "Could not restore access. Try again.",
    label: "Restore access",
  },
}

export function UserDataTable({
  users,
  viewerRole = "admin",
  actionType,
  rowLabel,
  rowLabelSingular,
  emptyIcon,
  emptyTitle,
  emptyDescription,
  action,
  bulkAction,
  extraActions = [],
}: UserDataTableProps) {
  const [searchQuery, setSearchQuery] = React.useState("")
  const [selectedIds, setSelectedIds] = React.useState<Set<string>>(new Set())
  const [pendingId, setPendingId] = React.useState<string | null>(null)
  const [target, setTarget] = React.useState<UserRecord | null>(null)
  const [bulkOpen, setBulkOpen] = React.useState(false)
  const [bulkPending, setBulkPending] = React.useState(false)
  const [roleTarget, setRoleTarget] = React.useState<UserRecord | null>(null)
  const [roleValue, setRoleValue] = React.useState<string>("student")
  const [passwordTarget, setPasswordTarget] = React.useState<UserRecord | null>(
    null
  )
  const [newPassword, setNewPassword] = React.useState("")
  const [extraPending, setExtraPending] = React.useState(false)
  const [extraError, setExtraError] = React.useState<string | null>(null)
  const [, startTransition] = React.useTransition()

  const copy = COPY[actionType]
  const query = searchQuery.trim()
  const counted = (count: number) => (count === 1 ? rowLabelSingular : rowLabel)
  const bulkSubject = selectedIds.size === 1 ? "They" : "Each of them"

  const filteredUsers = React.useMemo(() => {
    if (!query) return users
    const needle = query.toLowerCase()
    return users.filter(
      (user) =>
        getDisplayId(user.email).toLowerCase().includes(needle) ||
        user.id.toLowerCase().includes(needle) ||
        (user.name && user.name.toLowerCase().includes(needle))
    )
  }, [users, query])

  const toggleSelect = React.useCallback((userId: string) => {
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

  const toggleSelectAll = React.useCallback(
    (checkAll: boolean) => {
      setSelectedIds(
        checkAll ? new Set(filteredUsers.map((user) => user.id)) : new Set()
      )
    },
    [filteredUsers]
  )

  const allFilteredSelected =
    filteredUsers.length > 0 &&
    filteredUsers.every((u) => selectedIds.has(u.id))
  const someFilteredSelected =
    filteredUsers.some((u) => selectedIds.has(u.id)) && !allFilteredSelected
  const selectedCount = selectedIds.size

  const handleRowAction = (user: UserRecord) => {
    const formData = new FormData()
    formData.set("userId", user.id)

    setPendingId(user.id)
    startTransition(async () => {
      try {
        const succeeded = await runServerAction(action, formData, {
          success: `Access ${copy.past} for ${getDisplayId(user.email)}`,
          error: copy.failure,
        })
        if (succeeded) setTarget(null)
      } finally {
        setPendingId(null)
      }
    })
  }

  const handleBulkAction = () => {
    const count = selectedIds.size
    const formData = new FormData()
    for (const id of selectedIds) {
      formData.append("userIds", id)
    }

    setBulkPending(true)
    startTransition(async () => {
      try {
        const succeeded = await runServerAction(bulkAction, formData, {
          success: `${count} ${counted(count)} ${copy.past}`,
          error: copy.failure,
        })
        if (succeeded) {
          setBulkOpen(false)
          setSelectedIds(new Set())
        }
      } finally {
        setBulkPending(false)
      }
    })
  }

  const openRoleDialog = (user: UserRecord) => {
    setRoleTarget(user)
    setRoleValue(user.role === "staff" ? "staff" : "student")
    setExtraError(null)
  }

  const submitRoleChange = () => {
    if (!roleTarget) return
    const formData = new FormData()
    formData.set("userId", roleTarget.id)
    formData.set("role", roleValue)

    setExtraPending(true)
    startTransition(async () => {
      try {
        const state = await changeUserRole(INITIAL_ACTION_STATE, formData)
        if (state.error) {
          setExtraError(state.error)
          return
        }
        setRoleTarget(null)
      } catch (error) {
        setExtraError(
          error instanceof Error ? error.message : "Could not change the role."
        )
      } finally {
        setExtraPending(false)
      }
    })
  }

  const submitPasswordReset = () => {
    if (!passwordTarget) return
    const formData = new FormData()
    formData.set("userId", passwordTarget.id)
    formData.set("newPassword", newPassword)

    setExtraPending(true)
    startTransition(async () => {
      try {
        const state = await resetUserPassword(INITIAL_ACTION_STATE, formData)
        if (state.error) {
          setExtraError(state.error)
          return
        }
        setPasswordTarget(null)
        setNewPassword("")
      } catch (error) {
        setExtraError(
          error instanceof Error
            ? error.message
            : "Could not reset the password."
        )
      } finally {
        setExtraPending(false)
      }
    })
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-center">
        <InputGroup className="md:max-w-xs">
          <InputGroupAddon>
            <HugeiconsIcon icon={Search01Icon} strokeWidth={2} />
          </InputGroupAddon>
          <InputGroupInput
            type="search"
            placeholder="Search by ID or name…"
            aria-label={`Search ${rowLabel}`}
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
          />
        </InputGroup>
        {query ? (
          <p className="text-sm text-muted-foreground">
            Showing {filteredUsers.length} of {users.length} {rowLabel}
          </p>
        ) : null}
      </div>

      <Card className="gap-0 py-0">
        <CardContent className="px-0">
          {filteredUsers.length === 0 ? (
            <Empty className="m-6 border border-dashed">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <HugeiconsIcon icon={emptyIcon} />
                </EmptyMedia>
                <EmptyTitle>
                  {query ? `No ${rowLabel} match “${query}”` : emptyTitle}
                </EmptyTitle>
                <EmptyDescription>
                  {query
                    ? "Clear the search to see everyone on this list."
                    : emptyDescription}
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            <Table>
              <TableCaption className="sr-only">
                {rowLabel} with their ID and the action you can take on them
              </TableCaption>
              <TableHeader>
                <TableRow className="h-12">
                  <TableHead className="w-10 hover:bg-transparent">
                    <Checkbox
                      checked={allFilteredSelected}
                      onCheckedChange={toggleSelectAll}
                      aria-label={`Select all ${rowLabel}`}
                      indeterminate={someFilteredSelected}
                    />
                  </TableHead>
                  <TableHead className="hover:bg-transparent">User</TableHead>
                  <TableHead className="w-[180px] hover:bg-transparent">
                    ID
                  </TableHead>
                  <TableHead className="w-[60px] text-right hover:bg-transparent">
                    <span className="sr-only">Actions</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredUsers.map((user) => {
                  const isSelected = selectedIds.has(user.id)
                  const displayId = getDisplayId(user.email)

                  return (
                    <TableRow
                      key={user.id}
                      data-state={isSelected ? "selected" : undefined}
                      className="h-14"
                    >
                      <TableCell className="w-10">
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={() => toggleSelect(user.id)}
                          aria-label={`Select ${user.name}`}
                        />
                      </TableCell>
                      <TableCell className="px-6">
                        <div className="flex items-center gap-3">
                          <Avatar size="sm">
                            <AvatarFallback>
                              {getInitials(user.name)}
                            </AvatarFallback>
                          </Avatar>
                          <p className="truncate font-medium">{user.name}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span
                          className={cn(
                            "text-sm",
                            displayId.includes("@")
                              ? "text-muted-foreground"
                              : "font-mono"
                          )}
                        >
                          {displayId}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <RowActionsMenu
                          label={`Actions for ${user.name}`}
                          pending={pendingId === user.id}
                        >
                          <DropdownMenuGroup>
                            <DropdownMenuItem
                              variant={
                                actionType === "revoke"
                                  ? "destructive"
                                  : "default"
                              }
                              onClick={() => setTarget(user)}
                            >
                              <HugeiconsIcon
                                icon={
                                  actionType === "revoke"
                                    ? UserRemove01Icon
                                    : UserCheck01Icon
                                }
                                strokeWidth={2}
                              />
                              {copy.label}
                            </DropdownMenuItem>

                            {extraActions.includes("changeRole") &&
                            viewerRole === "admin" ? (
                              <DropdownMenuItem
                                onClick={() => openRoleDialog(user)}
                              >
                                <HugeiconsIcon
                                  icon={UserSwitchIcon}
                                  strokeWidth={2}
                                />
                                Change role
                              </DropdownMenuItem>
                            ) : null}

                            {extraActions.includes("resetPassword") ? (
                              <DropdownMenuItem
                                onClick={() => {
                                  setPasswordTarget(user)
                                  setNewPassword("")
                                  setExtraError(null)
                                }}
                              >
                                <HugeiconsIcon
                                  icon={Key01Icon}
                                  strokeWidth={2}
                                />
                                Reset password
                              </DropdownMenuItem>
                            ) : null}
                          </DropdownMenuGroup>
                        </RowActionsMenu>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>

        <CardFooter className="flex items-center justify-between gap-4 border-t px-6 py-3">
          <p className="truncate text-sm text-muted-foreground">
            {selectedCount > 0
              ? `${selectedCount} of ${users.length} selected`
              : `Select ${rowLabel} to ${copy.verb} in bulk`}
          </p>
          <Button
            variant="outline"
            size="sm"
            disabled={selectedCount === 0 || bulkPending}
            onClick={() => setBulkOpen(true)}
            data-icon={bulkPending ? undefined : "inline-start"}
          >
            {bulkPending ? <Spinner /> : null}
            {copy.label}
          </Button>
        </CardFooter>
      </Card>

      <AlertDialog
        open={target !== null}
        onOpenChange={(open) => {
          if (!open) setTarget(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogMedia>
              <HugeiconsIcon
                icon={AlertCircleIcon}
                strokeWidth={2}
                className={cn(
                  "size-5",
                  actionType === "revoke" && "text-destructive"
                )}
              />
            </AlertDialogMedia>
            <AlertDialogTitle>{copy.label}</AlertDialogTitle>
            <AlertDialogDescription>
              {actionType === "revoke" ? (
                <>
                  {target?.name} will be signed out and locked out of the portal
                  and the notice feed. You can restore them later from Manage
                  Revoked.
                </>
              ) : (
                <>
                  {target?.name} will get their account back and be able to sign
                  in again.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant={actionType === "revoke" ? "destructive" : "default"}
              size="sm"
              disabled={pendingId !== null}
              onClick={() => {
                if (target) handleRowAction(target)
              }}
              data-icon={pendingId === null ? "inline-start" : undefined}
            >
              {pendingId === null ? (
                <HugeiconsIcon
                  icon={
                    actionType === "revoke" ? UserRemove01Icon : UserCheck01Icon
                  }
                  strokeWidth={2}
                />
              ) : (
                <Spinner />
              )}
              {copy.label}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={bulkOpen} onOpenChange={setBulkOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogMedia>
              <HugeiconsIcon
                icon={AlertCircleIcon}
                strokeWidth={2}
                className={cn(
                  "size-5",
                  actionType === "revoke" && "text-destructive"
                )}
              />
            </AlertDialogMedia>
            <AlertDialogTitle>
              {copy.label} for {selectedCount} {counted(selectedCount)}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {actionType === "revoke"
                ? `${bulkSubject} will be signed out and locked out of the portal. You can restore them later from Manage Revoked.`
                : `${bulkSubject} will get their account back and be able to sign in again.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant={actionType === "revoke" ? "destructive" : "default"}
              size="sm"
              disabled={bulkPending}
              onClick={handleBulkAction}
              data-icon={bulkPending ? undefined : "inline-start"}
            >
              {bulkPending ? (
                <Spinner />
              ) : (
                <HugeiconsIcon
                  icon={
                    actionType === "revoke" ? UserRemove01Icon : UserCheck01Icon
                  }
                  strokeWidth={2}
                />
              )}
              {copy.label}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog
        open={roleTarget !== null}
        onOpenChange={(open) => {
          if (!open) {
            setRoleTarget(null)
            setExtraError(null)
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change role</DialogTitle>
            <DialogDescription>
              Move {roleTarget?.name} between the student and staff roles.
              Administrator accounts are created with the admin script.
            </DialogDescription>
          </DialogHeader>

          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="role-select">Role</FieldLabel>
              <Select
                value={roleValue}
                onValueChange={(value) => {
                  if (value) setRoleValue(value)
                }}
              >
                <SelectTrigger id="role-select">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="student">Student</SelectItem>
                  <SelectItem value="staff">Staff</SelectItem>
                </SelectContent>
              </Select>
            </Field>

            {extraError ? (
              <p className="text-sm text-destructive">{extraError}</p>
            ) : null}
          </FieldGroup>

          <DialogFooter>
            <DialogClose
              render={
                <Button
                  variant="outline"
                  onClick={() => {
                    setRoleTarget(null)
                    setExtraError(null)
                  }}
                />
              }
            >
              Cancel
            </DialogClose>
            <Button
              onClick={submitRoleChange}
              disabled={extraPending}
              data-icon={extraPending ? undefined : "inline-start"}
            >
              {extraPending ? <Spinner /> : null}
              Save role
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={passwordTarget !== null}
        onOpenChange={(open) => {
          if (!open) {
            setPasswordTarget(null)
            setNewPassword("")
            setExtraError(null)
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reset password</DialogTitle>
            <DialogDescription>
              Issue a new temporary password for {passwordTarget?.name}. Share
              it with them — they can change it from their profile page.
            </DialogDescription>
          </DialogHeader>

          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="new-password">New password</FieldLabel>
              <Input
                id="new-password"
                type="text"
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
                placeholder="At least 8 characters"
                minLength={8}
              />
            </Field>

            {extraError ? (
              <p className="text-sm text-destructive">{extraError}</p>
            ) : null}
          </FieldGroup>

          <DialogFooter>
            <DialogClose
              render={
                <Button
                  variant="outline"
                  onClick={() => {
                    setPasswordTarget(null)
                    setNewPassword("")
                    setExtraError(null)
                  }}
                />
              }
            >
              Cancel
            </DialogClose>
            <Button
              onClick={submitPasswordReset}
              disabled={extraPending || newPassword.length < 8}
              data-icon={extraPending ? undefined : "inline-start"}
            >
              {extraPending ? <Spinner /> : null}
              Reset password
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

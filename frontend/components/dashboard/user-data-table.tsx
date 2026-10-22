import { Card, CardContent, CardFooter } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
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
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  AlertCircleIcon,
  CheckmarkCircle01Icon,
  CircleMinusIcon,
} from "@hugeicons/core-free-icons"
import { getDisplayId } from "@/lib/user-id"

export type ActionType = "revoke" | "restore"

export interface UserDataTableProps {
  users: { id: string; name: string; email: string; role?: string }[]
  actionType: ActionType
  emptyIcon: readonly (readonly [
    string,
    { readonly [key: string]: string | number },
  ])[]
  emptyTitle: string
  emptyDescription: string
  action: (formData: FormData) => Promise<void> | void
  selectedIds?: Set<string>
  onToggleSelect?: (userId: string) => void
  onSelectAll?: (checkAll: boolean) => void
  allSelected?: boolean
  someSelected?: boolean
  selectedCount?: number
  bulkAction?: (formData: FormData) => Promise<void> | void
  actionLabel?: string
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return "?"
  return parts
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("")
}

const bulkVerb = (actionType: ActionType) =>
  actionType === "revoke" ? "revoke access" : "restore access"

export function UserDataTable({
  users,
  actionType,
  emptyIcon,
  emptyTitle,
  emptyDescription,
  action,
  selectedIds,
  onToggleSelect,
  onSelectAll,
  allSelected,
  someSelected,
  selectedCount,
  bulkAction,
  actionLabel,
}: UserDataTableProps) {
  const hasSelection = onToggleSelect != null && onSelectAll != null
  const verb = bulkVerb(actionType)

  return (
    <Card className="gap-0 py-0">
      <CardContent className="px-0">
        {users.length === 0 ? (
          <Empty className="m-6 border border-dashed">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <HugeiconsIcon icon={emptyIcon} />
              </EmptyMedia>
              <EmptyTitle>{emptyTitle}</EmptyTitle>
              <EmptyDescription>{emptyDescription}</EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="h-12">
                {hasSelection && (
                  <TableHead className="w-10 hover:bg-transparent">
                    <Checkbox
                      checked={allSelected ?? false}
                      onCheckedChange={onSelectAll}
                      aria-label="Select all"
                      indeterminate={someSelected ?? false}
                    />
                  </TableHead>
                )}
                <TableHead className="hover:bg-transparent">User</TableHead>
                <TableHead className="w-[160px] hover:bg-transparent">
                  ID
                </TableHead>
                <TableHead className="w-[160px] text-center hover:bg-transparent">
                  Actions
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((user) => {
                const isSelected = selectedIds?.has(user.id) ?? false
                return (
                  <TableRow
                    key={user.id}
                    data-state={isSelected ? "selected" : undefined}
                    className="h-14"
                  >
                    {hasSelection && (
                      <TableCell className="w-10">
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={() => onToggleSelect?.(user.id)}
                          aria-label={`Select ${user.name}`}
                        />
                      </TableCell>
                    )}
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
                      <span className="font-mono text-sm">
                        {getDisplayId(user.email)}
                      </span>
                    </TableCell>
                    <TableCell className="text-center">
                      {actionType === "revoke" ? (
                        <AlertDialog>
                          <AlertDialogTrigger
                            render={
                              <Button
                                variant="outline"
                                size="sm"
                                className="text-destructive"
                                data-icon="inline-start"
                              >
                                <HugeiconsIcon
                                  icon={CircleMinusIcon}
                                  strokeWidth={2}
                                />
                                Revoke
                              </Button>
                            }
                          />
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogMedia>
                                <HugeiconsIcon
                                  icon={AlertCircleIcon}
                                  strokeWidth={2}
                                  className="size-5 text-destructive"
                                />
                              </AlertDialogMedia>
                              <AlertDialogTitle>Revoke access</AlertDialogTitle>
                              <AlertDialogDescription>
                                Are you sure you want to revoke access for{" "}
                                {user.name || user.email}? This action may be
                                irreversible.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <form action={action}>
                                <input
                                  type="hidden"
                                  name="userId"
                                  value={user.id}
                                />
                                <AlertDialogAction
                                  type="submit"
                                  variant="destructive"
                                  size="sm"
                                >
                                  Revoke access
                                </AlertDialogAction>
                              </form>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      ) : (
                        <form action={action}>
                          <input type="hidden" name="userId" value={user.id} />
                          <Button
                            type="submit"
                            size="sm"
                            data-icon="inline-start"
                          >
                            <HugeiconsIcon
                              icon={CheckmarkCircle01Icon}
                              strokeWidth={2}
                            />
                            Restore
                          </Button>
                        </form>
                      )}
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        )}
      </CardContent>

      {hasSelection && selectedCount !== undefined && selectedCount > 0 && (
        <CardFooter className="flex items-center justify-between border-t px-6 py-3">
          <span className="text-sm text-muted-foreground">
            {selectedCount} of {users.length} selected
          </span>
          {bulkAction && (
            <AlertDialog>
              <AlertDialogTrigger
                render={
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-destructive"
                    data-icon="inline-start"
                  >
                    <HugeiconsIcon icon={AlertCircleIcon} strokeWidth={2} />
                    {actionLabel ?? verb}
                  </Button>
                }
              />
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogMedia>
                    <HugeiconsIcon
                      icon={AlertCircleIcon}
                      strokeWidth={2}
                      className="size-5 text-destructive"
                    />
                  </AlertDialogMedia>
                  <AlertDialogTitle>{actionLabel ?? verb}</AlertDialogTitle>
                  <AlertDialogDescription>
                    Are you sure you want to{" "}
                    {actionLabel?.toLowerCase() || verb} for {selectedCount}{" "}
                    selected user
                    {selectedCount !== 1 ? "s" : ""}? This action may be
                    irreversible.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <form action={bulkAction}>
                    {Array.from(selectedIds || []).map((id) => (
                      <input key={id} type="hidden" name="userIds" value={id} />
                    ))}
                    <AlertDialogAction
                      type="submit"
                      variant="destructive"
                      size="sm"
                    >
                      {actionLabel ?? verb}
                    </AlertDialogAction>
                  </form>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </CardFooter>
      )}
    </Card>
  )
}

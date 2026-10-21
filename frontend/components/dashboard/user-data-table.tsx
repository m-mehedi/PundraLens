import {
  Card,
  CardContent,
} from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button, buttonVariants } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
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

export type ActionType = "revoke" | "restore"

export interface UserDataTableProps {
  users: { id: string; name: string; email: string; role?: string }[]
  title?: string
  actionType: ActionType
  emptyIcon: readonly (readonly [string, { readonly [key: string]: string | number }])[]
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
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase()
}

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

  return (
    <Card className="gap-0 overflow-hidden py-0">
      <CardContent className="p-0">
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
          <div className="overflow-x-auto">
            {hasSelection && selectedCount !== undefined && selectedCount > 0 && (
              <div className="flex items-center justify-between px-6 py-3 border-b bg-muted/40">
                <span className="text-sm text-muted-foreground">
                  {selectedCount} user{selectedCount !== 1 ? "s" : ""} selected
                </span>
                {bulkAction && (
                  <AlertDialog>
                    <AlertDialogTrigger
                      className={buttonVariants({
                        variant: "outline",
                        size: "sm",
                        className: "text-destructive hover:bg-destructive/10 hover:text-destructive",
                      })}
                    >
                      {actionLabel || "Revoke access"}
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>
                          {actionLabel || "Revoke access"}
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                          Are you sure you want to{" "}
                          {actionLabel?.toLowerCase() || "revoke access"} for{" "}
                          {selectedCount} selected user
                          {selectedCount !== 1 ? "s" : ""}? This action may be
                          irreversible.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <form action={bulkAction}>
                          {Array.from(selectedIds || []).map((id) => (
                            <input
                              key={id}
                              type="hidden"
                              name="userIds"
                              value={id}
                            />
                          ))}
                          <AlertDialogAction
                            type="submit"
                            variant="destructive"
                            size="sm"
                          >
                            {actionLabel || "Revoke access"}
                          </AlertDialogAction>
                        </form>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                )}
              </div>
            )}
            <Table>
              <TableHeader>
                <TableRow className="h-10">
                  {hasSelection && (
                    <TableHead className="w-[56px] hover:bg-transparent">
                      <Checkbox
                        checked={allSelected ?? false}
                        onCheckedChange={onSelectAll}
                        aria-label="Select all"
                        aria-checked={someSelected ? "mixed" : (allSelected ?? false)}
                      />
                    </TableHead>
                  )}
                  <TableHead className="hover:bg-transparent">Name</TableHead>
                  <TableHead className="w-[140px] text-center hover:bg-transparent">
                    Actions
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((user) => (
                  <TableRow key={user.id} className="h-[56px]">
                    {hasSelection && (
                      <TableCell className="w-[56px]">
                        <Checkbox
                          checked={selectedIds?.has(user.id) ?? false}
                          onCheckedChange={() => onToggleSelect(user.id)}
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
                        <p className="font-medium min-w-0 truncate">
                          {user.name}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      {actionType === "revoke" ? (
                        <AlertDialog>
                          <AlertDialogTrigger
                            className={buttonVariants({
                              variant: "destructive",
                              size: "sm",
                            })}
                          >
                            Revoke access
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
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
                          <Button type="submit" size="sm">
                            Restore
                          </Button>
                        </form>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

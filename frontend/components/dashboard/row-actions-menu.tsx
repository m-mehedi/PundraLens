"use client"

import * as React from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import { MoreVerticalIcon } from "@hugeicons/core-free-icons"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Spinner } from "@/components/ui/spinner"

export interface RowActionsMenuProps {
  /** Accessible name of the trigger, e.g. "Actions for the exam notice". */
  label: string
  /** The menu items. Compose them with the dropdown-menu primitives. */
  children: React.ReactNode
  /** Shows a spinner and locks the trigger while the row's action runs. */
  pending?: boolean
}

/**
 * The quiet "⋯" that opens a row's actions. Every management table ends its
 * rows with one of these, so the eye travels down the data columns instead of
 * across a wall of buttons.
 */
export function RowActionsMenu({
  label,
  children,
  pending = false,
}: RowActionsMenuProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={label}
            disabled={pending}
            className="text-muted-foreground"
          />
        }
      >
        {pending ? (
          <Spinner />
        ) : (
          <HugeiconsIcon icon={MoreVerticalIcon} strokeWidth={2} />
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        {children}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

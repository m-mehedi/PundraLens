"use client"

import * as React from "react"
import { useActionState } from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import { UserAdd01Icon } from "@hugeicons/core-free-icons"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Spinner } from "@/components/ui/spinner"
import { createStaffUser } from "@/lib/user-actions"
import { INITIAL_ACTION_STATE } from "@/lib/action-state"

export function StaffForm() {
  const [state, formAction, pending] = useActionState(
    createStaffUser,
    INITIAL_ACTION_STATE
  )
  const [open, setOpen] = React.useState(false)

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (!next) {
          // Reset the form so a stale error does not greet the next admin.
          const form = document.getElementById(
            "staff-form"
          ) as HTMLFormElement | null
          form?.reset()
        }
      }}
    >
      <DialogTrigger
        render={
          <Button data-icon="inline-start">
            <HugeiconsIcon icon={UserAdd01Icon} strokeWidth={2} />
            Add staff member
          </Button>
        }
      />
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Add a staff member</DialogTitle>
          <DialogDescription>
            Staff accounts are created here — there is no public staff sign-up.
            Share the temporary password with them; they can change it from
            their profile page.
          </DialogDescription>
        </DialogHeader>

        <form id="staff-form" action={formAction}>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="staff-name">Full name</FieldLabel>
              <Input
                id="staff-name"
                name="name"
                type="text"
                placeholder="e.g. Mohammad Karim"
                required
              />
            </Field>

            <Field>
              <FieldLabel htmlFor="staff-email">Email address</FieldLabel>
              <Input
                id="staff-email"
                name="email"
                type="email"
                placeholder="karim@pundra.edu.bd"
                required
              />
              <FieldDescription>
                This is the address they sign in with.
              </FieldDescription>
            </Field>

            <Field>
              <FieldLabel htmlFor="staff-password">
                Temporary password
              </FieldLabel>
              <Input
                id="staff-password"
                name="password"
                type="text"
                placeholder="At least 8 characters"
                required
                minLength={8}
              />
            </Field>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="staff-employee-id">Employee ID</FieldLabel>
                <Input
                  id="staff-employee-id"
                  name="employeeId"
                  type="text"
                  placeholder="e.g. PU-1042"
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="staff-designation">Designation</FieldLabel>
                <Input
                  id="staff-designation"
                  name="designation"
                  type="text"
                  placeholder="e.g. Assistant Professor"
                />
              </Field>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="staff-department">Department</FieldLabel>
                <Input
                  id="staff-department"
                  name="department"
                  type="text"
                  placeholder="e.g. Office of the Registrar"
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="staff-phone">Phone number</FieldLabel>
                <Input
                  id="staff-phone"
                  name="phone"
                  type="tel"
                  placeholder="+8801XXXXXXXXX"
                />
              </Field>
            </div>

            {state.error ? (
              <p className="text-sm text-destructive">{state.error}</p>
            ) : null}
            {state.success ? (
              <p className="text-sm text-muted-foreground">{state.success}</p>
            ) : null}
          </FieldGroup>
        </form>

        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>
            Cancel
          </DialogClose>
          <Button type="submit" form="staff-form" disabled={pending}>
            {pending ? <Spinner /> : null}
            {pending ? "Creating account…" : "Create account"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

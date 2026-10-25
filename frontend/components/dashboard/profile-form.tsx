"use client"

import * as React from "react"
import { useActionState } from "react"
import { useRouter } from "next/navigation"
import { HugeiconsIcon } from "@hugeicons/react"
import { Upload01Icon, UserCircleIcon } from "@hugeicons/core-free-icons"
import { toast } from "sonner"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Spinner } from "@/components/ui/spinner"
import { changePassword, updateProfile } from "@/lib/profile-actions"
import { INITIAL_ACTION_STATE } from "@/lib/action-state"
import {
  PROFILE_FIELD_META,
  PROFILE_FIELDS_BY_ROLE,
  type ProfileFieldKey,
} from "@/lib/profile-fields"
import { ROLE_LABELS, type Role } from "@/lib/roles"
import { DEPARTMENTS } from "@/components/signup-form/types"

export interface ProfileUser {
  id: string
  name: string
  email: string
  image: string | null
  role: Role
  phone: string | null
  department: string | null
  batch: string | null
  semester: string | null
  designation: string | null
  employeeId: string | null
  displayId: string
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return "?"
  return parts
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("")
}

export function ProfileForm({ user }: { user: ProfileUser }) {
  const router = useRouter()
  const [profileState, profileAction, profilePending] = useActionState(
    updateProfile,
    INITIAL_ACTION_STATE
  )
  const [passwordState, passwordAction, passwordPending] = useActionState(
    changePassword,
    INITIAL_ACTION_STATE
  )

  const [avatarUrl, setAvatarUrl] = React.useState(user.image)
  const [uploading, setUploading] = React.useState(false)
  const fileInputRef = React.useRef<HTMLInputElement>(null)

  const fields = PROFILE_FIELDS_BY_ROLE[user.role]
  const editable = fields.filter(
    (field) => PROFILE_FIELD_META[field].selfEditable && field !== "name"
  )

  const handleAvatarChange = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0]
    if (!file) return

    setUploading(true)
    try {
      const body = new FormData()
      body.set("file", file)
      const response = await fetch("/api/profile/avatar", {
        method: "POST",
        body,
      })
      const payload = (await response.json()) as {
        url?: string
        error?: string
      }
      if (!response.ok || !payload.url) {
        throw new Error(payload.error ?? "Upload failed.")
      }
      setAvatarUrl(payload.url)
      toast.success("Avatar updated")
      router.refresh()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Upload failed.")
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ""
    }
  }

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Profile</CardTitle>
          <CardDescription>
            Your name and photo appear next to the notices you publish and on
            your account menu.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-6">
          <div className="flex items-center gap-4">
            <Avatar className="size-16 rounded-2xl">
              <AvatarImage src={avatarUrl ?? undefined} alt={user.name} />
              <AvatarFallback className="rounded-2xl text-lg">
                {getInitials(user.name)}
              </AvatarFallback>
            </Avatar>
            <div className="flex flex-col gap-1">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="hidden"
                onChange={handleAvatarChange}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={uploading}
                onClick={() => fileInputRef.current?.click()}
                data-icon={uploading ? undefined : "inline-start"}
              >
                {uploading ? (
                  <Spinner />
                ) : (
                  <HugeiconsIcon icon={Upload01Icon} strokeWidth={2} />
                )}
                {uploading ? "Uploading…" : "Change photo"}
              </Button>
              <p className="text-xs text-muted-foreground">
                PNG, JPEG or WebP, up to 2 MB.
              </p>
            </div>
          </div>

          <form action={profileAction}>
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="profile-name">Full name</FieldLabel>
                <Input
                  id="profile-name"
                  name="name"
                  defaultValue={user.name}
                  required
                />
              </Field>

              <Field>
                <FieldLabel htmlFor="profile-role">Role</FieldLabel>
                <div className="flex items-center gap-2 rounded-lg border bg-muted/40 px-3 py-2 text-sm">
                  <HugeiconsIcon
                    icon={UserCircleIcon}
                    className="size-4 text-muted-foreground"
                  />
                  {ROLE_LABELS[user.role]}
                </div>
                <FieldDescription>
                  {user.role === "student"
                    ? "You sign in with your Student ID."
                    : "You sign in with your email address."}
                </FieldDescription>
              </Field>

              <Field>
                <FieldLabel htmlFor="profile-id">
                  {user.role === "student" ? "Student ID" : "Email"}
                </FieldLabel>
                <Input
                  id="profile-id"
                  value={user.displayId}
                  readOnly
                  className="bg-muted/40"
                />
              </Field>

              {editable.map((field) => (
                <ProfileField key={field} field={field} user={user} />
              ))}

              {profileState.error ? (
                <p className="text-sm text-destructive">{profileState.error}</p>
              ) : null}
              {profileState.success ? (
                <p className="text-sm text-muted-foreground">
                  {profileState.success}
                </p>
              ) : null}

              <Field>
                <Button
                  type="submit"
                  disabled={profilePending}
                  data-icon={profilePending ? undefined : "inline-start"}
                >
                  {profilePending ? <Spinner /> : null}
                  {profilePending ? "Saving…" : "Save profile"}
                </Button>
              </Field>
            </FieldGroup>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Password</CardTitle>
          <CardDescription>
            Change the password you use to sign in.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action={passwordAction}>
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="current-password">
                  Current password
                </FieldLabel>
                <Input
                  id="current-password"
                  name="currentPassword"
                  type="password"
                  autoComplete="current-password"
                  required
                />
              </Field>

              <Field>
                <FieldLabel htmlFor="new-password">New password</FieldLabel>
                <Input
                  id="new-password"
                  name="newPassword"
                  type="password"
                  autoComplete="new-password"
                  minLength={8}
                  required
                />
                <FieldDescription>
                  At least 8 characters. You will stay signed in on this device.
                </FieldDescription>
              </Field>

              <Field>
                <FieldLabel htmlFor="confirm-new-password">
                  Confirm new password
                </FieldLabel>
                <Input
                  id="confirm-new-password"
                  name="confirmPassword"
                  type="password"
                  autoComplete="new-password"
                  required
                />
              </Field>

              {passwordState.error ? (
                <p className="text-sm text-destructive">
                  {passwordState.error}
                </p>
              ) : null}
              {passwordState.success ? (
                <p className="text-sm text-muted-foreground">
                  {passwordState.success}
                </p>
              ) : null}

              <Field>
                <Button
                  type="submit"
                  variant="outline"
                  disabled={passwordPending}
                >
                  {passwordPending ? <Spinner /> : null}
                  {passwordPending ? "Updating…" : "Change password"}
                </Button>
              </Field>
            </FieldGroup>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}

function ProfileField({
  field,
  user,
}: {
  field: ProfileFieldKey
  user: ProfileUser
}) {
  const meta = PROFILE_FIELD_META[field]
  const values: Record<ProfileFieldKey, string | null> = {
    name: user.name,
    phone: user.phone,
    department: user.department,
    batch: user.batch,
    semester: user.semester,
    employeeId: user.employeeId,
    designation: user.designation,
  }
  const value = values[field] ?? ""

  if (field === "department") {
    return (
      <Field>
        <FieldLabel htmlFor="profile-department">{meta.label}</FieldLabel>
        <DepartmentField defaultValue={value} />
      </Field>
    )
  }

  return (
    <Field>
      <FieldLabel htmlFor={`profile-${field}`}>{meta.label}</FieldLabel>
      <Input
        id={`profile-${field}`}
        name={field}
        type={meta.type ?? "text"}
        defaultValue={value}
        placeholder={meta.placeholder}
      />
    </Field>
  )
}

/**
 * Department picker. A department the user already has but that is not in the
 * preset list (e.g. a staff office) is kept selectable so saving the form does
 * not silently clear it.
 */
function DepartmentField({ defaultValue }: { defaultValue: string }) {
  const options = React.useMemo(() => {
    if (
      !defaultValue ||
      (DEPARTMENTS as readonly string[]).includes(defaultValue)
    ) {
      return [...DEPARTMENTS]
    }
    return [defaultValue, ...DEPARTMENTS]
  }, [defaultValue])

  return (
    <Select name="department" defaultValue={defaultValue || undefined}>
      <SelectTrigger id="profile-department">
        <SelectValue placeholder="Select Department" />
      </SelectTrigger>
      <SelectContent>
        {options.map((department) => (
          <SelectItem key={department} value={department}>
            {department}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

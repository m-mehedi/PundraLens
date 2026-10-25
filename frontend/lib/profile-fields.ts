import type { Role } from "@/lib/roles"

/**
 * Profile fields shared by the signup form, the profile page and the
 * "add staff member" form. Keeping the definitions in one place stops the
 * three forms from drifting apart.
 */
export type ProfileFieldKey =
  | "name"
  | "phone"
  | "department"
  | "batch"
  | "semester"
  | "employeeId"
  | "designation"

export interface ProfileFieldMeta {
  label: string
  placeholder?: string
  type?: "text" | "tel" | "number"
  /** Editable by the account owner. */
  selfEditable: boolean
}

export const PROFILE_FIELD_META: Record<ProfileFieldKey, ProfileFieldMeta> = {
  name: {
    label: "Full name",
    placeholder: "e.g. Nusrat Jahan",
    selfEditable: true,
  },
  phone: {
    label: "Phone number",
    placeholder: "+8801XXXXXXXXX",
    type: "tel",
    selfEditable: true,
  },
  department: {
    label: "Department",
    placeholder: "e.g. Computer Science & Engineering",
    selfEditable: true,
  },
  batch: {
    label: "Batch",
    placeholder: "e.g. 29",
    type: "number",
    selfEditable: true,
  },
  semester: {
    label: "Semester",
    placeholder: "e.g. 1",
    type: "number",
    selfEditable: true,
  },
  employeeId: {
    label: "Employee ID",
    placeholder: "e.g. PU-1042",
    selfEditable: false,
  },
  designation: {
    label: "Designation",
    placeholder: "e.g. Assistant Professor",
    selfEditable: true,
  },
}

export const STUDENT_PROFILE_FIELDS = [
  "name",
  "phone",
  "department",
  "batch",
  "semester",
] as const satisfies readonly ProfileFieldKey[]

export const STAFF_PROFILE_FIELDS = [
  "name",
  "phone",
  "department",
  "employeeId",
  "designation",
] as const satisfies readonly ProfileFieldKey[]

export const PROFILE_FIELDS_BY_ROLE: Record<Role, readonly ProfileFieldKey[]> =
  {
    student: STUDENT_PROFILE_FIELDS,
    staff: STAFF_PROFILE_FIELDS,
    admin: ["name", "phone", "designation"],
    revoked: ["name", "phone"],
  }

export const DEPARTMENTS = [
  "Computer Science & Engineering",
  "Electrical & Electronic Engineering",
  "Civil Engineering",
  "Business Administration",
  "English",
  "Law",
  "Bangla",
  "Public Health",
  "Islamic Studies",
  "Education",
  "Journalism & Media Studies",
  "Development Studies",
] as const

export type Department = (typeof DEPARTMENTS)[number]

export type SignupFormStep = "account" | "password"

export type SignupFormData = {
  student_id: string
  department: Department
  batch: string
  semester: string
  password: string
  confirmPassword: string
}

import type { Category, Department } from "@/lib/notice-types"

/**
 * Static lookup lists shared by client and server. These are hardcoded (no
 * database access) so a client component — like the notice edit form — can
 * import them without pulling the Postgres driver into the browser bundle.
 */

export function listDepartments(): Department[] {
  return [
    { code: "BBA", name: "Bachelor of Business Administration" },
    { code: "CSE", name: "Computer Science & Engineering" },
    { code: "EEE", name: "Electrical & Electronic Engineering" },
    { code: "CVIL", name: "Civil Engineering" },
    { code: "PH", name: "Physics" },
    { code: "IS", name: "Information Science" },
    { code: "ENG", name: "English" },
    { code: "LAW", name: "Law" },
    { code: "BAN", name: "Bangla" },
    { code: "DS", name: "Data Science" },
    { code: "JMS", name: "Journalism & Mass Communication" },
  ]
}

export function listCategories(): Category[] {
  return [
    { name: "exam", display_name: "Exam", icon: "exam" },
    {
      name: "registration",
      display_name: "Registration",
      icon: "registration",
    },
    { name: "admission", display_name: "Admission", icon: "admission" },
    { name: "fee", display_name: "Fee", icon: "fee" },
    { name: "holiday", display_name: "Holiday", icon: "holiday" },
    { name: "event", display_name: "Event", icon: "event" },
    { name: "scholarship", display_name: "Scholarship", icon: "scholarship" },
    { name: "result", display_name: "Result", icon: "result" },
    { name: "general", display_name: "General", icon: "general" },
  ]
}

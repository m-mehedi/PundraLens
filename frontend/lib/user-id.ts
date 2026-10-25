/** Configurable domain suffix for converting Student IDs to synthetic emails */
export const STUDENT_EMAIL_DOMAIN = "@user.pundra"

/** Converts a Student ID to a synthetic email address for Better Auth */
export function studentIdToEmail(studentId: string): string {
  return `${studentId}${STUDENT_EMAIL_DOMAIN}`
}

/**
 * Strips the synthetic auth domain for display, returning the Student ID.
 * Emails outside the synthetic domain are returned unchanged.
 */
export function getDisplayId(email: string): string {
  const at = email.indexOf("@")
  if (at === -1) return email
  return email.slice(at) === STUDENT_EMAIL_DOMAIN ? email.slice(0, at) : email
}

/**
 * Turns whatever the user typed on the login form into an email address.
 *
 * Students sign in with their Student ID, staff and administrators sign in
 * with the email address the administrator created for them. Anything that
 * already looks like an email is passed through untouched.
 */
export function resolveLoginIdentifier(input: string): string {
  const value = input.trim()
  if (value.includes("@")) {
    return value.toLowerCase()
  }
  return studentIdToEmail(value)
}

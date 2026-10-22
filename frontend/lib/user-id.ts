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

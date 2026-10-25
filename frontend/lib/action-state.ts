/**
 * Result shape shared by the management server actions. Actions return a
 * small serialisable object so the client can render errors inline instead
 * of blowing up the route.
 */
export interface ActionState {
  error: string | null
  success: string | null
}

export const INITIAL_ACTION_STATE: ActionState = {
  error: null,
  success: null,
}

/** Rough but sufficient email shape check for account provisioning. */
export function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value)
}

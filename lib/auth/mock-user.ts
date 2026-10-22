export interface MockUser {
  id: string
  accountId: string
  name: string
  email: string
  businessName: string
  initials: string
}

/**
 * Placeholder for the authenticated user until real auth exists.
 * Swap for the real session/user record — consumers only depend on this shape.
 */
export const mockCurrentUser: MockUser = {
  id: "user_jordan_alvarez",
  accountId: "acct_jordans_plumbing",
  name: "Jordan Alvarez",
  email: "jordan@jordansplumbing.com",
  businessName: "Jordan's Plumbing",
  initials: "JA",
}

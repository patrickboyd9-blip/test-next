import { mockCurrentUser } from "@/lib/auth/mock-user"

/**
 * Who is accepting. There is no account system yet, so this is the signed-in
 * placeholder. Swap this function when real auth arrives. Callers keep this shape.
 */
export interface ComplianceActor {
  userId: string
  accountId: string
  name: string
  email: string
}

export function currentComplianceActor(): ComplianceActor {
  return {
    userId: mockCurrentUser.id,
    accountId: mockCurrentUser.accountId,
    name: mockCurrentUser.name,
    email: mockCurrentUser.email,
  }
}

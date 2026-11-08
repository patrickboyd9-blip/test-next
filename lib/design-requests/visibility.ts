import type { AccountSession } from "@/lib/auth/session"

import type { DesignRequest } from "./types"

/** The caller's own requests. Unowned and other accounts are left out. */
export function designRequestsForAccount(
  requests: DesignRequest[],
  session: AccountSession | null
): DesignRequest[] {
  if (!session) return []
  return requests.filter((request) => request.ownerId === session.userId)
}

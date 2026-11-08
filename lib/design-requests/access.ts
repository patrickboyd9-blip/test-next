import { ownerMatches } from "@/lib/auth/ownership"
import { getSession } from "@/lib/auth/session"

import { getDesignRequestStore } from "./store"

/** Response to return before a design-request file is read. Null means the caller may continue. */
export async function denyUnlessDesignRequestOwner(id: string): Promise<Response | null> {
  const session = await getSession()
  if (!session) {
    return new Response("Sign in required.", { status: 401, headers: { "Cache-Control": "private, no-store" } })
  }
  const request = await getDesignRequestStore().get(id)
  if (!request || !ownerMatches(request.ownerId, session)) {
    return new Response("Not found", { status: 404, headers: { "Cache-Control": "private, no-store" } })
  }
  return null
}

import type { AccountSession } from "@/lib/auth/session"

import type { CommandCenterSnapshot, CommandCenterUserState } from "./types"
import { mockCommandCenterSnapshots } from "./mock-data"

/**
 * Swap this implementation for a real API/DB call when campaign data exists —
 * the async signature and return shape are the real contract downstream
 * components already render against.
 */
export async function getCommandCenterSnapshot(
  state: CommandCenterUserState
): Promise<CommandCenterSnapshot> {
  return mockCommandCenterSnapshots[state]
}

/** What a signed-in customer sees before any real mailing result exists. */
export function honestCustomerSnapshot(session: AccountSession): CommandCenterSnapshot {
  const greetingName = session.name.trim().split(/\s+/)[0] || "there"
  return {
    state: "new",
    greetingName,
    businessName: session.businessName,
    summary: "No campaign results yet. This page stays empty until a mailing you approve has been sent.",
    confidence: null,
    mailStatus: null,
    metrics: [],
    recommendations: [],
    opportunities: [],
  }
}

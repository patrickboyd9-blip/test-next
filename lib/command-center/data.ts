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

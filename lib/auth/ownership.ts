import type { AccountSession } from "./session"

/**
 * An empty owner is not an account. It is not given to whoever asks.
 * A later migration has to set ownerId on purpose, one record at a time.
 */
export function ownerMatches(ownerId: string | null | undefined, session: AccountSession | null): boolean {
  if (!session) return false
  const owner = ownerId?.trim() ?? ""
  if (!owner) return false
  return owner === session.userId
}

/** Ids that still have no owner. This does not write. */
export function quarantinedRecordIds(records: { id: string; ownerId?: string | null }[]): string[] {
  return records.filter((record) => !record.ownerId?.trim()).map((record) => record.id)
}

/**
 * Append-only record of mail actions. There is no update or delete.
 * The log lives in memory for this process. Tests read it back.
 */

export const AUDIT_ACTIONS = ["create", "proof", "price", "approve", "send", "charge"] as const
export type AuditAction = (typeof AUDIT_ACTIONS)[number]

export interface AuditEvent {
  id: string
  at: string
  actorId: string
  action: AuditAction
  subjectId: string
  before: unknown
  after: unknown
}

const events: AuditEvent[] = []

export function appendAudit(input: Omit<AuditEvent, "id" | "at">, now = new Date()): AuditEvent {
  const event: AuditEvent = Object.freeze({
    id: `audit-${events.length + 1}`,
    at: now.toISOString(),
    ...input,
  })
  events.push(event)
  return event
}

export function readAudit(): readonly AuditEvent[] {
  return events
}

export function approvedBy(actorId: string, subjectId: string): boolean {
  return events.some((event) => event.action === "approve" && event.actorId === actorId && event.subjectId === subjectId)
}

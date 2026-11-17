import { readApprovedSchedule } from "@/lib/mail-journey/pricing"

import { appendAudit, approvedBy, type AuditAction } from "./audit"
import { requireRate } from "./rate-limit"

/**
 * The one module for create, proof, price, approve, send, and charge.
 * Callers record the before and after here. This module does not print or take payment.
 */

export function beginMailAction(actorId: string, action: AuditAction | "ai"): void {
  requireRate(`${action}:${actorId}`)
}

export function finishMailAction(input: {
  actorId: string
  action: AuditAction
  subjectId: string
  before: unknown
  after: unknown
}): void {
  appendAudit(input)
}

export function priceMailer(actorId: string, subjectId: string, env: NodeJS.ProcessEnv = process.env) {
  beginMailAction(actorId, "price")
  const schedule = readApprovedSchedule(env)
  const after = schedule
    ? { configured: true, total: "full" as const }
    : { configured: false, total: "placeholder" as const, postageOnly: false }
  finishMailAction({ actorId, action: "price", subjectId, before: null, after })
  return after
}

export function chargeMailer(actorId: string, subjectId: string): { charged: false } {
  beginMailAction(actorId, "charge")
  const allowed = approvedBy(actorId, subjectId)
  finishMailAction({
    actorId,
    action: "charge",
    subjectId,
    before: { approved: allowed },
    after: { charged: false, refused: !allowed },
  })
  if (!allowed) throw new Error("Nothing is charged without approval.")
  return { charged: false }
}

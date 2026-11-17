import { readApprovedSchedule } from "@/lib/mail-journey/pricing"

import { appendAudit, approvedBy, type AuditAction } from "./audit"
import { requireRate } from "./rate-limit"

/**
 * The one module for create, proof, price, approve, send, and charge.
 * Callers record the before and after here. This module does not print or take payment.
 */

export async function beginMailAction(actorId: string, action: AuditAction | "ai"): Promise<void> {
  await requireRate(`${action}:${actorId}`)
}

export async function finishMailAction(input: {
  actorId: string
  action: AuditAction
  subjectId: string
  before: unknown
  after: unknown
}): Promise<void> {
  await appendAudit(input)
}

export async function priceMailer(actorId: string, subjectId: string, env: NodeJS.ProcessEnv = process.env) {
  await beginMailAction(actorId, "price")
  const schedule = readApprovedSchedule(env)
  const after = schedule
    ? { configured: true, total: "full" as const }
    : { configured: false, total: "placeholder" as const, postageOnly: false }
  await finishMailAction({ actorId, action: "price", subjectId, before: null, after })
  return after
}

export async function chargeMailer(actorId: string, subjectId: string): Promise<{ charged: false }> {
  await beginMailAction(actorId, "charge")
  const allowed = await approvedBy(actorId, subjectId)
  await finishMailAction({
    actorId,
    action: "charge",
    subjectId,
    before: { approved: allowed },
    after: { charged: false, refused: !allowed },
  })
  if (!allowed) throw new Error("Nothing is charged without approval.")
  return { charged: false }
}

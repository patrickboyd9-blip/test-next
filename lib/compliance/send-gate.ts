import type { Recipient } from "@/lib/click2mail/recipients"

import type { ComplianceActor } from "./actor"
import {
  designFingerprintForCampaign,
  listFingerprint,
  type DesignFingerprintSource,
} from "./fingerprints"
import {
  COMPLIANCE_TEXT,
  checkedBoxTexts,
  freshCertificationIssue,
  industryById,
  textVersionIds,
  type CertificationBoxes,
  type CheckedBox,
  type TextVersionIds,
} from "./legal-text"
import { accountTextHash, campaignTextHash } from "./text-hash"

export interface CampaignCertificationInput {
  textVersionId: string
  industryId: string
  boxes: CertificationBoxes
}

export interface PriorAcceptance {
  id: string
  industryId: string
  designFingerprint: string
  listFingerprint: string
  actorUserId: string
  textVersionId: string
  textSha256: string
  proofPdfSha256: string | null
  proofPdfLocation: string | null
}

export interface SendContext {
  designFingerprint: string
  listFingerprint: string
  actorUserId: string
}

export type SendDenial = {
  ok: false
  code: "industry_required" | "blocked" | "boxes" | "stale" | "version" | "actor"
  message: string
}

export type FreshSend = {
  ok: true
  mode: "fresh"
  industryId: string
  warnings: string[]
  boxesChecked: CheckedBox[]
  textSha256: string
  textVersionIds: TextVersionIds
  designFingerprint: string
  listFingerprint: string
}

export type PriorSend = {
  ok: true
  mode: "prior"
  prior: PriorAcceptance
  warnings: string[]
}

export type SendDecision = FreshSend | PriorSend | SendDenial

export const STALE_APPROVAL_MESSAGE =
  "This mailer or mailing list changed after you approved it. Review the proof and check each box again."

export const STALE_PROOF_FILE_MESSAGE =
  "The proof file changed after you approved it. Review the proof and check each box again."

export const OTHER_PERSON_MESSAGE =
  "Someone else approved this last time. Review the proof and check each box again."

export const VERSION_MESSAGE =
  "The agreement text changed. Refresh this page and review it again."

export function sendContextFor(
  design: DesignFingerprintSource,
  recipients: readonly Recipient[],
  actor: ComplianceActor
): SendContext {
  return {
    designFingerprint: designFingerprintForCampaign(design),
    listFingerprint: listFingerprint(recipients),
    actorUserId: actor.userId,
  }
}

function versionIssue(textVersionId: string): SendDenial | null {
  if (textVersionId !== COMPLIANCE_TEXT.versionId) {
    return { ok: false, code: "version", message: VERSION_MESSAGE }
  }
  return null
}

function priorCovers(prior: PriorAcceptance, context: SendContext, industryId: string): boolean {
  const versions = textVersionIds()
  return (
    prior.actorUserId === context.actorUserId &&
    prior.designFingerprint === context.designFingerprint &&
    prior.listFingerprint === context.listFingerprint &&
    prior.industryId === industryId &&
    prior.textVersionId === versions.pack &&
    prior.textSha256 === campaignTextHash(industryId)
  )
}

function staleReason(prior: PriorAcceptance | null, context: SendContext, industryId: string): SendDenial | null {
  if (!prior) return null
  if (prior.actorUserId !== context.actorUserId) {
    return { ok: false, code: "actor", message: OTHER_PERSON_MESSAGE }
  }
  const versions = textVersionIds()
  if (prior.textVersionId !== versions.pack || prior.textSha256 !== campaignTextHash(prior.industryId)) {
    return { ok: false, code: "version", message: VERSION_MESSAGE }
  }
  if (
    prior.designFingerprint !== context.designFingerprint ||
    prior.listFingerprint !== context.listFingerprint ||
    prior.industryId !== industryId
  ) {
    return { ok: false, code: "stale", message: STALE_APPROVAL_MESSAGE }
  }
  return null
}

/**
 * Fresh checked boxes always count as a new approval of the current design
 * and list. An older approval counts only when the design, list, person,
 * industry, and text version are all unchanged.
 */
export function decideSend(input: {
  certification: CampaignCertificationInput | null
  prior: PriorAcceptance | null
  context: SendContext
}): SendDecision {
  const certification = input.certification
  const industryId = certification?.industryId ?? ""
  const boxes = certification?.boxes

  if (certification) {
    const version = versionIssue(certification.textVersionId)
    if (version && boxes && (boxes.reviewedProof || boxes.responsibility || boxes.listRights)) {
      return version
    }
  }

  const freshIssue = freshCertificationIssue(industryId, boxes ?? {
    reviewedProof: false,
    responsibility: false,
    listRights: false,
    industryAcknowledgment: false,
  })

  if (!freshIssue && certification) {
    const industry = industryById(industryId)
    if (!industry) {
      return { ok: false, code: "industry_required", message: "Choose what this mailer is advertising." }
    }
    return {
      ok: true,
      mode: "fresh",
      industryId,
      warnings: industry.warning ? [industry.warning] : [],
      boxesChecked: checkedBoxTexts(industry, certification.boxes),
      textSha256: campaignTextHash(industryId),
      textVersionIds: textVersionIds(),
      designFingerprint: input.context.designFingerprint,
      listFingerprint: input.context.listFingerprint,
    }
  }

  if (freshIssue?.code === "blocked") return { ok: false, ...freshIssue }

  if (
    input.prior &&
    industryId &&
    priorCovers(input.prior, input.context, industryId)
  ) {
    const industry = industryById(industryId)
    return {
      ok: true,
      mode: "prior",
      prior: input.prior,
      warnings: industry?.warning ? [industry.warning] : [],
    }
  }

  const stale = staleReason(input.prior, input.context, industryId || input.prior?.industryId || "")
  if (stale && input.prior) return stale
  if (freshIssue) return { ok: false, ...freshIssue }
  return { ok: false, code: "boxes", message: "Check each box before this can be sent." }
}

/**
 * Continue reuses the list already on the order. A design edit, a text
 * change, or a different person means they have to approve again.
 */
export function decideContinue(input: {
  prior: PriorAcceptance | null
  designFingerprint: string
  actorUserId: string
}): PriorSend | SendDenial {
  const prior = input.prior
  if (!prior) {
    return { ok: false, code: "boxes", message: "Check each box before this can be sent." }
  }
  if (prior.actorUserId !== input.actorUserId) {
    return { ok: false, code: "actor", message: OTHER_PERSON_MESSAGE }
  }
  const versions = textVersionIds()
  if (prior.textVersionId !== versions.pack || prior.textSha256 !== campaignTextHash(prior.industryId)) {
    return { ok: false, code: "version", message: VERSION_MESSAGE }
  }
  const industry = industryById(prior.industryId)
  if (!industry) {
    return { ok: false, code: "industry_required", message: "Choose what this mailer is advertising." }
  }
  if (industry.action === "block") {
    return { ok: false, code: "blocked", message: industry.warning }
  }
  if (prior.designFingerprint !== input.designFingerprint) {
    return { ok: false, code: "stale", message: STALE_APPROVAL_MESSAGE }
  }
  return {
    ok: true,
    mode: "prior",
    prior,
    warnings: industry.warning ? [industry.warning] : [],
  }
}

export function accountAcceptanceState(row: {
  textVersionIds: Pick<TextVersionIds, "pack" | "terms" | "aup" | "privacy">
  textSha256: string
} | null): { required: boolean; reason: "missing" | "updated" | null } {
  if (!row) return { required: true, reason: "missing" }
  const current = textVersionIds()
  const sameVersions =
    row.textVersionIds.pack === current.pack &&
    row.textVersionIds.terms === current.terms &&
    row.textVersionIds.aup === current.aup &&
    row.textVersionIds.privacy === current.privacy
  if (!sameVersions || row.textSha256 !== accountTextHash()) {
    return { required: true, reason: "updated" }
  }
  return { required: false, reason: null }
}

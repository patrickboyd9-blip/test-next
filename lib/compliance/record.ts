import { randomUUID } from "crypto"

import type { Recipient } from "@/lib/click2mail/recipients"

import type { ComplianceActor } from "./actor"
import { currentComplianceActor } from "./actor"
import {
  designFingerprintForCampaign,
  type DesignFingerprintSource,
} from "./fingerprints"
import { COMPLIANCE_TEXT, textVersionIds, type TextVersionIds } from "./legal-text"
import {
  acceptanceRow,
  getComplianceProofLog,
  priorFromRow,
  type ComplianceProofLog,
} from "./proof-log"
import {
  accountAcceptanceState,
  decideContinue,
  decideSend,
  sendContextFor,
  type CampaignCertificationInput,
  type PriorSend,
  type SendDecision,
  type SendDenial,
} from "./send-gate"
import { accountTextHash } from "./text-hash"

export interface RequestFacts {
  ip: string
  userAgent: string
  sessionId: string
}

export interface DesignSource extends DesignFingerprintSource {
  id: string
}

interface GateOptions {
  actor?: ComplianceActor
  log?: ComplianceProofLog
  now?: () => string
}

function actorOf(options: GateOptions): ComplianceActor {
  return options.actor ?? currentComplianceActor()
}

function logOf(options: GateOptions): ComplianceProofLog {
  return options.log ?? getComplianceProofLog()
}

function nowOf(options: GateOptions): string {
  return (options.now ?? (() => new Date().toISOString()))()
}

async function priorFor(
  campaignId: string,
  log: ComplianceProofLog
): Promise<ReturnType<typeof priorFromRow>> {
  const row = await log.latestCampaignCertification(campaignId)
  return row ? priorFromRow(row) : null
}

export async function gateCampaignSubmit(
  input: {
    campaign: DesignSource
    recipients: readonly Recipient[]
    certification: CampaignCertificationInput | null
  },
  options: GateOptions = {}
): Promise<SendDecision> {
  const actor = actorOf(options)
  const prior = await priorFor(input.campaign.id, logOf(options))
  return decideSend({
    certification: input.certification,
    prior,
    context: sendContextFor(input.campaign, input.recipients, actor),
  })
}

export async function gateCampaignContinue(
  campaign: DesignSource,
  options: GateOptions = {}
): Promise<PriorSend | SendDenial> {
  const actor = actorOf(options)
  const prior = await priorFor(campaign.id, logOf(options))
  return decideContinue({
    prior,
    designFingerprint: designFingerprintForCampaign(campaign),
    actorUserId: actor.userId,
  })
}

export async function writeFreshCertification(
  input: {
    campaignId: string
    decision: Extract<SendDecision, { ok: true; mode: "fresh" }>
    facts: RequestFacts
    proofPdfSha256: string
    proofPdfLocation: string
    eventId?: string
  },
  options: GateOptions = {}
): Promise<string> {
  const id = input.eventId ?? randomUUID()
  const row = acceptanceRow({
    id,
    eventType: "campaign_certification",
    actor: actorOf(options),
    createdAt: nowOf(options),
    ip: input.facts.ip,
    userAgent: input.facts.userAgent,
    sessionId: input.facts.sessionId,
    textVersionIds: input.decision.textVersionIds,
    textSha256: input.decision.textSha256,
    campaignId: input.campaignId,
    industry: input.decision.industryId,
    warningsShown: input.decision.warnings,
    boxesChecked: input.decision.boxesChecked,
    proofPdfSha256: input.proofPdfSha256,
    proofPdfLocation: input.proofPdfLocation,
    designFingerprint: input.decision.designFingerprint,
    listFingerprint: input.decision.listFingerprint,
  })
  await logOf(options).append(row)
  return id
}

export async function writeJobLink(
  input: {
    campaignId: string
    certificationId: string
    click2mailJobId: string
    facts: RequestFacts
    proofPdfSha256?: string | null
    proofPdfLocation?: string | null
    textVersionIds: TextVersionIds
    textSha256: string
    industry: string | null
    warningsShown: string[]
    designFingerprint: string | null
    listFingerprint: string | null
  },
  options: GateOptions = {}
): Promise<void> {
  await logOf(options).append(
    acceptanceRow({
      id: randomUUID(),
      eventType: "click2mail_job_linked",
      actor: actorOf(options),
      createdAt: nowOf(options),
      ip: input.facts.ip,
      userAgent: input.facts.userAgent,
      sessionId: input.facts.sessionId,
      textVersionIds: input.textVersionIds,
      textSha256: input.textSha256,
      campaignId: input.campaignId,
      click2mailJobId: input.click2mailJobId,
      certificationId: input.certificationId,
      industry: input.industry,
      warningsShown: input.warningsShown,
      proofPdfSha256: input.proofPdfSha256,
      proofPdfLocation: input.proofPdfLocation,
      designFingerprint: input.designFingerprint,
      listFingerprint: input.listFingerprint,
    })
  )
}

export async function writeAccountAcceptance(
  facts: RequestFacts,
  options: GateOptions = {}
): Promise<void> {
  const versions = textVersionIds()
  await logOf(options).append(
    acceptanceRow({
      id: randomUUID(),
      eventType: "account_clickwrap",
      actor: actorOf(options),
      createdAt: nowOf(options),
      ip: facts.ip,
      userAgent: facts.userAgent,
      sessionId: facts.sessionId,
      textVersionIds: versions,
      textSha256: accountTextHash(),
      boxesChecked: [{ id: "account", text: COMPLIANCE_TEXT.account.checkbox }],
    })
  )
}

export async function readAccountGate(
  options: GateOptions = {}
): Promise<{ required: boolean; reason: "missing" | "updated" | null }> {
  const actor = actorOf(options)
  const row = await logOf(options).latestAccountAcceptance(actor.accountId)
  if (!row) return accountAcceptanceState(null)
  return accountAcceptanceState({
    textVersionIds: row.textVersionIds,
    textSha256: row.textSha256,
  })
}

export async function accountGate(): Promise<{ required: boolean; reason: "missing" | "updated" | null }> {
  return readAccountGate()
}

import assert from "node:assert/strict"
import { createHash } from "crypto"
import { mkdtemp, readFile, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { test } from "node:test"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"

import type { Recipient } from "@/lib/click2mail/recipients"
import type { SqlExecutor } from "@/lib/storage/document-store"

import { ComplianceChecks } from "@/components/compliance/ComplianceChecks"
import type { ComplianceActor } from "./actor"
import { sha256Hex } from "./hash"
import {
  accountCheckboxParts,
  accountPlainText,
  approveAndSendLabel,
  COMPLIANCE_TEXT,
  EMPTY_CERTIFICATION_BOXES,
  INDUSTRY_CATEGORIES,
  industryById,
  type CertificationBoxes,
} from "./legal-text"
import { storeApprovedProofPdf } from "./proof-file"
import {
  createFileProofLog,
  createPostgresProofLog,
  type ProofLogRow,
} from "./proof-log"
import {
  gateCampaignContinue,
  gateCampaignSubmit,
  readAccountGate,
  writeAccountAcceptance,
  writeFreshCertification,
  writeJobLink,
  type DesignSource,
} from "./record"
import { accountAcceptanceState } from "./send-gate"
import { accountTextHash } from "./text-hash"

const actor: ComplianceActor = {
  userId: "user_jordan",
  accountId: "acct_jordan",
  name: "Jordan Alvarez",
  email: "jordan@jordansplumbing.com",
}

const facts = {
  ip: "203.0.113.10",
  userAgent: "Mozilla/5.0 (test)",
  sessionId: "session-1",
}

const now = "2026-10-22T06:30:00.000Z"

const recipient: Recipient = {
  first: "Ada",
  last: "Lovelace",
  organization: "",
  address1: "1 Main St",
  address2: "",
  city: "Austin",
  state: "TX",
  zip: "78701",
}

function design(headline: string, version = 1): DesignSource {
  return {
    id: "camp-1",
    mailPiece: { id: "piece-1", version, spec: { headline } },
  }
}

function boxes(overrides: Partial<CertificationBoxes> = {}): CertificationBoxes {
  return {
    reviewedProof: true,
    responsibility: true,
    listRights: true,
    industryAcknowledgment: true,
    ...overrides,
  }
}

function certification(industryId: string, checked: CertificationBoxes = boxes()) {
  return {
    textVersionId: COMPLIANCE_TEXT.versionId,
    industryId,
    boxes: checked,
  }
}

test("the gate blocks submit without all boxes", async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "mm-compliance-"))
  try {
    const log = createFileProofLog(path.join(directory, "proof-log.jsonl"))
    const decision = await gateCampaignSubmit(
      {
        campaign: design("Hello"),
        recipients: [recipient],
        certification: certification("general", {
          ...EMPTY_CERTIFICATION_BOXES,
          reviewedProof: true,
        }),
      },
      { log, actor }
    )
    assert.equal(decision.ok, false)
    if (!decision.ok) {
      assert.equal(decision.code, "boxes")
      assert.match(decision.message, /Check each box/)
    }
    assert.equal((await log.listForCampaign("camp-1")).length, 0)
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
})

test("a changed design or list asks for approval again", async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "mm-compliance-"))
  try {
    const log = createFileProofLog(path.join(directory, "proof-log.jsonl"))
    const options = { log, actor, now: () => now }
    const first = await gateCampaignSubmit(
      {
        campaign: design("Hello"),
        recipients: [recipient],
        certification: certification("general", boxes({ industryAcknowledgment: false })),
      },
      options
    )
    assert.equal(first.ok, true)
    if (!first.ok || first.mode !== "fresh") return
    await writeFreshCertification(
      {
        campaignId: "camp-1",
        decision: first,
        facts,
        proofPdfSha256: "abc",
        proofPdfLocation: "file:proof.pdf",
        eventId: "cert-1",
      },
      options
    )

    const edited = await gateCampaignSubmit(
      {
        campaign: design("Rewritten", 2),
        recipients: [recipient],
        certification: certification("general", EMPTY_CERTIFICATION_BOXES),
      },
      options
    )
    assert.equal(edited.ok, false)
    if (!edited.ok) assert.equal(edited.code, "stale")

    const relist = await gateCampaignSubmit(
      {
        campaign: design("Hello"),
        recipients: [{ ...recipient, address1: "9 Other St" }],
        certification: certification("general", EMPTY_CERTIFICATION_BOXES),
      },
      options
    )
    assert.equal(relist.ok, false)
    if (!relist.ok) assert.equal(relist.code, "stale")

    const unchanged = await gateCampaignSubmit(
      {
        campaign: design("Hello"),
        recipients: [recipient],
        certification: certification("general", EMPTY_CERTIFICATION_BOXES),
      },
      options
    )
    assert.equal(unchanged.ok, true)
    if (unchanged.ok) assert.equal(unchanged.mode, "prior")

    const again = await gateCampaignSubmit(
      {
        campaign: design("Rewritten", 2),
        recipients: [recipient],
        certification: certification("general", boxes({ industryAcknowledgment: false })),
      },
      options
    )
    assert.equal(again.ok, true)
    if (again.ok) assert.equal(again.mode, "fresh")

    const continued = await gateCampaignContinue(design("Rewritten", 2), options)
    assert.equal(continued.ok, false)
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
})

test("blocked categories cannot be submitted and Medicare stays a warning", async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "mm-compliance-"))
  try {
    const log = createFileProofLog(path.join(directory, "proof-log.jsonl"))
    for (const id of ["cannabis", "lottery", "sexually_oriented", "weapons", "government_lookalike"]) {
      const decision = await gateCampaignSubmit(
        {
          campaign: design("Hello"),
          recipients: [recipient],
          certification: certification(id),
        },
        { log, actor }
      )
      assert.equal(decision.ok, false, id)
      if (!decision.ok) assert.equal(decision.code, "blocked", id)
      assert.equal(industryById(id)?.action, "block")
    }
    assert.equal((await log.listForCampaign("camp-1")).length, 0)

    const medicare = industryById("medicare")
    assert.equal(medicare?.action, "warn")
    const missingAck = await gateCampaignSubmit(
      {
        campaign: design("Hello"),
        recipients: [recipient],
        certification: certification("medicare", boxes({ industryAcknowledgment: false })),
      },
      { log, actor }
    )
    assert.equal(missingAck.ok, false)
    const allowed = await gateCampaignSubmit(
      {
        campaign: design("Hello"),
        recipients: [recipient],
        certification: certification("medicare"),
      },
      { log, actor }
    )
    assert.equal(allowed.ok, true)
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
})

test("log rows are written once and keep the job id on a later row", async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "mm-compliance-"))
  try {
    const filePath = path.join(directory, "proof-log.jsonl")
    const log = createFileProofLog(filePath)
    const options = { log, actor, now: () => now }
    const decision = await gateCampaignSubmit(
      {
        campaign: design("Hello"),
        recipients: [recipient],
        certification: certification("real_estate"),
      },
      options
    )
    assert.equal(decision.ok, true)
    if (!decision.ok || decision.mode !== "fresh") return

    const proof = await storeApprovedProofPdf({
      campaignId: "camp-1",
      eventId: "cert-1",
      bytes: new TextEncoder().encode("proof-pdf"),
      rootDir: directory,
      blob: null,
    })
    await writeFreshCertification(
      {
        campaignId: "camp-1",
        decision,
        facts,
        proofPdfSha256: proof.sha256,
        proofPdfLocation: proof.location,
        eventId: "cert-1",
      },
      options
    )
    await writeJobLink(
      {
        campaignId: "camp-1",
        certificationId: "cert-1",
        click2mailJobId: "job-99",
        facts,
        proofPdfSha256: proof.sha256,
        proofPdfLocation: proof.location,
        textVersionIds: decision.textVersionIds,
        textSha256: decision.textSha256,
        industry: "real_estate",
        warningsShown: decision.warnings,
        designFingerprint: decision.designFingerprint,
        listFingerprint: decision.listFingerprint,
      },
      options
    )

    const rows = await log.listForCampaign("camp-1")
    assert.equal(rows.length, 2)
    const certificationRow = rows.find((row) => row.eventType === "campaign_certification")
    const jobRow = rows.find((row) => row.eventType === "click2mail_job_linked")
    assert.ok(certificationRow)
    assert.equal(certificationRow?.userId, actor.userId)
    assert.equal(certificationRow?.accountId, actor.accountId)
    assert.equal(certificationRow?.campaignId, "camp-1")
    assert.equal(certificationRow?.createdAt, now)
    assert.equal(certificationRow?.ip, facts.ip)
    assert.equal(certificationRow?.userAgent, facts.userAgent)
    assert.equal(certificationRow?.industry, "real_estate")
    assert.equal(certificationRow?.textSha256, decision.textSha256)
    assert.equal(certificationRow?.textVersionIds.pack, COMPLIANCE_TEXT.versionId)
    assert.equal(certificationRow?.proofPdfSha256, proof.sha256)
    assert.equal(certificationRow?.click2mailJobId, null)
    assert.equal(certificationRow?.boxesChecked.length, 4)
    assert.ok(certificationRow?.warningsShown[0]?.includes("fair housing"))
    assert.equal(jobRow?.click2mailJobId, "job-99")
    assert.equal(jobRow?.certificationId, "cert-1")

    const raw = await readFile(filePath, "utf8")
    assert.equal(raw.trim().split("\n").length, 2)
    assert.match(raw.split("\n")[0] ?? "", /"id":"cert-1"/)

    const again = await storeApprovedProofPdf({
      campaignId: "camp-1",
      eventId: "cert-1",
      bytes: new TextEncoder().encode("different"),
      rootDir: directory,
      blob: null,
    })
    const stored = await readFile(proof.location)
    assert.equal(stored.toString(), "proof-pdf")
    assert.notEqual(again.sha256, sha256Hex(new TextEncoder().encode("different")))
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
})

test("account acceptance is asked again when the text version changes", async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "mm-compliance-"))
  try {
    const log = createFileProofLog(path.join(directory, "proof-log.jsonl"))
    const options = { log, actor, now: () => now }
    assert.deepEqual(await readAccountGate(options), { required: true, reason: "missing" })
    await writeAccountAcceptance(facts, options)
    assert.deepEqual(await readAccountGate(options), { required: false, reason: null })

    const current = await log.latestAccountAcceptance(actor.accountId)
    assert.ok(current)
    assert.equal(
      accountAcceptanceState({
        textVersionIds: { ...current.textVersionIds, pack: "draft-old" },
        textSha256: current.textSha256,
      }).reason,
      "updated"
    )
    assert.equal(
      accountAcceptanceState({
        textVersionIds: current.textVersionIds,
        textSha256: "not-the-text-they-saw",
      }).reason,
      "updated"
    )
    assert.equal(accountTextHash(), sha256Hex(accountPlainText()))
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
})

test("postgres proof log only inserts and reads", async () => {
  const sql = new MemoryComplianceSql()
  const log = createPostgresProofLog(sql)
  const row = sampleRow()
  await log.append(row)
  await log.append({ ...row, id: "job-row", eventType: "click2mail_job_linked", click2mailJobId: "job-1" })
  const latest = await log.latestCampaignCertification("camp-1")
  assert.equal(latest?.id, "cert-1")
  assert.equal(latest?.industry, "general")
  const listed = await log.listForCampaign("camp-1")
  assert.equal(listed.length, 2)
  assert.equal(listed.find((item) => item.id === "cert-1")?.click2mailJobId, null)
  assert.ok(sql.statements.some((statement) => statement.startsWith("INSERT INTO compliance_proof_log")))
  assert.equal(sql.statements.some((statement) => /\bUPDATE\b/i.test(statement)), false)
  assert.equal(sql.statements.some((statement) => /\bDELETE\b/i.test(statement)), false)
})

test("the proof log module has no update or delete statement", async () => {
  const source = await readFile(new URL("./proof-log.ts", import.meta.url), "utf8")
  assert.doesNotMatch(source, /\bUPDATE\s+compliance_proof_log\b/i)
  assert.doesNotMatch(source, /\bDELETE\s+FROM\b/i)
})

test("draft account and campaign text match the acceptance sentences", () => {
  const parts = accountCheckboxParts()
  const docs = COMPLIANCE_TEXT.account.documents
  const sentence = `${parts.beforeTerms}${docs.terms.title}${parts.betweenTermsAndAup}${docs.aup.title}${parts.betweenAupAndPrivacy}${docs.privacy.title}${parts.afterPrivacy}`
  assert.equal(sentence, COMPLIANCE_TEXT.account.checkbox)
  assert.match(COMPLIANCE_TEXT.account.notice, /not a law firm/)
  assert.match(COMPLIANCE_TEXT.account.notice, /AI tools can make mistakes/)
  assert.equal(approveAndSendLabel(1, "$0.50"), "Approve and send 1 postcard for $0.50")
  assert.equal(approveAndSendLabel(2, "$0.99"), "Approve and send 2 postcards for $0.99")
  assert.equal(INDUSTRY_CATEGORIES.filter((category) => category.action === "block").length, 5)
  const regulated = [
    "real_estate",
    "we_buy_houses",
    "mortgage_credit",
    "insurance",
    "medicare",
    "healthcare",
    "alcohol",
    "solar",
    "political",
  ]
  for (const id of regulated) assert.equal(industryById(id)?.action, "warn", id)
})

test("the send button stays off until every box is checked, and a blocked category stays off", () => {
  const blocked = decode(renderChecks({
    industryId: "cannabis",
    boxes: boxes(),
    submitDisabled: true,
  }))
  assert.match(blocked, /Modern Mail can't mail cannabis or THC advertising/)
  assert.match(blocked, /Approve and send 2 postcards for \$0\.99/)
  assert.match(blocked, /disabled=""/)
  assert.doesNotMatch(blocked, /I have reviewed this final proof/)

  const open = renderChecks({
    industryId: "",
    boxes: EMPTY_CERTIFICATION_BOXES,
    submitDisabled: true,
  })
  assert.equal(open.includes("checked="), false)
  assert.match(open, /Choose one/)
  assert.match(open, /What is this mailer advertising\?/)

  const ready = renderChecks({
    industryId: "general",
    boxes: boxes({ industryAcknowledgment: false }),
    submitDisabled: false,
  })
  assert.match(ready, /I have reviewed this final proof/)
  assert.match(ready, /I am responsible for making sure this mailer/)
  assert.match(ready, /I have the right to use this mailing list/)
  assert.equal(ready.includes('disabled=""'), false)
})

function decode(html: string): string {
  return html.replace(/&#x27;|&apos;/g, "'")
}

function renderChecks(props: {
  industryId: string
  boxes: CertificationBoxes
  submitDisabled: boolean
}): string {
  return renderToStaticMarkup(
    createElement(ComplianceChecks, {
      industryId: props.industryId,
      onIndustryId() {},
      boxes: props.boxes,
      onBoxes() {},
      covered: false,
      notice: null,
      proof: createElement("p", null, "Front and back proof"),
      submitLabel: "Approve and send 2 postcards for $0.99",
      submitDisabled: props.submitDisabled,
      onSubmit() {},
    })
  )
}

function sampleRow(): ProofLogRow {
  return {
    id: "cert-1",
    eventType: "campaign_certification",
    userId: actor.userId,
    accountId: actor.accountId,
    userName: actor.name,
    userEmail: actor.email,
    campaignId: "camp-1",
    click2mailJobId: null,
    certificationId: null,
    createdAt: now,
    ip: facts.ip,
    userAgent: facts.userAgent,
    sessionId: facts.sessionId,
    textVersionIds: {
      pack: COMPLIANCE_TEXT.versionId,
      terms: COMPLIANCE_TEXT.account.termsVersionId,
      aup: COMPLIANCE_TEXT.account.aupVersionId,
      privacy: COMPLIANCE_TEXT.account.privacyVersionId,
      campaign: COMPLIANCE_TEXT.campaign.versionId,
    },
    textSha256: "hash",
    industry: "general",
    warningsShown: [],
    boxesChecked: [{ id: "reviewedProof", text: COMPLIANCE_TEXT.campaign.boxes.reviewedProof }],
    proofPdfSha256: createHash("sha256").update("proof").digest("hex"),
    proofPdfLocation: "file:proof.pdf",
    designFingerprint: "design",
    listFingerprint: "list",
  }
}

class MemoryComplianceSql implements SqlExecutor {
  readonly statements: string[] = []
  private readonly rows: Record<string, unknown>[] = []

  async query<T extends Record<string, unknown>>(
    text: string,
    params: readonly unknown[] = []
  ): Promise<T[]> {
    const sql = text.replace(/\s+/g, " ").trim()
    this.statements.push(sql)
    if (sql.startsWith("CREATE TABLE") || sql.startsWith("CREATE INDEX")) return []
    if (sql.startsWith("INSERT INTO compliance_proof_log")) {
      const names = /INSERT INTO compliance_proof_log \(([^)]+)\)/.exec(sql)?.[1]
      if (!names) throw new Error(`Unparsed insert: ${sql}`)
      const columns = names.split(",").map((name) => name.trim())
      const row: Record<string, unknown> = {}
      columns.forEach((column, index) => {
        row[column] = params[index]
      })
      this.rows.push(row)
      return []
    }
    if (sql.startsWith("SELECT")) {
      let matched = this.rows
      if (sql.includes("account_id = $1")) {
        matched = matched.filter((row) => row.account_id === params[0] && row.event_type === params[1])
      } else if (sql.includes("campaign_id = $1 AND event_type = $2")) {
        matched = matched.filter((row) => row.campaign_id === params[0] && row.event_type === params[1])
      } else if (sql.includes("campaign_id = $1")) {
        matched = matched.filter((row) => row.campaign_id === params[0])
      }
      matched = [...matched].sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))
      if (sql.includes("LIMIT 1")) matched = matched.slice(0, 1)
      return matched as T[]
    }
    throw new Error(`Unexpected SQL: ${sql}`)
  }
}

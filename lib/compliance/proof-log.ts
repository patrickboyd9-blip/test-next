import { appendFile, mkdir, readFile } from "fs/promises"
import path from "path"

import {
  createNeonExecutor,
  postgresUrl,
  type SqlExecutor,
} from "@/lib/storage/document-store"

import type { ComplianceActor } from "./actor"
import type { CheckedBox, TextVersionIds } from "./legal-text"
import type { PriorAcceptance } from "./send-gate"

export type ProofEventType = "account_clickwrap" | "campaign_certification" | "click2mail_job_linked"

/**
 * One acceptance, written once.
 * Callers can append. There is no update and no delete.
 */
export interface ProofLogRow {
  id: string
  eventType: ProofEventType
  userId: string
  accountId: string
  userName: string
  userEmail: string
  campaignId: string | null
  click2mailJobId: string | null
  certificationId: string | null
  createdAt: string
  ip: string
  userAgent: string
  sessionId: string
  textVersionIds: TextVersionIds
  textSha256: string
  industry: string | null
  warningsShown: string[]
  boxesChecked: CheckedBox[]
  proofPdfSha256: string | null
  proofPdfLocation: string | null
  designFingerprint: string | null
  listFingerprint: string | null
}

export interface ComplianceProofLog {
  append(row: ProofLogRow): Promise<void>
  latestAccountAcceptance(accountId: string): Promise<ProofLogRow | null>
  latestCampaignCertification(campaignId: string): Promise<ProofLogRow | null>
  listForCampaign(campaignId: string): Promise<ProofLogRow[]>
}

export function priorFromRow(row: ProofLogRow): PriorAcceptance | null {
  if (row.eventType !== "campaign_certification") return null
  if (!row.industry || !row.designFingerprint || !row.listFingerprint) return null
  return {
    id: row.id,
    industryId: row.industry,
    designFingerprint: row.designFingerprint,
    listFingerprint: row.listFingerprint,
    actorUserId: row.userId,
    textVersionId: row.textVersionIds.pack,
    textSha256: row.textSha256,
    proofPdfSha256: row.proofPdfSha256,
    proofPdfLocation: row.proofPdfLocation,
  }
}

export function acceptanceRow(input: {
  id: string
  eventType: ProofEventType
  actor: ComplianceActor
  createdAt: string
  ip: string
  userAgent: string
  sessionId: string
  textVersionIds: TextVersionIds
  textSha256: string
  campaignId?: string | null
  click2mailJobId?: string | null
  certificationId?: string | null
  industry?: string | null
  warningsShown?: string[]
  boxesChecked?: CheckedBox[]
  proofPdfSha256?: string | null
  proofPdfLocation?: string | null
  designFingerprint?: string | null
  listFingerprint?: string | null
}): ProofLogRow {
  return {
    id: input.id,
    eventType: input.eventType,
    userId: input.actor.userId,
    accountId: input.actor.accountId,
    userName: input.actor.name,
    userEmail: input.actor.email,
    campaignId: input.campaignId ?? null,
    click2mailJobId: input.click2mailJobId ?? null,
    certificationId: input.certificationId ?? null,
    createdAt: input.createdAt,
    ip: input.ip,
    userAgent: input.userAgent,
    sessionId: input.sessionId,
    textVersionIds: input.textVersionIds,
    textSha256: input.textSha256,
    industry: input.industry ?? null,
    warningsShown: input.warningsShown ?? [],
    boxesChecked: input.boxesChecked ?? [],
    proofPdfSha256: input.proofPdfSha256 ?? null,
    proofPdfLocation: input.proofPdfLocation ?? null,
    designFingerprint: input.designFingerprint ?? null,
    listFingerprint: input.listFingerprint ?? null,
  }
}

const TABLE = "compliance_proof_log"

const CREATE_TABLE = `CREATE TABLE IF NOT EXISTS ${TABLE} (
  id text PRIMARY KEY,
  event_type text NOT NULL,
  user_id text NOT NULL,
  account_id text NOT NULL,
  user_name text NOT NULL,
  user_email text NOT NULL,
  campaign_id text,
  click2mail_job_id text,
  certification_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  ip text,
  user_agent text,
  session_id text,
  text_version_ids jsonb NOT NULL,
  text_sha256 text NOT NULL,
  industry text,
  warnings_shown jsonb NOT NULL,
  boxes_checked jsonb NOT NULL,
  proof_pdf_sha256 text,
  proof_pdf_location text,
  design_fingerprint text,
  list_fingerprint text
)`

const CREATE_ACCOUNT_INDEX = `CREATE INDEX IF NOT EXISTS compliance_proof_log_account_idx ON ${TABLE} (account_id, event_type)`
const CREATE_CAMPAIGN_INDEX = `CREATE INDEX IF NOT EXISTS compliance_proof_log_campaign_idx ON ${TABLE} (campaign_id, event_type)`

const INSERT_SQL = `INSERT INTO ${TABLE} (
  id, event_type, user_id, account_id, user_name, user_email,
  campaign_id, click2mail_job_id, certification_id, created_at,
  ip, user_agent, session_id, text_version_ids, text_sha256,
  industry, warnings_shown, boxes_checked, proof_pdf_sha256,
  proof_pdf_location, design_fingerprint, list_fingerprint
) VALUES (
  $1, $2, $3, $4, $5, $6,
  $7, $8, $9, $10,
  $11, $12, $13, $14::jsonb, $15,
  $16, $17::jsonb, $18::jsonb, $19,
  $20, $21, $22
)`

const SELECT_COLUMNS = `id, event_type, user_id, account_id, user_name, user_email,
  campaign_id, click2mail_job_id, certification_id, created_at,
  ip, user_agent, session_id, text_version_ids, text_sha256,
  industry, warnings_shown, boxes_checked, proof_pdf_sha256,
  proof_pdf_location, design_fingerprint, list_fingerprint`

function defaultLogPath(): string {
  return path.join(process.cwd(), ".data", "compliance", "proof-log.jsonl")
}

function isBenignCreateRace(error: unknown): boolean {
  const code = (error as { code?: string }).code
  const message = error instanceof Error ? error.message : String(error)
  return (
    code === "42P07" ||
    code === "23505" ||
    /already exists/i.test(message) ||
    /pg_type_typname_nsp_index/i.test(message)
  )
}

function parseJson<T>(value: unknown): T {
  if (typeof value === "string") return JSON.parse(value) as T
  return value as T
}

function toIso(value: unknown): string {
  if (value instanceof Date) return value.toISOString()
  if (typeof value === "string") {
    const parsed = new Date(value)
    if (!Number.isNaN(parsed.getTime()) && !value.endsWith("Z") && value.includes("+")) {
      return parsed.toISOString()
    }
    return value
  }
  return String(value)
}

function mapRow(row: Record<string, unknown>): ProofLogRow {
  return {
    id: String(row.id),
    eventType: String(row.event_type) as ProofLogRow["eventType"],
    userId: String(row.user_id),
    accountId: String(row.account_id),
    userName: String(row.user_name),
    userEmail: String(row.user_email),
    campaignId: row.campaign_id == null ? null : String(row.campaign_id),
    click2mailJobId: row.click2mail_job_id == null ? null : String(row.click2mail_job_id),
    certificationId: row.certification_id == null ? null : String(row.certification_id),
    createdAt: toIso(row.created_at),
    ip: String(row.ip ?? ""),
    userAgent: String(row.user_agent ?? ""),
    sessionId: String(row.session_id ?? ""),
    textVersionIds: parseJson<TextVersionIds>(row.text_version_ids),
    textSha256: String(row.text_sha256),
    industry: row.industry == null ? null : String(row.industry),
    warningsShown: parseJson<string[]>(row.warnings_shown) ?? [],
    boxesChecked: parseJson<CheckedBox[]>(row.boxes_checked) ?? [],
    proofPdfSha256: row.proof_pdf_sha256 == null ? null : String(row.proof_pdf_sha256),
    proofPdfLocation: row.proof_pdf_location == null ? null : String(row.proof_pdf_location),
    designFingerprint: row.design_fingerprint == null ? null : String(row.design_fingerprint),
    listFingerprint: row.list_fingerprint == null ? null : String(row.list_fingerprint),
  }
}

function insertParams(row: ProofLogRow): unknown[] {
  return [
    row.id,
    row.eventType,
    row.userId,
    row.accountId,
    row.userName,
    row.userEmail,
    row.campaignId,
    row.click2mailJobId,
    row.certificationId,
    row.createdAt,
    row.ip,
    row.userAgent,
    row.sessionId,
    JSON.stringify(row.textVersionIds),
    row.textSha256,
    row.industry,
    JSON.stringify(row.warningsShown),
    JSON.stringify(row.boxesChecked),
    row.proofPdfSha256,
    row.proofPdfLocation,
    row.designFingerprint,
    row.listFingerprint,
  ]
}

export function createFileProofLog(filePath: string): ComplianceProofLog {
  const readAll = async (): Promise<ProofLogRow[]> => {
    let raw: string
    try {
      raw = await readFile(filePath, "utf8")
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return []
      throw error
    }
    return raw
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length > 0)
      .map((line) => JSON.parse(line) as ProofLogRow)
  }

  const byCreatedDesc = (rows: ProofLogRow[]) =>
    [...rows].sort((a, b) => (a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0))

  return {
    async append(row) {
      await mkdir(path.dirname(filePath), { recursive: true })
      await appendFile(filePath, `${JSON.stringify(row)}\n`, "utf8")
    },
    async latestAccountAcceptance(accountId) {
      const rows = await readAll()
      return (
        byCreatedDesc(rows).find(
          (row) => row.accountId === accountId && row.eventType === "account_clickwrap"
        ) ?? null
      )
    },
    async latestCampaignCertification(campaignId) {
      const rows = await readAll()
      return (
        byCreatedDesc(rows).find(
          (row) => row.campaignId === campaignId && row.eventType === "campaign_certification"
        ) ?? null
      )
    },
    async listForCampaign(campaignId) {
      const rows = await readAll()
      return byCreatedDesc(rows).filter((row) => row.campaignId === campaignId)
    },
  }
}

export function createPostgresProofLog(executor: SqlExecutor): ComplianceProofLog {
  let ensuring: Promise<void> | null = null

  const ensure = (): Promise<void> => {
    if (!ensuring) {
      ensuring = (async () => {
        for (const statement of [CREATE_TABLE, CREATE_ACCOUNT_INDEX, CREATE_CAMPAIGN_INDEX]) {
          try {
            await executor.query(statement)
          } catch (error) {
            if (!isBenignCreateRace(error)) throw error
          }
        }
      })().catch((error: unknown) => {
        ensuring = null
        throw error
      })
    }
    return ensuring
  }

  return {
    async append(row) {
      await ensure()
      await executor.query(INSERT_SQL, insertParams(row))
    },
    async latestAccountAcceptance(accountId) {
      await ensure()
      const rows = await executor.query<Record<string, unknown>>(
        `SELECT ${SELECT_COLUMNS} FROM ${TABLE}
         WHERE account_id = $1 AND event_type = $2
         ORDER BY created_at DESC
         LIMIT 1`,
        [accountId, "account_clickwrap"]
      )
      return rows[0] ? mapRow(rows[0]) : null
    },
    async latestCampaignCertification(campaignId) {
      await ensure()
      const rows = await executor.query<Record<string, unknown>>(
        `SELECT ${SELECT_COLUMNS} FROM ${TABLE}
         WHERE campaign_id = $1 AND event_type = $2
         ORDER BY created_at DESC
         LIMIT 1`,
        [campaignId, "campaign_certification"]
      )
      return rows[0] ? mapRow(rows[0]) : null
    },
    async listForCampaign(campaignId) {
      await ensure()
      const rows = await executor.query<Record<string, unknown>>(
        `SELECT ${SELECT_COLUMNS} FROM ${TABLE}
         WHERE campaign_id = $1
         ORDER BY created_at DESC`,
        [campaignId]
      )
      return rows.map((row) => mapRow(row))
    },
  }
}

const neonExecutors = new Map<string, SqlExecutor>()

function sharedExecutor(connectionString: string): SqlExecutor {
  let executor = neonExecutors.get(connectionString)
  if (!executor) {
    executor = createNeonExecutor(connectionString)
    neonExecutors.set(connectionString, executor)
  }
  return executor
}

/**
 * Postgres when DATABASE_URL or POSTGRES_URL is set.
 * Otherwise one JSON line per acceptance under .data/compliance/.
 * Pass filePath or executor to pin a mode. An explicit executor wins.
 */
export function createComplianceProofLog(options?: {
  filePath?: string
  executor?: SqlExecutor
}): ComplianceProofLog {
  if (options?.executor) return createPostgresProofLog(options.executor)
  if (options?.filePath) return createFileProofLog(options.filePath)
  const url = postgresUrl()
  if (url) return createPostgresProofLog(sharedExecutor(url))
  return createFileProofLog(defaultLogPath())
}

let singleton: ComplianceProofLog | null = null

export function getComplianceProofLog(): ComplianceProofLog {
  if (!singleton) singleton = createComplianceProofLog()
  return singleton
}

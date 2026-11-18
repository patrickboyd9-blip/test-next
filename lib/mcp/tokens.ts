import { createHash, randomBytes, randomUUID, timingSafeEqual } from "node:crypto"

import { createNeonExecutor, postgresUrl, type SqlExecutor } from "@/lib/storage/document-store"

import { ensureMcpTables } from "./schema"

export type TokenKind = "personal" | "access" | "refresh"

interface StoredToken {
  id: string
  userId: string
  name: string
  tokenHash: string
  familyId: string
  kind: TokenKind
  createdAt: string
  expiresAt: string | null
  revokedAt: string | null
  lastUsedAt: string | null
}

export interface PublicToken {
  id: string
  name: string
  createdAt: string
  lastUsedAt: string | null
  expiresAt: string | null
}

const memory: StoredToken[] = []

export function resetAssistantTokens(): void {
  memory.length = 0
}

export async function createAssistantToken(input: {
  userId: string
  name: string
  kind?: TokenKind
  familyId?: string
  expiresAt?: string | null
  env?: NodeJS.ProcessEnv
}): Promise<{ id: string; secret: string; familyId: string }> {
  const secret = `mm_${randomBytes(32).toString("base64url")}`
  const record: StoredToken = {
    id: randomUUID(),
    userId: input.userId,
    name: input.name.trim().slice(0, 80) || "Assistant",
    tokenHash: hashToken(secret),
    familyId: input.familyId ?? randomUUID(),
    kind: input.kind ?? "personal",
    createdAt: new Date().toISOString(),
    expiresAt: input.expiresAt ?? null,
    revokedAt: null,
    lastUsedAt: null,
  }
  await insertToken(record, input.env ?? process.env)
  return { id: record.id, secret, familyId: record.familyId }
}

export async function listAssistantTokens(userId: string, env: NodeJS.ProcessEnv = process.env): Promise<PublicToken[]> {
  const rows = await tokensForUser(userId, env)
  return rows
    .filter((row) => row.kind !== "refresh" && !row.revokedAt)
    .map((row) => ({
      id: row.id,
      name: row.name,
      createdAt: row.createdAt,
      lastUsedAt: row.lastUsedAt,
      expiresAt: row.expiresAt,
    }))
}

export async function revokeAssistantToken(userId: string, tokenId: string, env: NodeJS.ProcessEnv = process.env): Promise<boolean> {
  const rows = await tokensForUser(userId, env)
  const match = rows.find((row) => row.id === tokenId)
  if (!match) return false
  const now = new Date().toISOString()
  if (!postgresUrl(env)) {
    let changed = false
    for (const row of memory) {
      if (row.userId === userId && row.familyId === match.familyId && !row.revokedAt) {
        row.revokedAt = now
        changed = true
      }
    }
    return changed
  }
  const sql = neon(env)
  await ensureMcpTables(sql)
  await sql.query(
    `UPDATE assistant_tokens SET revoked_at = $1 WHERE user_id = $2 AND family_id = $3 AND revoked_at IS NULL`,
    [now, userId, match.familyId]
  )
  return true
}

/** Revoke the whole connection that this secret belongs to. The secret is not stored. */
export async function revokeTokenSecret(secret: string, env: NodeJS.ProcessEnv = process.env): Promise<boolean> {
  const row = await findByHash(hashToken(secret), env)
  if (!row) return false
  return revokeAssistantToken(row.userId, row.id, env)
}

/** Bearer tokens the assistant sends. Refresh tokens are not accepted here. */
export async function resolveAssistantToken(
  secret: string,
  env: NodeJS.ProcessEnv = process.env,
  now = Date.now()
): Promise<{ userId: string; tokenId: string } | null> {
  const tokenHash = hashToken(secret)
  const row = await findByHash(tokenHash, env)
  if (!row || row.revokedAt || row.kind === "refresh") return null
  if (row.expiresAt && Date.parse(row.expiresAt) <= now) return null
  await touch(row.id, env, now)
  return { userId: row.userId, tokenId: row.id }
}

export async function resolveRefreshToken(
  secret: string,
  env: NodeJS.ProcessEnv = process.env,
  now = Date.now()
): Promise<{ userId: string; familyId: string; name: string } | null> {
  const row = await findByHash(hashToken(secret), env)
  if (!row || row.revokedAt || row.kind !== "refresh") return null
  if (row.expiresAt && Date.parse(row.expiresAt) <= now) return null
  return { userId: row.userId, familyId: row.familyId, name: row.name }
}

function hashToken(secret: string): string {
  return createHash("sha256").update(secret).digest("hex")
}

async function insertToken(record: StoredToken, env: NodeJS.ProcessEnv): Promise<void> {
  if (!postgresUrl(env)) {
    memory.push(record)
    return
  }
  const sql = neon(env)
  await ensureMcpTables(sql)
  await sql.query(
    `INSERT INTO assistant_tokens
      (id, user_id, name, token_hash, family_id, kind, created_at, expires_at, revoked_at, last_used_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
    [
      record.id,
      record.userId,
      record.name,
      record.tokenHash,
      record.familyId,
      record.kind,
      record.createdAt,
      record.expiresAt,
      record.revokedAt,
      record.lastUsedAt,
    ]
  )
}

async function tokensForUser(userId: string, env: NodeJS.ProcessEnv): Promise<StoredToken[]> {
  if (!postgresUrl(env)) return memory.filter((row) => row.userId === userId)
  const sql = neon(env)
  await ensureMcpTables(sql)
  const rows = await sql.query<TokenRow>(
    `SELECT id, user_id, name, token_hash, family_id, kind, created_at, expires_at, revoked_at, last_used_at
     FROM assistant_tokens WHERE user_id = $1`,
    [userId]
  )
  return rows.map(toToken)
}

async function findByHash(tokenHash: string, env: NodeJS.ProcessEnv): Promise<StoredToken | null> {
  if (!postgresUrl(env)) {
    const row = memory.find((item) => safeEqual(item.tokenHash, tokenHash))
    return row ?? null
  }
  const sql = neon(env)
  await ensureMcpTables(sql)
  const rows = await sql.query<TokenRow>(
    `SELECT id, user_id, name, token_hash, family_id, kind, created_at, expires_at, revoked_at, last_used_at
     FROM assistant_tokens WHERE token_hash = $1`,
    [tokenHash]
  )
  return rows[0] ? toToken(rows[0]) : null
}

async function touch(id: string, env: NodeJS.ProcessEnv, now: number): Promise<void> {
  const stamp = new Date(now).toISOString()
  if (!postgresUrl(env)) {
    const row = memory.find((item) => item.id === id)
    if (row) row.lastUsedAt = stamp
    return
  }
  const sql = neon(env)
  await ensureMcpTables(sql)
  await sql.query(`UPDATE assistant_tokens SET last_used_at = $1 WHERE id = $2`, [stamp, id])
}

function safeEqual(left: string, right: string): boolean {
  const a = Buffer.from(left)
  const b = Buffer.from(right)
  if (a.length !== b.length) return false
  return timingSafeEqual(a, b)
}

function neon(env: NodeJS.ProcessEnv): SqlExecutor {
  const url = postgresUrl(env)
  if (!url) throw new Error("Postgres is not configured.")
  return createNeonExecutor(url)
}

interface TokenRow extends Record<string, unknown> {
  id: string
  user_id: string
  name: string
  token_hash: string
  family_id: string
  kind: TokenKind
  created_at: string | Date
  expires_at: string | Date | null
  revoked_at: string | Date | null
  last_used_at: string | Date | null
}

function stamp(value: string | Date | null): string | null {
  if (!value) return null
  return value instanceof Date ? value.toISOString() : String(value)
}

function toToken(row: TokenRow): StoredToken {
  return {
    id: row.id,
    userId: row.user_id,
    name: row.name,
    tokenHash: row.token_hash,
    familyId: row.family_id,
    kind: row.kind,
    createdAt: stamp(row.created_at) ?? new Date(0).toISOString(),
    expiresAt: stamp(row.expires_at),
    revokedAt: stamp(row.revoked_at),
    lastUsedAt: stamp(row.last_used_at),
  }
}

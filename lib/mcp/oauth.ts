import { createHash, randomBytes, randomUUID, timingSafeEqual } from "node:crypto"

import { createNeonExecutor, postgresUrl, type SqlExecutor } from "@/lib/storage/document-store"

import { ensureMcpTables } from "./schema"
import { createAssistantToken, resolveRefreshToken, revokeTokenSecret } from "./tokens"

const CODE_TTL_MS = 5 * 60 * 1000
const ACCESS_TTL_MS = 30 * 24 * 60 * 60 * 1000

interface ClientRecord {
  id: string
  name: string
  redirectUris: string[]
  createdAt: string
}

interface CodeRecord {
  codeHash: string
  userId: string
  clientId: string
  redirectUri: string
  challenge: string
  expiresAt: number
}

const clients: ClientRecord[] = []
const codes: CodeRecord[] = []

export function resetOAuthStore(): void {
  clients.length = 0
  codes.length = 0
}

export function authorizationServerMetadata(origin: string) {
  return {
    issuer: origin,
    authorization_endpoint: `${origin}/api/mcp/oauth/authorize`,
    token_endpoint: `${origin}/api/mcp/oauth/token`,
    registration_endpoint: `${origin}/api/mcp/oauth/register`,
    response_types_supported: ["code"],
    grant_types_supported: ["authorization_code", "refresh_token"],
    code_challenge_methods_supported: ["S256"],
    token_endpoint_auth_methods_supported: ["none"],
    scopes_supported: ["mail"],
  }
}

export function protectedResourceMetadata(origin: string) {
  return {
    resource: `${origin}/api/mcp`,
    authorization_servers: [origin],
    bearer_methods_supported: ["header"],
    scopes_supported: ["mail"],
  }
}

export async function registerOAuthClient(
  input: { client_name?: string; redirect_uris?: string[] },
  env: NodeJS.ProcessEnv = process.env
): Promise<{ client_id: string; client_name: string; redirect_uris: string[]; token_endpoint_auth_method: "none" } | { error: string }> {
  const redirects = (input.redirect_uris ?? []).filter((uri) => allowedRedirect(uri))
  if (redirects.length === 0) return { error: "Add an https redirect address." }
  const record: ClientRecord = {
    id: randomUUID(),
    name: (input.client_name ?? "Assistant").trim().slice(0, 80) || "Assistant",
    redirectUris: redirects,
    createdAt: new Date().toISOString(),
  }
  if (!postgresUrl(env)) clients.push(record)
  else {
    const sql = neon(env)
    await ensureMcpTables(sql)
    await sql.query(`INSERT INTO oauth_clients (id, name, redirect_uris, created_at) VALUES ($1, $2, $3, $4)`, [
      record.id,
      record.name,
      JSON.stringify(record.redirectUris),
      record.createdAt,
    ])
  }
  return {
    client_id: record.id,
    client_name: record.name,
    redirect_uris: record.redirectUris,
    token_endpoint_auth_method: "none",
  }
}

export async function issueAuthorizationCode(input: {
  userId: string
  clientId: string
  redirectUri: string
  challenge: string
  method: string
  env?: NodeJS.ProcessEnv
  now?: number
}): Promise<{ code: string } | { error: string }> {
  if (input.method !== "S256" || input.challenge.trim().length < 20) {
    return { error: "The connection has to use a secure code check." }
  }
  const client = await findClient(input.clientId, input.env ?? process.env)
  if (!client || !client.redirectUris.includes(input.redirectUri)) return { error: "That connection is not registered." }
  const code = randomBytes(32).toString("base64url")
  const record: CodeRecord = {
    codeHash: hash(code),
    userId: input.userId,
    clientId: input.clientId,
    redirectUri: input.redirectUri,
    challenge: input.challenge,
    expiresAt: (input.now ?? Date.now()) + CODE_TTL_MS,
  }
  const env = input.env ?? process.env
  if (!postgresUrl(env)) codes.push(record)
  else {
    const sql = neon(env)
    await ensureMcpTables(sql)
    await sql.query(
      `INSERT INTO oauth_codes (code_hash, user_id, client_id, redirect_uri, challenge, expires_at) VALUES ($1, $2, $3, $4, $5, $6)`,
      [record.codeHash, record.userId, record.clientId, record.redirectUri, record.challenge, new Date(record.expiresAt).toISOString()]
    )
  }
  return { code }
}

export async function exchangeAuthorizationCode(input: {
  code: string
  clientId: string
  redirectUri: string
  verifier: string
  env?: NodeJS.ProcessEnv
  now?: number
}): Promise<{ access_token: string; refresh_token: string; expires_in: number; token_type: "Bearer"; scope: "mail" } | { error: string }> {
  const env = input.env ?? process.env
  const now = input.now ?? Date.now()
  const record = await takeCode(hash(input.code), env)
  if (!record || record.expiresAt <= now) return { error: "That sign-in code expired. Connect again." }
  if (record.clientId !== input.clientId || record.redirectUri !== input.redirectUri) {
    return { error: "That sign-in code does not match this connection." }
  }
  const expected = createHash("sha256").update(input.verifier).digest("base64url")
  if (!safeEqual(expected, record.challenge)) return { error: "The connection check failed. Connect again." }
  return issuePair(record.userId, "Assistant connection", env, now)
}

export async function exchangeRefreshToken(
  secret: string,
  env: NodeJS.ProcessEnv = process.env,
  now = Date.now()
): Promise<{ access_token: string; refresh_token: string; expires_in: number; token_type: "Bearer"; scope: "mail" } | { error: string }> {
  const current = await resolveRefreshToken(secret, env, now)
  if (!current) return { error: "That connection expired. Connect again." }
  const issued = await issuePair(current.userId, current.name.replace(/ refresh$/, ""), env, now)
  await revokeTokenSecret(secret, env)
  return issued
}

async function issuePair(userId: string, name: string, env: NodeJS.ProcessEnv, now: number) {
  const familyId = randomUUID()
  const expiresAt = new Date(now + ACCESS_TTL_MS).toISOString()
  const access = await createAssistantToken({ userId, name, kind: "access", familyId, expiresAt, env })
  const refresh = await createAssistantToken({
    userId,
    name: `${name} refresh`,
    kind: "refresh",
    familyId,
    expiresAt,
    env,
  })
  return {
    access_token: access.secret,
    refresh_token: refresh.secret,
    expires_in: Math.floor(ACCESS_TTL_MS / 1000),
    token_type: "Bearer" as const,
    scope: "mail" as const,
  }
}

function allowedRedirect(uri: string): boolean {
  try {
    const url = new URL(uri)
    if (url.username || url.password) return false
    if (url.protocol === "https:") return true
    const local = url.hostname === "localhost" || url.hostname === "127.0.0.1"
    return url.protocol === "http:" && local
  } catch {
    return false
  }
}

async function findClient(id: string, env: NodeJS.ProcessEnv): Promise<ClientRecord | null> {
  if (!postgresUrl(env)) return clients.find((client) => client.id === id) ?? null
  const sql = neon(env)
  await ensureMcpTables(sql)
  const rows = await sql.query<{ id: string; name: string; redirect_uris: string; created_at: string | Date }>(
    `SELECT id, name, redirect_uris, created_at FROM oauth_clients WHERE id = $1`,
    [id]
  )
  const row = rows[0]
  if (!row) return null
  const raw = typeof row.redirect_uris === "string" ? row.redirect_uris : JSON.stringify(row.redirect_uris)
  return {
    id: row.id,
    name: row.name,
    redirectUris: JSON.parse(raw) as string[],
    createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
  }
}

async function takeCode(codeHash: string, env: NodeJS.ProcessEnv): Promise<CodeRecord | null> {
  if (!postgresUrl(env)) {
    const index = codes.findIndex((row) => safeEqual(row.codeHash, codeHash))
    if (index < 0) return null
    const [row] = codes.splice(index, 1)
    return row ?? null
  }
  const sql = neon(env)
  await ensureMcpTables(sql)
  const rows = await sql.query<{
    code_hash: string
    user_id: string
    client_id: string
    redirect_uri: string
    challenge: string
    expires_at: string | Date
  }>(`SELECT code_hash, user_id, client_id, redirect_uri, challenge, expires_at FROM oauth_codes WHERE code_hash = $1`, [codeHash])
  const row = rows[0]
  if (!row) return null
  await sql.query(`DELETE FROM oauth_codes WHERE code_hash = $1`, [codeHash])
  return {
    codeHash: row.code_hash,
    userId: row.user_id,
    clientId: row.client_id,
    redirectUri: row.redirect_uri,
    challenge: row.challenge,
    expiresAt: Date.parse(row.expires_at instanceof Date ? row.expires_at.toISOString() : String(row.expires_at)),
  }
}

function hash(value: string): string {
  return createHash("sha256").update(value).digest("hex")
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

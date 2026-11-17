import { createHash, randomBytes, randomUUID } from "node:crypto"

import { createNeonExecutor, postgresUrl, type SqlExecutor } from "@/lib/storage/document-store"
import { consumeRate } from "@/lib/ops/rate-limit"

import { ensureAuthTables } from "./schema"
import { hashPassword, passwordAccepted, passwordMatches } from "./passwords"
import { sendAuthMail } from "./mail"

export interface AuthUser {
  id: string
  email: string
  name: string
  businessName: string
  passwordHash: string | null
  emailVerifiedAt: string | null
}

interface TokenRow {
  email: string
  purpose: "verify" | "reset"
  tokenHash: string
  expiresAt: number
}

const users = new Map<string, AuthUser>()
const accounts = new Map<string, { userId: string }>()
const tokens: TokenRow[] = []

export function resetAuthStore(): void {
  users.clear()
  accounts.clear()
  tokens.length = 0
}

function emailKey(email: string): string {
  return email.trim().toLowerCase()
}

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex")
}

export async function registerPasswordAccount(input: {
  email: string
  password: string
  name: string
  businessName: string
  origin: string
  env?: NodeJS.ProcessEnv
  fetchImpl?: typeof fetch
  now?: number
}): Promise<{ ok: true; user: AuthUser; notice: string } | { ok: false; message: string }> {
  const env = input.env ?? process.env
  const email = emailKey(input.email)
  if (!email.includes("@") || email.length > 200) return { ok: false, message: "Enter an email address." }
  if (!passwordAccepted(input.password)) return { ok: false, message: "Use at least 10 characters." }
  if (!(await consumeRate(`sign-up:${email}`, 5, 10 * 60_000, input.now ?? Date.now())).ok) {
    return { ok: false, message: "Too many attempts. Wait a moment and try again." }
  }
  if (await findUserByEmail(email, env)) return { ok: false, message: "An account with that email already exists." }
  const user: AuthUser = {
    id: randomUUID(),
    email,
    name: input.name.trim() || email,
    businessName: input.businessName.trim(),
    passwordHash: await hashPassword(input.password),
    emailVerifiedAt: null,
  }
  await insertUser(user, env)
  const token = randomBytes(24).toString("base64url")
  await saveToken(email, "verify", token, (input.now ?? Date.now()) + 24 * 60 * 60 * 1000, env)
  const mail = await sendAuthMail(
    {
      to: email,
      subject: "Verify your Modern Mail email",
      text: `Verify your email: ${input.origin}/verify?token=${token}`,
    },
    env,
    input.fetchImpl
  )
  return { ok: true, user, notice: mail.notice }
}

export async function authenticatePassword(input: {
  email: string
  password: string
  env?: NodeJS.ProcessEnv
  now?: number
}): Promise<AuthUser | null> {
  const email = emailKey(input.email)
  if (!(await consumeRate(`sign-in:${email}`, 5, 10 * 60_000, input.now ?? Date.now())).ok) return null
  const user = await findUserByEmail(email, input.env ?? process.env)
  if (!user?.passwordHash) return null
  if (!(await passwordMatches(input.password, user.passwordHash))) return null
  return user
}

/**
 * Google may join an account only when that account's email is already verified.
 * An unverified password account is not taken over.
 */
export async function linkGoogleAccount(input: {
  email: string
  emailVerified: boolean
  name?: string | null
  googleId: string
  env?: NodeJS.ProcessEnv
}): Promise<{ ok: true; user: AuthUser; linked: boolean } | { ok: false; reason: "unverified" }> {
  if (!input.emailVerified) return { ok: false, reason: "unverified" }
  const email = emailKey(input.email)
  const env = input.env ?? process.env
  const existingAccount = await findAccount("google", input.googleId, env)
  if (existingAccount) {
    const user = await findUserById(existingAccount.userId, env)
    if (user) return { ok: true, user, linked: true }
  }
  const existing = await findUserByEmail(email, env)
  if (existing) {
    if (!existing.emailVerifiedAt) return { ok: false, reason: "unverified" }
    await insertAccount(existing.id, "google", input.googleId, env)
    return { ok: true, user: existing, linked: true }
  }
  const user: AuthUser = {
    id: randomUUID(),
    email,
    name: input.name?.trim() || email,
    businessName: "",
    passwordHash: null,
    emailVerifiedAt: new Date().toISOString(),
  }
  await insertUser(user, env)
  await insertAccount(user.id, "google", input.googleId, env)
  return { ok: true, user, linked: false }
}

export async function verifyEmailToken(token: string, env: NodeJS.ProcessEnv = process.env, now = Date.now()): Promise<boolean> {
  const email = await takeToken(token, "verify", env, now)
  if (!email) return false
  const user = await findUserByEmail(email, env)
  if (!user) return false
  user.emailVerifiedAt = new Date(now).toISOString()
  await updateUser(user, env)
  return true
}

export async function requestPasswordReset(input: {
  email: string
  origin: string
  env?: NodeJS.ProcessEnv
  fetchImpl?: typeof fetch
  now?: number
}): Promise<{ notice: string }> {
  const env = input.env ?? process.env
  const email = emailKey(input.email)
  const user = await findUserByEmail(email, env)
  const notice = "If that email has a password, a reset link is the next step. Nothing else changes."
  if (!user?.passwordHash) return { notice }
  const token = randomBytes(24).toString("base64url")
  await saveToken(email, "reset", token, (input.now ?? Date.now()) + 60 * 60 * 1000, env)
  const mail = await sendAuthMail(
    {
      to: email,
      subject: "Reset your Modern Mail password",
      text: `Reset your password: ${input.origin}/reset?token=${token}`,
    },
    env,
    input.fetchImpl
  )
  if (!mail.sent) return { notice: "Password reset email is not available yet. Your password was not changed." }
  return { notice }
}

export async function resetPassword(token: string, password: string, env: NodeJS.ProcessEnv = process.env, now = Date.now()): Promise<boolean> {
  if (!passwordAccepted(password)) return false
  const email = await takeToken(token, "reset", env, now)
  if (!email) return false
  const user = await findUserByEmail(email, env)
  if (!user) return false
  user.passwordHash = await hashPassword(password)
  await updateUser(user, env)
  return true
}

async function findUserByEmail(email: string, env: NodeJS.ProcessEnv = process.env): Promise<AuthUser | null> {
  if (!postgresUrl(env)) return [...users.values()].find((user) => user.email === emailKey(email)) ?? null
  const sql = neon(env)
  await ensureAuthTables(sql)
  const rows = await sql.query<{
    id: string
    email: string
    name: string
    business_name: string
    password_hash: string | null
    email_verified_at: string | Date | null
  }>(`SELECT id, email, name, business_name, password_hash, email_verified_at FROM users WHERE email = $1`, [emailKey(email)])
  const row = rows[0]
  return row ? toUser(row) : null
}

async function findUserById(id: string, env: NodeJS.ProcessEnv = process.env): Promise<AuthUser | null> {
  if (!postgresUrl(env)) return users.get(id) ?? null
  const sql = neon(env)
  await ensureAuthTables(sql)
  const rows = await sql.query<{
    id: string
    email: string
    name: string
    business_name: string
    password_hash: string | null
    email_verified_at: string | Date | null
  }>(`SELECT id, email, name, business_name, password_hash, email_verified_at FROM users WHERE id = $1`, [id])
  const row = rows[0]
  return row ? toUser(row) : null
}

async function findAccount(provider: string, providerAccountId: string, env: NodeJS.ProcessEnv = process.env) {
  const key = `${provider}:${providerAccountId}`
  if (!postgresUrl(env)) return accounts.get(key) ?? null
  const sql = neon(env)
  await ensureAuthTables(sql)
  const rows = await sql.query<{ user_id: string }>(
    `SELECT user_id FROM auth_accounts WHERE provider = $1 AND provider_account_id = $2`,
    [provider, providerAccountId]
  )
  const row = rows[0]
  return row ? { userId: row.user_id } : null
}

async function insertUser(user: AuthUser, env: NodeJS.ProcessEnv): Promise<void> {
  if (!postgresUrl(env)) {
    users.set(user.id, user)
    return
  }
  const sql = neon(env)
  await ensureAuthTables(sql)
  await sql.query(
    `INSERT INTO users (id, email, name, business_name, password_hash, email_verified_at, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [user.id, user.email, user.name, user.businessName, user.passwordHash, user.emailVerifiedAt, new Date().toISOString()]
  )
}

async function updateUser(user: AuthUser, env: NodeJS.ProcessEnv): Promise<void> {
  if (!postgresUrl(env)) {
    users.set(user.id, user)
    return
  }
  const sql = neon(env)
  await ensureAuthTables(sql)
  await sql.query(
    `UPDATE users SET name = $2, business_name = $3, password_hash = $4, email_verified_at = $5 WHERE id = $1`,
    [user.id, user.name, user.businessName, user.passwordHash, user.emailVerifiedAt]
  )
}

async function insertAccount(userId: string, provider: string, providerAccountId: string, env: NodeJS.ProcessEnv): Promise<void> {
  const key = `${provider}:${providerAccountId}`
  if (!postgresUrl(env)) {
    accounts.set(key, { userId })
    return
  }
  const sql = neon(env)
  await ensureAuthTables(sql)
  await sql.query(
    `INSERT INTO auth_accounts (id, user_id, provider, provider_account_id) VALUES ($1, $2, $3, $4)`,
    [randomUUID(), userId, provider, providerAccountId]
  )
}

async function saveToken(email: string, purpose: TokenRow["purpose"], token: string, expiresAt: number, env: NodeJS.ProcessEnv): Promise<void> {
  const row = { email, purpose, tokenHash: hashToken(token), expiresAt }
  if (!postgresUrl(env)) {
    tokens.push(row)
    return
  }
  const sql = neon(env)
  await ensureAuthTables(sql)
  await sql.query(
    `INSERT INTO auth_tokens (id, email, purpose, token_hash, expires_at, created_at) VALUES ($1, $2, $3, $4, $5, $6)`,
    [randomUUID(), email, purpose, row.tokenHash, new Date(expiresAt).toISOString(), new Date().toISOString()]
  )
}

async function takeToken(token: string, purpose: TokenRow["purpose"], env: NodeJS.ProcessEnv, now: number): Promise<string | null> {
  const tokenHash = hashToken(token)
  if (!postgresUrl(env)) {
    const index = tokens.findIndex((row) => row.tokenHash === tokenHash && row.purpose === purpose && row.expiresAt > now)
    if (index < 0) return null
    const row = tokens[index]
    tokens.splice(index, 1)
    return row?.email ?? null
  }
  const sql = neon(env)
  await ensureAuthTables(sql)
  const rows = await sql.query<{ email: string }>(
    `SELECT email FROM auth_tokens WHERE token_hash = $1 AND purpose = $2 AND expires_at > $3`,
    [tokenHash, purpose, new Date(now).toISOString()]
  )
  const row = rows[0]
  if (!row) return null
  await sql.query(`DELETE FROM auth_tokens WHERE token_hash = $1 AND purpose = $2`, [tokenHash, purpose])
  return row.email
}

function neon(env: NodeJS.ProcessEnv): SqlExecutor {
  const url = postgresUrl(env)
  if (!url) throw new Error("Postgres is not configured.")
  return createNeonExecutor(url)
}

function toUser(row: {
  id: string
  email: string
  name: string
  business_name: string
  password_hash: string | null
  email_verified_at: string | Date | null
}): AuthUser {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    businessName: row.business_name,
    passwordHash: row.password_hash,
    emailVerifiedAt: row.email_verified_at instanceof Date ? row.email_verified_at.toISOString() : row.email_verified_at,
  }
}

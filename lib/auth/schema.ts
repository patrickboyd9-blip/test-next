import { isBenignCreateRace, type SqlExecutor } from "@/lib/storage/document-store"

export const AUTH_DDL = [
  `CREATE TABLE IF NOT EXISTS users (
    id text PRIMARY KEY,
    email text NOT NULL UNIQUE,
    name text NOT NULL,
    business_name text NOT NULL DEFAULT '',
    password_hash text,
    email_verified_at timestamptz,
    created_at timestamptz NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS auth_accounts (
    id text PRIMARY KEY,
    user_id text NOT NULL,
    provider text NOT NULL,
    provider_account_id text NOT NULL,
    UNIQUE (provider, provider_account_id)
  )`,
  `CREATE TABLE IF NOT EXISTS auth_tokens (
    id text PRIMARY KEY,
    email text NOT NULL,
    purpose text NOT NULL,
    token_hash text NOT NULL,
    expires_at timestamptz NOT NULL,
    created_at timestamptz NOT NULL
  )`,
] as const

const ready = new WeakMap<SqlExecutor, Promise<void>>()

export function ensureAuthTables(sql: SqlExecutor): Promise<void> {
  let pending = ready.get(sql)
  if (!pending) {
    pending = (async () => {
      for (const statement of AUTH_DDL) {
        try {
          await sql.query(statement)
        } catch (error) {
          if (!isBenignCreateRace(error)) throw error
        }
      }
    })().catch((error: unknown) => {
      ready.delete(sql)
      throw error
    })
    ready.set(sql, pending)
  }
  return pending
}

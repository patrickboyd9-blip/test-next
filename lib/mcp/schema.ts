import { isBenignCreateRace, type SqlExecutor } from "@/lib/storage/document-store"

/**
 * Tables for assistant tokens, saved lists, and the sign-in connection.
 * Separate from the ops audit tables so those stay append-only.
 */
export const MCP_DDL = [
  `CREATE TABLE IF NOT EXISTS assistant_tokens (
    id text PRIMARY KEY,
    user_id text NOT NULL,
    name text NOT NULL,
    token_hash text NOT NULL UNIQUE,
    family_id text NOT NULL,
    kind text NOT NULL,
    created_at timestamptz NOT NULL,
    expires_at timestamptz,
    revoked_at timestamptz,
    last_used_at timestamptz
  )`,
  `CREATE TABLE IF NOT EXISTS customer_lists (
    id text PRIMARY KEY,
    owner_id text NOT NULL,
    name text NOT NULL,
    csv text NOT NULL,
    created_at timestamptz NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS oauth_clients (
    id text PRIMARY KEY,
    name text NOT NULL,
    redirect_uris text NOT NULL,
    created_at timestamptz NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS oauth_codes (
    code_hash text PRIMARY KEY,
    user_id text NOT NULL,
    client_id text NOT NULL,
    redirect_uri text NOT NULL,
    challenge text NOT NULL,
    expires_at timestamptz NOT NULL
  )`,
] as const

const ready = new WeakMap<SqlExecutor, Promise<void>>()

export function ensureMcpTables(sql: SqlExecutor): Promise<void> {
  let pending = ready.get(sql)
  if (!pending) {
    pending = (async () => {
      for (const statement of MCP_DDL) {
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

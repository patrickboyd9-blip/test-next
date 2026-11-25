import { isBenignCreateRace, type SqlExecutor } from "@/lib/storage/document-store"

/**
 * Named lists stay on customer_lists (the table the assistant already uses).
 * Each address is its own row so one person can be added, edited, or removed.
 * A campaign points at one saved list. The list itself is not copied into a file.
 */
export const ADDRESS_BOOK_DDL = [
  `CREATE TABLE IF NOT EXISTS customer_lists (
    id text PRIMARY KEY,
    owner_id text NOT NULL,
    name text NOT NULL,
    csv text NOT NULL,
    created_at timestamptz NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS customer_list_entries (
    id text PRIMARY KEY,
    list_id text NOT NULL,
    owner_id text NOT NULL,
    first_name text NOT NULL,
    last_name text NOT NULL,
    organization text NOT NULL DEFAULT '',
    address1 text NOT NULL,
    address2 text NOT NULL DEFAULT '',
    city text NOT NULL,
    state text NOT NULL,
    zip text NOT NULL,
    created_at timestamptz NOT NULL,
    updated_at timestamptz NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS customer_list_entries_owner_list_idx
    ON customer_list_entries (owner_id, list_id)`,
  `CREATE TABLE IF NOT EXISTS campaign_address_lists (
    owner_id text NOT NULL,
    campaign_id text NOT NULL,
    list_id text NOT NULL,
    job_id text,
    updated_at timestamptz NOT NULL,
    PRIMARY KEY (owner_id, campaign_id)
  )`,
] as const

const ready = new WeakMap<SqlExecutor, Promise<void>>()

export function ensureAddressBookTables(sql: SqlExecutor): Promise<void> {
  let pending = ready.get(sql)
  if (!pending) {
    pending = (async () => {
      for (const statement of ADDRESS_BOOK_DDL) {
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

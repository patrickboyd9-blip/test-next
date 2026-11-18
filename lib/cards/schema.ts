import { isBenignCreateRace, type SqlExecutor } from "@/lib/storage/document-store"

export const CARD_DDL = [
  `CREATE TABLE IF NOT EXISTS card_people (
    id text PRIMARY KEY,
    owner_id text NOT NULL,
    data jsonb NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS greeting_cards (
    id text PRIMARY KEY,
    owner_id text NOT NULL,
    person_id text NOT NULL,
    data jsonb NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS card_redirects (
    code text PRIMARY KEY,
    owner_id text NOT NULL,
    data jsonb NOT NULL
  )`,
] as const

const ready = new WeakMap<SqlExecutor, Promise<void>>()

export function ensureCardTables(sql: SqlExecutor): Promise<void> {
  let pending = ready.get(sql)
  if (!pending) {
    pending = (async () => {
      for (const statement of CARD_DDL) {
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

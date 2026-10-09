import type { SqlExecutor } from "./document-store"

interface Row {
  data: unknown
}

/**
 * In-memory stand-in for the Neon executor. Tests only.
 * Understands the document-store statements and nothing else.
 */
export class MemorySql implements SqlExecutor {
  readonly tables = new Map<string, Map<string, Row>>()
  readonly statements: string[] = []
  /** Fail this many CREATE TABLE calls with a concurrent-create error. */
  failCreates = 0
  /** Return jsonb as a string, the way some drivers do. */
  returnDataAsString = false

  async query<T extends Record<string, unknown>>(
    text: string,
    params: readonly unknown[] = []
  ): Promise<T[]> {
    const sql = text.replace(/\s+/g, " ").trim()
    this.statements.push(sql)

    if (sql.startsWith("CREATE TABLE")) {
      const table = /CREATE TABLE IF NOT EXISTS ([a-z_]+)/.exec(sql)?.[1]
      if (!table) throw new Error(`Unparsed DDL: ${sql}`)
      if (!this.tables.has(table)) this.tables.set(table, new Map())
      if (this.failCreates > 0) {
        this.failCreates -= 1
        const error = new Error(
          'duplicate key value violates unique constraint "pg_type_typname_nsp_index"'
        )
        ;(error as { code?: string }).code = "23505"
        throw error
      }
      return []
    }

    if (sql.startsWith("SELECT")) {
      const table = /FROM ([a-z_]+)/.exec(sql)?.[1]
      if (!table) throw new Error(`Unparsed SELECT: ${sql}`)
      const row = this.tables.get(table)?.get(String(params[0]))
      if (!row) return []
      const data = this.returnDataAsString ? JSON.stringify(row.data) : row.data
      return [{ data } as unknown as T]
    }

    if (sql.startsWith("INSERT")) {
      const table = /INTO ([a-z_]+)/.exec(sql)?.[1]
      if (!table) throw new Error(`Unparsed INSERT: ${sql}`)
      let bucket = this.tables.get(table)
      if (!bucket) {
        bucket = new Map()
        this.tables.set(table, bucket)
      }
      const raw = params[1]
      const data = typeof raw === "string" ? JSON.parse(raw) : raw
      bucket.set(String(params[0]), { data })
      return []
    }

    throw new Error(`Unexpected SQL: ${sql}`)
  }
}

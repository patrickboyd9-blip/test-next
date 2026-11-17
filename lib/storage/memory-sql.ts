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

    if (sql.includes("audit_events") || sql.includes("rate_events")) {
      return this.opsQuery<T>(sql, params)
    }

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
      const bucket = this.tables.get(table)
      const present = (row: Row): T => {
        const data = this.returnDataAsString ? JSON.stringify(row.data) : row.data
        return { data } as unknown as T
      }
      if (!/\bWHERE\b/i.test(sql)) {
        if (!bucket) return []
        return [...bucket.values()].map(present)
      }
      const row = bucket?.get(String(params[0]))
      if (!row) return []
      return [present(row)]
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

  private opsQuery<T extends Record<string, unknown>>(sql: string, params: readonly unknown[]): T[] {
    if (/UPDATE|DELETE/i.test(sql)) throw new Error(`Refused SQL: ${sql}`)
    if (sql.startsWith("CREATE TABLE")) {
      const table = /CREATE TABLE IF NOT EXISTS ([a-z_]+)/.exec(sql)?.[1]
      if (!table) throw new Error(`Unparsed DDL: ${sql}`)
      if (!this.tables.has(table)) this.tables.set(table, new Map())
      return []
    }
    const table = sql.includes("audit_events") ? "audit_events" : "rate_events"
    let bucket = this.tables.get(table)
    if (!bucket) {
      bucket = new Map()
      this.tables.set(table, bucket)
    }
    if (sql.startsWith("INSERT") && table === "audit_events") {
      const row = {
        data: {
          id: String(params[0]),
          at: String(params[1]),
          actor_id: String(params[2]),
          action: String(params[3]),
          subject_id: String(params[4]),
          before: params[5] == null ? null : JSON.parse(String(params[5])),
          after: params[6] == null ? null : JSON.parse(String(params[6])),
        },
      }
      bucket.set(String(params[0]), row)
      return []
    }
    if (sql.startsWith("INSERT") && table === "rate_events") {
      const id = `rate-${bucket.size + 1}`
      bucket.set(id, { data: { key: String(params[0]), at_ms: Number(params[1]) } })
      return []
    }
    if (sql.startsWith("SELECT") && table === "rate_events") {
      const key = String(params[0])
      const since = Number(params[1])
      const count = [...bucket.values()].filter((row) => {
        const data = row.data as { key: string; at_ms: number }
        return data.key === key && data.at_ms > since
      }).length
      return [{ count } as unknown as T]
    }
    if (sql.startsWith("SELECT") && table === "audit_events") {
      const rows = [...bucket.values()].map((row) => row.data as T)
      if (!/\bWHERE\b/i.test(sql)) return rows
      return rows.filter((row) => {
        const data = row as { actor_id?: string; subject_id?: string; action?: string }
        return data.actor_id === params[0] && data.subject_id === params[1] && data.action === "approve"
      })
    }
    throw new Error(`Unexpected SQL: ${sql}`)
  }
}

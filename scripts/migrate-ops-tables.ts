import { createNeonExecutor, postgresUrl } from "@/lib/storage/document-store"

import { ensureOpsTables } from "@/lib/ops/schema"

/**
 * Creates audit_events and rate_events when DATABASE_URL or POSTGRES_URL is set.
 * Safe to run more than once. Does not insert, update, or delete a row.
 *
 *   npx tsx scripts/migrate-ops-tables.ts
 */
async function main(): Promise<void> {
  const url = postgresUrl()
  if (!url) {
    console.error("Set DATABASE_URL or POSTGRES_URL. Neither name is set in this process.")
    process.exitCode = 1
    return
  }
  const sql = createNeonExecutor(url)
  await ensureOpsTables(sql)
  const rows = await sql.query<{ table_name: string }>(
    `SELECT table_name FROM information_schema.tables
     WHERE table_schema = 'public' AND table_name IN ('audit_events', 'rate_events')
     ORDER BY table_name`
  )
  const names = rows.map((row) => row.table_name)
  if (names.length !== 2) {
    console.error(`Expected audit_events and rate_events. Found: ${names.join(", ") || "none"}.`)
    process.exitCode = 1
    return
  }
  console.log(`Ready: ${names.join(", ")}. No rows were written.`)
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "The migration failed.")
  process.exitCode = 1
})

import { createNeonExecutor, postgresUrl } from "@/lib/storage/document-store"

import { ensureCardTables } from "@/lib/cards/schema"

/**
 * Creates the personal and employee card tables.
 * Safe to run more than once. Does not mail or charge.
 *
 *   npx tsx scripts/migrate-card-tables.ts
 */
async function main(): Promise<void> {
  const url = postgresUrl()
  if (!url) {
    console.error("Set DATABASE_URL or POSTGRES_URL. Neither name is set in this process.")
    process.exitCode = 1
    return
  }
  const sql = createNeonExecutor(url)
  await ensureCardTables(sql)
  const rows = await sql.query<{ table_name: string }>(
    `SELECT table_name FROM information_schema.tables
     WHERE table_schema = 'public' AND table_name IN ('card_people', 'greeting_cards', 'card_redirects')
     ORDER BY table_name`,
  )
  const names = rows.map((row) => row.table_name)
  if (names.length !== 3) {
    console.error(`Expected the card tables. Found: ${names.join(", ") || "none"}.`)
    process.exitCode = 1
    return
  }
  console.log(`Ready: ${names.join(", ")}. No cards were mailed.`)
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "The migration failed.")
  process.exitCode = 1
})

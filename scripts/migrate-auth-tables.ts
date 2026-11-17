import { createNeonExecutor, postgresUrl } from "@/lib/storage/document-store"

import { ensureAuthTables } from "@/lib/auth/schema"

/**
 * Creates users, auth_accounts, and auth_tokens.
 * Safe to run more than once. Does not print the database URL.
 *
 *   npx tsx scripts/migrate-auth-tables.ts
 */
async function main(): Promise<void> {
  const url = postgresUrl()
  if (!url) {
    console.error("Set DATABASE_URL or POSTGRES_URL. Neither name is set in this process.")
    process.exitCode = 1
    return
  }
  const sql = createNeonExecutor(url)
  await ensureAuthTables(sql)
  const rows = await sql.query<{ table_name: string }>(
    `SELECT table_name FROM information_schema.tables
     WHERE table_schema = 'public' AND table_name IN ('users', 'auth_accounts', 'auth_tokens')
     ORDER BY table_name`
  )
  const names = rows.map((row) => row.table_name)
  if (names.length !== 3) {
    console.error(`Expected users, auth_accounts, and auth_tokens. Found: ${names.join(", ") || "none"}.`)
    process.exitCode = 1
    return
  }
  console.log(`Ready: ${names.join(", ")}.`)
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "The auth migration failed.")
  process.exitCode = 1
})

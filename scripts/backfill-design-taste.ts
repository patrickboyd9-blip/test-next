import { backfillDesignTaste } from "@/lib/design-intelligence/taste-backfill"

/**
 * Vision readings for reference images that do not have one yet.
 * Images stay out of git. Put them in .data/reference-library first.
 * Repeat until remaining is 0. Each run sends one batch.
 */

async function main(): Promise<void> {
  const batch = process.argv[2] ? Number(process.argv[2]) : undefined
  const report = await backfillDesignTaste({ batch, env: process.env })
  console.log(JSON.stringify(report, null, 2))
  if (report.status === "skipped") process.exitCode = 0
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})

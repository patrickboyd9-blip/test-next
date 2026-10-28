import { backfillBlueprints } from "@/lib/design-intelligence/blueprint-store"

/**
 * Writes a structural blueprint for every eligible mailer, then asks the
 * vision model to replace them in batches when ANTHROPIC_API_KEY is set.
 * Rows go to Neon when DATABASE_URL is set, otherwise to .data/blueprints.
 * Photographs stay out of git.
 *
 *   npx tsx scripts/backfill-blueprints.ts
 */

async function main() {
  const passes = Math.max(1, Math.min(40, Number(process.env.BLUEPRINT_PASSES ?? 8) || 8))
  for (let pass = 1; pass <= passes; pass += 1) {
    const report = await backfillBlueprints({ env: process.env })
    console.log(JSON.stringify({ pass, ...report }))
    if (report.pendingVision === 0 || report.vision.length === 0) break
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})

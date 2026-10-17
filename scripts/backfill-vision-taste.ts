import { backfillVisionTaste } from "@/lib/design-intelligence/vision-taste"

/**
 * Reads reference photographs from .data/reference-library (or
 * REFERENCE_LIBRARY_DIR) and writes vision-taste rows to Neon when
 * DATABASE_URL is set, otherwise to .data/vision-taste.
 * Repeats until the queue is empty or PASSES is reached.
 *
 *   npx tsx scripts/backfill-vision-taste.ts
 */

async function main() {
  const passes = Math.max(1, Math.min(40, Number(process.env.VISION_TASTE_PASSES ?? 8) || 8))
  for (let pass = 1; pass <= passes; pass += 1) {
    const report = await backfillVisionTaste({ env: process.env })
    console.log(JSON.stringify({ pass, ...report }))
    if (report.status === "skipped" || report.pending === 0 || report.analyzed.length === 0) break
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})

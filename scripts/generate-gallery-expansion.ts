import { createImagenImageGenerationAdapter } from "@/lib/campaign-creator/replicate-image-generation"
import { planGalleryExpansion } from "@/lib/mail-templates/gallery-expansion"
import { expansionModelName, runGalleryExpansion } from "@/lib/mail-templates/gallery-expansion-run"

/**
 * Original empty-scene pictures for the 144-mailer expansion.
 * Uses google/nano-banana-pro through the existing picture adapter.
 * Reads REPLICATE_API_TOKEN from the environment. Does not print it.
 *
 *   npx tsx scripts/generate-gallery-expansion.ts --dry-run
 *   npx tsx scripts/generate-gallery-expansion.ts --limit 1
 *   npx tsx scripts/generate-gallery-expansion.ts
 *
 * Pictures land in public/gallery. The spend log stays in .data.
 * No request starts if it would pass $22.00.
 */

async function main(): Promise<void> {
  const dryRun = process.argv.includes("--dry-run")
  const limitFlag = process.argv.indexOf("--limit")
  const limit = limitFlag === -1 ? undefined : Number(process.argv[limitFlag + 1])
  const unknown = process.argv.slice(2).filter((arg, index, all) => {
    if (arg === "--dry-run") return false
    if (arg === "--limit") return false
    if (all[index - 1] === "--limit") return false
    return true
  })
  if (unknown.length > 0 || (limitFlag !== -1 && (!Number.isInteger(limit) || (limit ?? 0) < 1))) {
    console.error("Use --dry-run, --limit N, or no arguments.")
    process.exitCode = 1
    return
  }

  const plan = planGalleryExpansion()
  console.log(`Expansion pictures: ${plan.images}`)
  console.log(`Estimate ${ (plan.estimatedCents / 100).toFixed(2) }. Hard cap ${ (plan.capCents / 100).toFixed(2) }.`)
  console.log(`Model ${expansionModelName()}.`)
  console.log(process.env.REPLICATE_API_TOKEN?.trim() ? "REPLICATE_API_TOKEN is set." : "REPLICATE_API_TOKEN is not set.")

  if (dryRun) {
    for (const item of plan.items.slice(0, limit ?? plan.items.length)) console.log(`${item.id}  ${item.publicPath}`)
    console.log("Dry run. No request was sent and no file was written.")
    return
  }
  if (!process.env.REPLICATE_API_TOKEN?.trim()) {
    console.error("Set REPLICATE_API_TOKEN. No photo was requested.")
    process.exitCode = 1
    return
  }

  const result = await runGalleryExpansion({
    limit,
    adapter: createImagenImageGenerationAdapter(),
  })
  console.log(`Requested ${result.requested}. Saved ${result.saved}. Spent ${ (result.spentCents / 100).toFixed(2) }. Stopped: ${result.stopped}.`)
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "The gallery expansion run failed.")
  process.exitCode = 1
})

import { backfillBlueprints, type BlueprintBackfillReport } from "./blueprint-store"
import { analyzeNewMailer } from "./model"
import { syncReferenceLibraries, type SyncReport } from "./sync"
import { backfillVisionTaste, type TasteBackfillReport } from "./vision-taste"
import { refreshResearchIndex } from "@/lib/research-library"
import type { CoverageStats } from "@/lib/research-library/types"

/**
 * Daily pull, then a small batch of vision-taste readings for mailers
 * that do not have one yet. The backfill endpoint clears the rest.
 */

export async function runDesignLibraryJob(env: NodeJS.ProcessEnv = process.env): Promise<SyncReport & { visionTaste: TasteBackfillReport; blueprints: BlueprintBackfillReport; researchIndex: CoverageStats }> {
  const report = await syncReferenceLibraries({
    env,
    analyze: env.ANTHROPIC_API_KEY?.trim()
      ? async (entry, bytes) => {
          const mediaType = bytes[0] === 0x89 ? "image/png" : "image/jpeg"
          return analyzeNewMailer({ id: entry.id, bytes, mediaType, env })
        }
      : undefined,
  })
  const visionTaste = await backfillVisionTaste({ env })
  const blueprints = await backfillBlueprints({ env })
  let researchIndex: CoverageStats = {
    discovered: 0,
    indexed: 0,
    skipped: 0,
    usable: 0,
    visual: 0,
    textOnly: 0,
    gold: 0,
    pending: 0,
  }
  try {
    const indexed = await refreshResearchIndex({ env, rounds: 4 })
    researchIndex = indexed.stats
  } catch (error) {
    report.errors.push(error instanceof Error ? error.message : "Research index failed.")
    report.status = "partial"
  }
  return { ...report, visionTaste, blueprints, researchIndex }
}

export function cronAuthorized(request: Request, env: NodeJS.ProcessEnv = process.env): boolean {
  const secret = env.CRON_SECRET?.trim()
  if (!secret) return false
  return request.headers.get("authorization") === `Bearer ${secret}`
}

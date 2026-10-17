import { analyzeNewMailer } from "./model"
import { syncReferenceLibraries, type SyncReport } from "./sync"
import { backfillVisionTaste, type TasteBackfillReport } from "./vision-taste"

/**
 * Daily pull, then a small batch of vision-taste readings for mailers
 * that do not have one yet. The backfill endpoint clears the rest.
 */

export async function runDesignLibraryJob(env: NodeJS.ProcessEnv = process.env): Promise<SyncReport & { visionTaste: TasteBackfillReport }> {
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
  return { ...report, visionTaste }
}

export function cronAuthorized(request: Request, env: NodeJS.ProcessEnv = process.env): boolean {
  const secret = env.CRON_SECRET?.trim()
  if (!secret) return false
  return request.headers.get("authorization") === `Bearer ${secret}`
}

import type { GeneratedAsset } from "./image-generation"
import {
  toImageBrief,
  type ImageBrief,
  type ImageBriefContext,
} from "./image-brief"
import type { CampaignBrief, CreativeSpec } from "./types"

/**
 * Cache identity for a conceived photograph.
 * Not a CreativeSpec field. Same function on the server and in Studio views.
 */
export interface StudioImageRecord {
  directionId: string
  fingerprint: string
  asset: GeneratedAsset
  /** Final wins over a preview of the same photograph when both are loaded. */
  tier?: "preview" | "final"
}

export function imageBriefContextFor(
  directionId: string,
  campaign?: CampaignBrief
): ImageBriefContext {
  return { campaign, variationKey: directionId }
}

export function imageBriefFingerprint(brief: ImageBrief): string {
  const art = brief.artDirection
  const raw = [
    brief.imageryRole,
    brief.occupancy,
    brief.leadJob,
    brief.tone?.trim() ?? "",
    brief.visualDirection.trim(),
    art.revision,
    art.trade,
    art.subject,
    art.lighting,
    art.framing,
    art.emotion,
    art.refuse,
    art.negativeSpace,
    art.craft ?? "",
    brief.lookBlock,
  ].join("\u001f")
  return fnv(raw) + fnv(`${raw}#`)
}

export function fingerprintForSpec(
  spec: CreativeSpec,
  context: ImageBriefContext = {}
): string | null {
  const brief = toImageBrief(spec, context)
  if (!brief) return null
  return imageBriefFingerprint(brief)
}

export function lookupStudioImage(
  records: readonly StudioImageRecord[],
  directionId: string,
  spec: CreativeSpec,
  campaign?: CampaignBrief
): GeneratedAsset | null {
  const fingerprint = fingerprintForSpec(
    spec,
    imageBriefContextFor(directionId, campaign)
  )
  if (!fingerprint) return null
  const matches = records.filter(
    (record) =>
      record.directionId === directionId && record.fingerprint === fingerprint
  )
  const chosen =
    matches.find((record) => record.tier === "final") ?? matches[0]
  return chosen?.asset ?? null
}

export function studioImageEntries(
  creative: {
    directions: readonly { id: string; spec: CreativeSpec }[]
    selectedDirectionId?: string
    activeSpec?: CreativeSpec
  },
  campaign?: CampaignBrief
): Array<{ directionId: string; spec: CreativeSpec }> {
  const entries: Array<{ directionId: string; spec: CreativeSpec }> = []
  for (const direction of creative.directions) {
    entries.push({ directionId: direction.id, spec: direction.spec })
    const context = imageBriefContextFor(direction.id, campaign)
    if (
      direction.id === creative.selectedDirectionId &&
      creative.activeSpec &&
      fingerprintForSpec(creative.activeSpec, context) &&
      fingerprintForSpec(creative.activeSpec, context) !==
        fingerprintForSpec(direction.spec, context)
    ) {
      entries.push({
        directionId: direction.id,
        spec: creative.activeSpec,
      })
    }
  }
  return entries
}

export function studioImageRequestKey(
  creative: {
    directions: readonly { id: string; spec: CreativeSpec }[]
    selectedDirectionId?: string
    activeSpec?: CreativeSpec
  },
  campaign?: CampaignBrief
): string {
  return studioImageEntries(creative, campaign)
    .map((entry) => {
      const fingerprint = fingerprintForSpec(
        entry.spec,
        imageBriefContextFor(entry.directionId, campaign)
      )
      return `${entry.directionId}:${fingerprint ?? "none"}`
    })
    .join("|")
}

function fnv(raw: string): string {
  let hash = 2166136261
  for (let index = 0; index < raw.length; index += 1) {
    hash ^= raw.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return (hash >>> 0).toString(16).padStart(8, "0")
}

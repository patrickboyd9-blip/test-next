import type { GeneratedAsset } from "./image-generation"
import { toImageBrief, type ImageBrief } from "./image-brief"
import type { CreativeSpec } from "./types"

/**
 * Cache identity for a conceived photograph.
 * Not a CreativeSpec field. Same function on the server and in Studio views.
 */
export interface StudioImageRecord {
  directionId: string
  fingerprint: string
  asset: GeneratedAsset
}

export function imageBriefFingerprint(brief: ImageBrief): string {
  const raw = [
    brief.imageryRole,
    brief.occupancy,
    brief.leadJob,
    brief.tone?.trim() ?? "",
    brief.visualDirection.trim(),
  ].join("\u001f")
  return fnv(raw) + fnv(`${raw}#`)
}

export function fingerprintForSpec(spec: CreativeSpec): string | null {
  const brief = toImageBrief(spec)
  if (!brief) return null
  return imageBriefFingerprint(brief)
}

export function lookupStudioImage(
  records: readonly StudioImageRecord[],
  directionId: string,
  spec: CreativeSpec
): GeneratedAsset | null {
  const fingerprint = fingerprintForSpec(spec)
  if (!fingerprint) return null
  return (
    records.find(
      (record) =>
        record.directionId === directionId && record.fingerprint === fingerprint
    )?.asset ?? null
  )
}

export function studioImageEntries(creative: {
  directions: readonly { id: string; spec: CreativeSpec }[]
  selectedDirectionId?: string
  activeSpec?: CreativeSpec
}): Array<{ directionId: string; spec: CreativeSpec }> {
  const entries: Array<{ directionId: string; spec: CreativeSpec }> = []
  for (const direction of creative.directions) {
    entries.push({ directionId: direction.id, spec: direction.spec })
    if (
      direction.id === creative.selectedDirectionId &&
      creative.activeSpec &&
      fingerprintForSpec(creative.activeSpec) &&
      fingerprintForSpec(creative.activeSpec) !== fingerprintForSpec(direction.spec)
    ) {
      entries.push({
        directionId: direction.id,
        spec: creative.activeSpec,
      })
    }
  }
  return entries
}

export function studioImageRequestKey(creative: {
  directions: readonly { id: string; spec: CreativeSpec }[]
  selectedDirectionId?: string
  activeSpec?: CreativeSpec
}): string {
  return studioImageEntries(creative)
    .map(
      (entry) =>
        `${entry.directionId}:${fingerprintForSpec(entry.spec) ?? "none"}`
    )
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

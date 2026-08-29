import type {
  CampaignBrief,
  CampaignCreative,
  CreativeRevision,
  CreativeSpec,
} from "./types"
import { cloneSpec } from "./spec-diff"

export function getDirectionRevisions(
  creative: CampaignCreative,
  directionId: string
): CreativeRevision[] {
  return creative.revisions
    .filter((revision) => revision.directionId === directionId)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
}

export function getActiveRevision(
  creative: CampaignCreative,
  directionId: string
): CreativeRevision | undefined {
  const applicable = creative.revisions
    .filter((r) => r.directionId === directionId && r.version !== null)
    .sort((a, b) => (b.version ?? 0) - (a.version ?? 0))
  return applicable[0]
}

export function getActiveSpec(
  creative: CampaignCreative,
  directionId: string
): CreativeSpec | undefined {
  if (creative.activeSpec && creative.selectedDirectionId === directionId) {
    return creative.activeSpec
  }

  const active = getActiveRevision(creative, directionId)
  if (active) return active.spec

  const direction = creative.directions.find((d) => d.id === directionId)
  return direction?.spec
}

export function getActiveVersion(
  creative: CampaignCreative,
  directionId: string
): number {
  const active = getActiveRevision(creative, directionId)
  return active?.version ?? 1
}

export function getNextVersion(
  creative: CampaignCreative,
  directionId: string
): number {
  const max = creative.revisions
    .filter((r) => r.directionId === directionId && r.version !== null)
    .reduce((acc, r) => Math.max(acc, r.version ?? 0), 0)
  return max + 1
}

export function createOriginalRevision(
  directionId: string,
  spec: CreativeSpec,
  createdAt: string
): CreativeRevision {
  return {
    id: crypto.randomUUID(),
    directionId,
    version: 1,
    spec: cloneSpec(spec),
    customerPrompt: "Original concept",
    studioResponse: "",
    type: "refinement",
    createdAt,
  }
}

export function metricUsesQr(brief: CampaignBrief): boolean {
  const metric = brief.primarySuccessMetric?.type
  const desc = brief.primarySuccessMetric?.description?.toLowerCase() ?? ""
  return (
    metric === "qr_scan" ||
    metric === "appointment" ||
    desc.includes("qr") ||
    desc.includes("scan") ||
    Boolean(brief.qrDestination)
  )
}

export function metricUsesPhone(brief: CampaignBrief): boolean {
  const metric = brief.primarySuccessMetric?.type
  return metric === "phone_call" || metric === "appointment"
}

export function trackingDestination(brief: CampaignBrief): string {
  return (
    brief.qrDestination ??
    brief.website ??
    brief.businessInfo?.website ??
    "your booking page"
  )
}

export function formatRelativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime()
  const diffSec = Math.floor(diffMs / 1000)
  if (diffSec < 10) return "just now"
  if (diffSec < 60) return `${diffSec}s ago`
  const diffMin = Math.floor(diffSec / 60)
  if (diffMin < 60) return `${diffMin} min ago`
  const diffHr = Math.floor(diffMin / 60)
  return `${diffHr} hr ago`
}

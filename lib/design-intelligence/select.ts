import type { CampaignBrief } from "@/lib/campaign-creator/types"

import {
  BENCHMARK_ANCHOR_IDS,
  gradeRank,
  isAntiExample,
  type LibraryRecord,
  type MailerAnalysis,
} from "./library"
import type { DesignVertical } from "./rationale"
import { verticalForBrief } from "./vertical"

/**
 * Picks the mailers an art director may study.
 * A and B grades and Patrick's mailbox pieces outweigh vendor samples.
 * The benchmark trio is always included as quality anchors.
 * Anti-examples are returned only as things not to do.
 */

export interface ReferencePick {
  id: string
  role: "anchor" | "peer" | "dont"
  grade?: string
  vertical?: string
  mailbox: boolean
  principle: string
  doNotCopy: string
}

export interface ReferenceSelection {
  vertical: DesignVertical
  anchors: ReferencePick[]
  peers: ReferencePick[]
  donts: ReferencePick[]
  /** Ids whose images, when the library has them, may be shown to the model. */
  imageIds: string[]
}

const PEER_LIMIT = 3
const IMAGE_LIMIT = 4

export function selectReferences(
  records: readonly LibraryRecord[],
  brief: CampaignBrief
): ReferenceSelection {
  const vertical = verticalForBrief(brief)
  const byId = new Map(records.map((record) => [record.id, record]))
  const anchors = BENCHMARK_ANCHOR_IDS.map((id) => byId.get(id))
    .filter((record): record is LibraryRecord => Boolean(record))
    .map((record) => toPick(record, "anchor"))

  const donts = records
    .filter((record) => isAntiExample(record))
    .map((record) => toPick(record, "dont"))

  const peers = records
    .filter((record) => !isAntiExample(record) && !BENCHMARK_ANCHOR_IDS.includes(record.id as (typeof BENCHMARK_ANCHOR_IDS)[number]))
    .map((record) => ({ record, score: peerScore(record, vertical, brief) }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score || a.record.id.localeCompare(b.record.id))
    .slice(0, PEER_LIMIT)
    .map((item) => toPick(item.record, "peer"))

  const imageIds: string[] = []
  for (const pick of [...anchors, ...peers]) {
    const record = byId.get(pick.id)
    if (!record?.images.length) continue
    if (imageIds.length >= IMAGE_LIMIT) break
    imageIds.push(pick.id)
  }

  return { vertical, anchors, peers, donts, imageIds }
}

function peerScore(record: LibraryRecord, vertical: DesignVertical, brief: CampaignBrief): number {
  const analysis = record.analysis
  const recordVertical = normalizeVertical(record.vertical ?? analysis?.vertical)
  let score = 0
  if (recordVertical === vertical) score += 8
  else if (vertical === "general_local_service" && recordVertical) score += 2
  else if (recordVertical === "general_local_service") score += 1
  else return 0

  const rank = gradeRank(record.grade ?? analysis?.grade)
  if (rank <= 1) score += 6
  else if (rank <= 4) score += 4
  else if (rank <= 6) score += 1
  else score -= 2

  if ((record.id.startsWith("PM-") || analysis?.corpus === "pm" || analysis?.mailbox_weight === "primary") && rank <= 4) {
    score += 3
  }
  if (analysis?.shared_vendor_style) score -= 2
  if (offerOverlap(analysis, brief)) score += 2
  return score
}

function offerOverlap(analysis: MailerAnalysis | undefined, brief: CampaignBrief): boolean {
  const offer = `${brief.offer ?? ""} ${brief.goal ?? ""}`.toLowerCase()
  if (!offer.trim() || !analysis) return false
  const haystack = `${analysis.offer_placement ?? ""} ${analysis.summary ?? ""}`.toLowerCase()
  if (/\$|%|free|financ/.test(offer) && /\$|percent|free|financ|price|numeral/.test(haystack)) return true
  if (/review|medicare|plan/.test(offer) && /review|medicare|advisor|consult/.test(haystack)) return true
  return false
}

function toPick(record: LibraryRecord, role: ReferencePick["role"]): ReferencePick {
  const analysis = record.analysis
  const principle =
    analysis?.emulate?.[0] ||
    analysis?.summary ||
    analysis?.focal_point ||
    "One subject, one offer, one response."
  const doNotCopy =
    analysis?.do_not_copy?.[0] ||
    (role === "dont"
      ? analysis?.anti_patterns?.[0] || "Do not borrow the official-notice costume or a fake deadline."
      : "Do not copy the mark, the amounts, the phone, the photos, or the wording.")
  return {
    id: record.id,
    role,
    grade: record.grade ?? analysis?.grade,
    vertical: record.vertical ?? analysis?.vertical,
    mailbox: record.id.startsWith("PM-") || analysis?.corpus === "pm",
    principle: clip(principle),
    doNotCopy: clip(doNotCopy),
  }
}

function clip(value: string): string {
  const text = value.replace(/\s+/g, " ").trim()
  return text.length > 220 ? `${text.slice(0, 217)}...` : text
}

function normalizeVertical(value: string | undefined): DesignVertical | null {
  if (!value) return null
  if (value === "medicare" || value === "insurance" || value === "healthcare") return "medicare_insurance"
  if (
    value === "roofing" ||
    value === "plumbing" ||
    value === "hvac" ||
    value === "medicare_insurance" ||
    value === "real_estate" ||
    value === "general_local_service"
  ) {
    return value
  }
  if (value === "retail" || value === "finance" || value === "auto_service" || value === "education") {
    return "general_local_service"
  }
  return null
}

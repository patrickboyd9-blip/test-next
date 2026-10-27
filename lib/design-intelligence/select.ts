import type { CampaignBrief } from "@/lib/campaign-creator/types"

import { isForbiddenResearchPath } from "./images"
import {
  gradeRank,
  isAntiExample,
  type LibraryRecord,
  type MailerAnalysis,
} from "./library"
import { ownerFavoriteIds } from "./owner-favorites"
import { industriesAdjacent, industryForBrief, normalizeIndustry } from "@/lib/research-library/industry"
import type { DesignVertical } from "./rationale"
import { verticalForBrief } from "./vertical"

/**
 * Picks the mailers an art director may study.
 * A and B grades and Patrick's mailbox pieces outweigh vendor samples.
 * The owner's favorites are always included as quality anchors.
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

export interface DirectionCitation {
  mmrId: string
  title: string
  whyItWorks: string
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
  brief: CampaignBrief,
  env: NodeJS.ProcessEnv = process.env
): ReferenceSelection {
  const vertical = verticalForBrief(brief)
  const favorites = ownerFavoriteIds(env)
  const favoriteIds = new Set(favorites)
  const byId = new Map(records.map((record) => [record.id, record]))
  const anchors = favorites.map((id) => byId.get(id))
    .filter((record): record is LibraryRecord => Boolean(record))
    .map((record) => toPick(record, "anchor"))

  const donts = records
    .filter((record) => isAntiExample(record))
    .map((record) => toPick(record, "dont"))

  const peers = records
    .filter((record) => !isAntiExample(record) && !favoriteIds.has(record.id))
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

/**
 * The mailers whose principles this composition actually uses.
 * The sentence is the borrowed reasoning. The geometry of those mailers is not copied.
 * Anti-examples and anything under private/ stay out.
 */
export function citationsForDirection(
  records: readonly LibraryRecord[],
  brief: CampaignBrief,
  mode: string
): DirectionCitation[] {
  const vertical = verticalForBrief(brief)
  const byId = new Map(records.map((record) => [record.id, record]))
  const chosen: LibraryRecord[] = []
  for (const id of preferredIds(mode, vertical)) {
    const record = byId.get(id)
    if (!record || isAntiExample(record) || isPrivateRecord(record)) continue
    chosen.push(record)
  }
  if (chosen.length < 2) {
    const pattern = lessonPattern(mode)
    const extras = records
      .filter((record) => !isAntiExample(record) && !isPrivateRecord(record) && !chosen.some((item) => item.id === record.id))
      .map((record) => ({ record, score: peerScore(record, vertical, brief) }))
      .filter((item) => item.score > 0 && pattern.test(recordText(item.record)))
      .sort((a, b) => b.score - a.score || a.record.id.localeCompare(b.record.id))
    for (const extra of extras) {
      if (chosen.length >= 2) break
      chosen.push(extra.record)
    }
  }
  return chosen.slice(0, 2).map((record) => ({
    mmrId: record.id,
    title: record.grade ? `${record.grade} reference` : "Reference",
    whyItWorks: borrowedSentence(record, mode),
  }))
}

function preferredIds(mode: string, vertical: DesignVertical): string[] {
  if (vertical === "medicare_insurance") {
    if (mode === "calm-column") return ["MMR-032", "MMR-514"]
    if (mode === "type-led") return ["PM-046", "MMR-397"]
    return ["MMR-113", "PM-020"]
  }
  if (mode === "integrated") return ["PM-041", "PM-047"]
  if (mode === "full-bleed") return ["PM-052", "MMR-397"]
  if (mode === "dark-offer-field") return ["PM-047", "PM-054"]
  if (mode === "type-led") return ["MMR-397", "PM-046"]
  if (mode === "calm-column") return ["MMR-032", "MMR-113"]
  return ["PM-022", "PM-001"]
}

const BORROWED: Record<string, string> = {
  "PM-041": "Borrowed a cut-out subject on an open ground, with the price as the largest glyph and no photo box.",
  "PM-047": "Borrowed one offer lockup at least 1.6× the headline, and left this mailer's bottom band behind.",
  "PM-001": "Borrowed one solid panel for a single figure and the phone, and left that mailer's scene behind.",
  "PM-054": "Borrowed a dark field beside the work, and did not use this mailer's right-half split or circular badge.",
  "PM-022": "Borrowed an overlapping card on a full-bleed photograph, and moved the card off this mailer's footprint.",
  "PM-056": "Borrowed a three-color palette, condensed display type, one product hero, and one offer panel with its code. Left that mailer's layout behind.",
  "PM-057": "Borrowed one hero product photograph, a short playful headline, and one full-width offer strip with a barcode and an expiry. Left that mailer's layout behind.",
  "PM-052": "Borrowed a full-bleed crop with only a few lines of type, and put the phone in one of those lines.",
  "MMR-397": "Borrowed holding the type to one quiet band under the photograph, with a single next step.",
  "PM-046": "Borrowed one question as the type event and a phone set large in the footer.",
  "MMR-113": "Borrowed one person full-bleed with short type on a calm field, and none of the official chrome.",
  "MMR-032": "Borrowed large paper, one real person, and one short invitation, with no urgency.",
  "PM-020": "Borrowed a face looking at the reader and a short caption under the code.",
  "MMR-514": "Borrowed the lack of official cues, then enlarged one element and named a real person.",
}

function lessonPattern(mode: string): RegExp {
  if (mode === "integrated") return /cutout|cut-out|white|numeral|1\.6|glyph/i
  if (mode === "dark-offer-field") return /numeral|1\.6|dark field/i
  if (mode === "type-led") return /headline|question|quiet band|type/i
  if (mode === "calm-column") return /calm|invitation|person|advisor/i
  if (mode === "full-bleed") return /full-bleed|full bleed|crop/i
  return /overlapping|panel|figure/i
}

function recordText(record: LibraryRecord): string {
  const analysis = record.analysis
  return `${analysis?.emulate?.join(" ") ?? ""} ${analysis?.focal_point ?? ""} ${analysis?.summary ?? ""}`
}

function borrowedSentence(record: LibraryRecord, mode: string): string {
  const written = BORROWED[record.id]
  if (written) return written
  const pattern = lessonPattern(mode)
  const lines = [...(record.analysis?.emulate ?? []), record.analysis?.focal_point ?? ""].filter((line) => line.trim().length > 0)
  const hit = lines.find((line) => pattern.test(line)) ?? lines[0] ?? "One subject and one response, with room around both."
  return citationSentence(hit)
}

function isPrivateRecord(record: LibraryRecord): boolean {
  if (/(^|\/)private(\/|$)/i.test(record.id)) return true
  return record.images.some((image) => isForbiddenResearchPath(image.path))
}

function citationSentence(raw: string): string {
  const sentence = raw.split(/(?<=\.)\s+/)[0]?.replace(/\s+/g, " ").trim() || raw
  const borrowed = sentence.replace(/\bcopy\b/gi, "borrow")
  return /[.!?]$/.test(borrowed) ? borrowed : `${borrowed}.`
}

function peerScore(record: LibraryRecord, _vertical: DesignVertical, brief: CampaignBrief): number {
  const analysis = record.analysis
  const briefIndustry = industryForBrief(brief)
  const recordIndustry = recordIndustryFor(record.vertical ?? analysis?.vertical, `${analysis?.summary ?? ""} ${analysis?.offer_placement ?? ""} ${analysis?.focal_point ?? ""}`)
  let score = 0
  if (briefIndustry !== "none" && recordIndustry === briefIndustry) score += 8
  else if (briefIndustry !== "none" && recordIndustry !== "none" && industriesAdjacent(briefIndustry, recordIndustry)) score += 3
  else if (briefIndustry === "none" && recordIndustry !== "none") score += 2
  else if (recordIndustry === "none") score += 1
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

function recordIndustryFor(vertical: string | undefined, notes: string): string {
  const fromLabel = normalizeIndustry(vertical)
  if (fromLabel === "plumbing" || fromLabel === "roofing") {
    const fromNotes = normalizeIndustry(notes)
    if (fromNotes === "hvac" || fromNotes === "windows-gutters-siding") return fromNotes
  }
  if (fromLabel !== "none") return fromLabel
  const fromNotes = normalizeIndustry(notes)
  return fromNotes
}

import type { CampaignBrief, CreativeSpec } from "@/lib/campaign-creator/types"
import { headlineCopiesCampaign } from "@/lib/design-intelligence/ad-psych/lessons-data"
import type { DesignRationale, DesignVertical } from "@/lib/design-intelligence/rationale"
import {
  clientFactText,
  isNonMedicareInsurance,
  onCardLine,
  persuasionVertical,
  type DirectionRole,
} from "@/lib/design-intelligence/persuasion"
import type { PostcardTemplateId } from "@/lib/postcard-layouts/ids"
import { verticalPaletteForBrief } from "@/lib/postcard-layouts/assign"
import { templatesForPalette } from "@/lib/postcard-layouts/templates"

import { layoutTuneFromHits, photoNoteFromHits } from "./evidence"
import { entryHasContent } from "./retrieve"
import type { RetrievalHit } from "./types"

export interface EvidenceTrace {
  headlineId?: string
  offerId?: string
  layoutId?: string
  photoId?: string
}

export interface SteeredSpec {
  headline: string
  offer: string
  offerProminent: boolean
  photoShare?: number
  templateId?: PostcardTemplateId
  photoDirection?: string
  trace: EvidenceTrace
}

const MEDICARE_COPY = /\bmedicare\b|\bmedicaid\b|\bmedigap\b|\bcoverage gap\b|\baep\b|\bannual enrollment\b/i
const TRADE_PHOTO = /\bladders?\b|\bhandymen\b|\bhandyman\b|\broofers?\b|\bshingles?\b|\bhard hats?\b|\bcondensers?\b|\btechnicians?\b/i

/**
 * Turns retrieved mailers into a headline, a complete offer, and a layout.
 * A headline that already passes the quality check is kept.
 * The canned line is only the fallback.
 */
export function steerSpecFromResearch(input: {
  headline: string
  offer: string
  brief: CampaignBrief
  hits: readonly RetrievalHit[]
  vertical?: DesignVertical
  role?: DirectionRole
}): SteeredSpec {
  const offer = completeOffer(input.offer || input.brief.offer || "")
  const kind = persuasionVertical(input.brief, input.vertical)
  const canned = input.role ? onCardLine(kind, input.role) : ""
  const incoming = input.headline.replace(/\s+/g, " ").trim()
  const usable = input.hits.filter((hit) => entryHasContent(hit.entry) && !blockedMedicare(hit, input.brief))
  const copyHit = usable[0]
  const tune = layoutTuneFromHits(usable.length > 0 ? usable : input.hits.filter((hit) => !blockedMedicare(hit, input.brief)))
  const layoutHit = usable.find((hit) => hit.entry.id === tune?.sourceId) ?? copyHit
  const photoHit = usable.find((hit) => photoFits(hit.entry.photoStyle, input.brief)) ?? copyHit
  const photoDirection = photoFits(photoNoteFromHits(photoHit ? [photoHit] : []), input.brief)
    ? photoNoteFromHits(photoHit ? [photoHit] : [])
    : undefined
  const kept = incoming && !isCanned(incoming, canned) && passesQuality(incoming, offer, kind)
  const researched = !kept && copyHit ? researchHeadline(copyHit, input.brief) : undefined
  const headline = kept ? incoming : researched ?? (canned || incoming)
  const templateId = allowedTemplate(tune?.templateBias, input.brief)
  return {
    headline,
    offer,
    offerProminent: Boolean(tune?.offerProminent) && !isMedicareBrief(input.brief),
    photoShare: tune?.photoShare,
    templateId,
    photoDirection,
    trace: {
      headlineId: kept ? undefined : researched ? copyHit?.entry.id : undefined,
      offerId: tune?.offerProminent ? tune.sourceId : copyHit?.entry.id,
      layoutId: templateId || tune?.photoShare !== undefined ? layoutHit?.entry.id ?? tune?.sourceId : undefined,
      photoId: photoDirection ? photoHit?.entry.id : undefined,
    },
  }
}

export function completeOffer(offer: string): string {
  return offer.replace(/\s+/g, " ").trim().replace(/[.]+$/g, "").trim()
}

export function photoFits(note: string | undefined, brief: CampaignBrief): boolean {
  const text = note?.replace(/\s+/g, " ").trim() ?? ""
  if (!text) return false
  const facts = clientFactText(brief)
  if (!/\bmedicare\b/i.test(facts) && MEDICARE_COPY.test(text)) return false
  if (isNonMedicareInsurance(facts) && TRADE_PHOTO.test(text)) return false
  return true
}

function researchHeadline(hit: RetrievalHit, brief: CampaignBrief): string | undefined {
  const line = hit.entry.headlines.find((item) => item.trim())?.replace(/\s+/g, " ").trim()
  if (!line) return undefined
  if (!safeResearchLine(line, brief)) return undefined
  return /[.!?]$/.test(line) ? line : `${line}.`
}

function safeResearchLine(line: string, brief: CampaignBrief): boolean {
  const words = line.split(/\s+/).filter(Boolean)
  if (words.length < 2 || words.length > 10) return false
  if (/\d/.test(line)) return false
  if (headlineCopiesCampaign(line)) return false
  if (/^(?:unknown|n\/a)\b/i.test(line)) return false
  if (!isMedicareBrief(brief) && MEDICARE_COPY.test(line)) return false
  return true
}

function passesQuality(headline: string, offer: string, kind: string): boolean {
  if (/^(?:know your|know who)\b/i.test(headline)) return false
  if (/^(?:a\s+)?free\b/i.test(headline)) return false
  if (/\b(?:inspection|tune-?up|treatment|cleanup|check|quote|estimate)\b/i.test(headline) && kind !== "insurance") return false
  const offerWords = new Set(offer.toLowerCase().split(/\W+/).filter((word) => word.length > 3))
  const shared = headline.toLowerCase().split(/\W+/).filter((word) => offerWords.has(word))
  if (offerWords.size > 0 && shared.length >= 2) return false
  return true
}

function isCanned(headline: string, canned: string): boolean {
  const normalize = (value: string) => value.toLowerCase().replace(/[.!?]+$/g, "").trim()
  return Boolean(canned) && normalize(headline) === normalize(canned)
}

function isMedicareBrief(brief: CampaignBrief): boolean {
  return /\bmedicare\b|\bmedicaid\b|\bmedigap\b/i.test(clientFactText(brief))
}

function blockedMedicare(hit: RetrievalHit, brief: CampaignBrief): boolean {
  if (isMedicareBrief(brief)) return false
  if (hit.entry.industry === "medicare") return true
  const blob = [hit.entry.headlines.join(" "), hit.entry.offers.join(" "), hit.entry.whyItWorks ?? ""].join(" ")
  return MEDICARE_COPY.test(blob)
}

function allowedTemplate(bias: string | undefined, brief: CampaignBrief): PostcardTemplateId | undefined {
  if (!bias) return undefined
  const allowed = templatesForPalette(verticalPaletteForBrief(brief))
  return allowed.includes(bias as PostcardTemplateId) ? bias as PostcardTemplateId : undefined
}

/** The lead layout follows the retrieved mailer. Later directions stay on their own recipes. */
export function applySteeredRationale(rationale: DesignRationale, steered: SteeredSpec, brief: CampaignBrief): DesignRationale {
  const medicare = rationale.vertical === "medicare_insurance" && !isNonMedicareInsurance(clientFactText(brief))
  let next = rationale
  if ((steered.photoShare ?? 0) >= 0.55) {
    next = {
      ...next,
      grid: { ...next.grid, name: "full-bleed-plus-panel", intentional_break: "full-bleed" },
      focal_element: {
        ...next.focal_element,
        lead_modality: "image",
        lead_modality_area_pct: 74,
      },
      photo_brief: {
        ...next.photo_brief,
        placement: "full_bleed",
        subject: steered.photoDirection ?? next.photo_brief.subject,
      },
    }
  } else if (steered.photoDirection) {
    next = {
      ...next,
      photo_brief: { ...next.photo_brief, subject: steered.photoDirection },
    }
  }
  if (steered.offerProminent && !medicare) {
    next = {
      ...next,
      scale_ratios: {
        ...next.scale_ratios,
        hero: "offer",
        offer_to_headline_cap: Math.max(next.scale_ratios.offer_to_headline_cap, 1.7),
        offer_to_body: Math.max(next.scale_ratios.offer_to_body, 5),
      },
      offer_treatment: {
        ...next.offer_treatment,
        kind: "numeral_hero",
        placement: "The offer is the prominent line, larger than the headline.",
      },
      focal_element: {
        ...next.focal_element,
        kind: "offer_numeral",
        lead_modality: "offer_field",
      },
    }
  }
  return next
}

export function applySteeredCopy(spec: CreativeSpec, steered: SteeredSpec): CreativeSpec {
  return {
    ...spec,
    headline: steered.headline,
    offer: steered.offer || spec.offer,
    leadJob: steered.offerProminent ? "offer" : spec.leadJob,
    visualDirection: steered.photoDirection ?? spec.visualDirection,
    layoutHints: {
      ...spec.layoutHints,
      templateId: steered.templateId ?? spec.layoutHints?.templateId,
      offerBadge: steered.offerProminent ? "band" : spec.layoutHints?.offerBadge ?? "inline",
    },
  }
}

import type { CampaignBrief, CreativeSpec, ImageryRole, LayoutVariant } from "./types"

/**
 * CMS TPMO disclaimer for a Medicare agent marketing piece.
 * Research guidance for Studio, not a substitute for legal review.
 * The SHIP sentence is omitted, matching the CY2027 wording.
 */
export const MEDICARE_AGENT_DISCLAIMER =
  "We do not offer every plan available in your area. Any information we provide is limited to those plans we do offer in your area. Please contact Medicare.gov or 1-800-MEDICARE to get information on all of your options."

export const MEDICARE_FREE_REVIEW = "Free plan review"

const MEDICARE_LAYOUTS = ["peer_split", "image_grounded", "type_primary_split"] as const
const MEDICARE_ROLES = ["neighborhood", "crew", "consequence"] as const

const SCENES: Record<(typeof MEDICARE_ROLES)[number], string> = {
  neighborhood:
    "An active, capable older couple walking a sunny residential sidewalk, contemporary color, healthy and independent, with quiet sky left open for type.",
  crew: "An active, capable older couple talking at a sunny outdoor table, natural color, at ease, with calm space beside them for type.",
  consequence:
    "An active, capable older couple gardening together in daylight, standing and well, contemporary color, with open space around them.",
}

const HEADSHOT_SCENE =
  "The uploaded agent headshot, friendly and looking at the camera, natural color, capable and local, with calm space beside the portrait for type."

const BANNED_PHRASE =
  /\bofficial business\b|\byou qualify\b|\byou(?:'re| are) entitled\b|\bentitled\b|\bbenefits?\b|\bcapitol\b|\beagles?\b|\bmedicare cards?\b|\b(?:official|government|agency|great) seal\b|\b(?:american|u\.?s\.?|united states) flags?\b|\bstars and stripes\b|\bold glory\b/gi

const FAKE_DEADLINE =
  /\b(?:respond|reply|act|call|enroll)\s+within\s+\d+\s+days?\b|\bonly\s+\d+\s+days?\s+left\b|\blimited time\b|\bact now\b|\bact fast\b|\blast chance\b|\bdon'?t miss out\b|\bexpires?\s+(?:soon|tomorrow|friday|this week|monday|tuesday|wednesday|thursday|saturday|sunday)\b|\boffer ends\b|\bhurry\b|\b(?:open )?enrollment is closing\b|\bfinal days\b|\bdeadline\b/i

const AEP_DATE =
  /\b(?:oct(?:ober)?\.?\s*15|15\s*oct(?:ober)?|dec(?:ember)?\.?\s*7|7\s*dec(?:ember)?|10\/15|12\/7|annual enrollment)\b/i

const DOLLAR_CLAIM =
  /\$\s*\d[\d,]*(?:\.\d+)?|\b\d+\s+dollars?\b|\b(?:\$\s*0|zero|no)\s+premiums?\b|\bpremiums?\s+(?:of\s+)?\$?\s*0\b/gi

const BAD_PHOTO =
  /\b(construction|hard hats?|job sites?|scaffolding|excavators?|capitol|eagles?|medicare cards?|hospitals?|frail|sepia|caskets?|funerals?|cemeter(?:y|ies)|coffins?)\b/i

export function isMedicareAgentBrief(brief: CampaignBrief | undefined): boolean {
  if (!brief) return false
  return /\bmedicare\b/i.test(briefText(brief))
}

export function isFinalExpenseBrief(brief: CampaignBrief | undefined): boolean {
  if (!brief) return false
  return /\bfinal expense\b|\bburial insurance\b/i.test(briefText(brief))
}

export function uploadedAgentPortrait(brief: CampaignBrief | undefined): string | undefined {
  const photo = brief?.brandAssets?.find(
    (asset) => asset.type === "photo" && asset.description.trim()
  )
  return photo?.description.trim() || undefined
}

export function medicareDisclaimerFor(brief: CampaignBrief | undefined): string | null {
  return isMedicareAgentBrief(brief) ? MEDICARE_AGENT_DISCLAIMER : null
}

/**
 * Customer-facing copy for a Medicare agent piece.
 * Keeps a claim the brief already states. Drops government wording,
 * invented deadlines, and dollar claims the brief did not provide.
 */
export function scrubMedicareLanguage(text: string, brief?: CampaignBrief): string {
  const source = briefText(brief)
  const cleaned = text
    .split(/(?<=[.!?])\s+/)
    .filter((sentence) => keepSentence(sentence))
    .join(" ")
  return collapse(removeBanned(removeDollars(cleaned, source)))
}

export function repairMedicareAgentSpec(
  brief: CampaignBrief,
  spec: CreativeSpec,
  index = 0
): CreativeSpec {
  if (!isMedicareAgentBrief(brief)) return spec

  const next: CreativeSpec = { ...spec, layoutHints: { ...spec.layoutHints } }
  const role = nextRole(next.imageryRole, index)
  const textOnly =
    next.layoutVariant === "type_only" ||
    next.imageryRole === "none" ||
    next.imageryRole === "logo" ||
    !next.imageryRole

  if (textOnly) {
    next.layoutVariant = MEDICARE_LAYOUTS[index % MEDICARE_LAYOUTS.length]
    next.imageryRole = role
    next.imagery =
      next.imagery && next.imagery !== "none" && next.imagery !== "logo_primary"
        ? next.imagery
        : "stock_generic_local"
    delete next.imagePresence
  }

  for (const field of ["headline", "subheadline", "body", "callToAction", "offer"] as const) {
    const value = next[field]
    if (!value) continue
    const scrubbed = scrubMedicareLanguage(value, brief)
    if (scrubbed) next[field] = scrubbed
    else delete next[field]
  }

  if (!brief.offer?.trim()) {
    next.offer = MEDICARE_FREE_REVIEW
  }

  const headline = next.headline?.trim() ?? ""
  if (wordCount(headline) < 3 || wordCount(headline) > 8) {
    next.headline = "Free Plan Review"
  }

  if (!next.subheadline?.trim()) {
    next.subheadline = "A local look at the plans we offer"
  }
  if (!next.body?.trim()) {
    next.body = "Scan or call and we will walk through the plans we offer in your area."
  }
  if (!next.callToAction?.trim()) {
    next.callToAction = "Scan for a review"
  }

  const portrait = uploadedAgentPortrait(brief)
  const visual = next.visualDirection?.trim() ?? ""
  if (!visual || BAD_PHOTO.test(visual) || wordCount(visual) < 12) {
    next.visualDirection =
      portrait && next.imageryRole === "crew" ? HEADSHOT_SCENE : SCENES[role]
  }

  if (next.qrDestination?.trim() || brief.qrDestination?.trim() || brief.website?.trim()) {
    next.layoutHints = { ...next.layoutHints, qrProminence: "large" }
  }

  return next
}

export function medicareCopyViolations(brief: CampaignBrief, spec: CreativeSpec): string[] {
  if (!isMedicareAgentBrief(brief)) return []
  const reasons: string[] = []
  const blob = [spec.headline, spec.subheadline, spec.body, spec.callToAction, spec.offer]
    .filter(Boolean)
    .join(" ")
  if (BANNED_PHRASE.test(blob)) reasons.push("government or prohibited wording")
  BANNED_PHRASE.lastIndex = 0
  if (inventedDollar(blob, briefText(brief))) reasons.push("dollar claim the brief did not provide")
  if (fakeDeadline(blob)) reasons.push("deadline other than Annual Enrollment, October 15 to December 7")
  if (spec.visualDirection && BAD_PHOTO.test(spec.visualDirection)) {
    reasons.push("photograph describes the wrong subject")
  }
  return reasons
}

function nextRole(role: ImageryRole | undefined, index: number): (typeof MEDICARE_ROLES)[number] {
  if (role === "crew" || role === "neighborhood" || role === "consequence") return role
  return MEDICARE_ROLES[index % MEDICARE_ROLES.length]
}

function keepSentence(sentence: string): boolean {
  if (AEP_DATE.test(sentence)) return true
  if (FAKE_DEADLINE.test(sentence)) return false
  return true
}

function fakeDeadline(text: string): boolean {
  return text.split(/(?<=[.!?])\s+/).some((sentence) => {
    if (AEP_DATE.test(sentence)) return false
    return FAKE_DEADLINE.test(sentence)
  })
}

function removeBanned(text: string): string {
  return text.replace(BANNED_PHRASE, " ")
}

function removeDollars(text: string, brief: string): string {
  return text.replace(DOLLAR_CLAIM, (match) => (briefHas(brief, match) ? match : " "))
}

function inventedDollar(text: string, brief: string): boolean {
  const claims = text.match(DOLLAR_CLAIM) ?? []
  DOLLAR_CLAIM.lastIndex = 0
  return claims.some((claim) => !briefHas(brief, claim))
}

function briefHas(brief: string, claim: string): boolean {
  const normalizedBrief = brief.toLowerCase().replace(/\s+/g, "")
  const normalizedClaim = claim.toLowerCase().replace(/\s+/g, "")
  return normalizedClaim.length > 0 && normalizedBrief.includes(normalizedClaim)
}

function briefText(brief: CampaignBrief | undefined): string {
  if (!brief) return ""
  return [
    brief.goal,
    brief.audience?.description,
    brief.businessInfo?.name,
    brief.offer,
    brief.otherRequirements,
    brief.desiredRecipientAction,
    brief.emotionalTone,
    ...(brief.brandAssets?.map((asset) => asset.description) ?? []),
  ]
    .filter((value): value is string => Boolean(value?.trim()))
    .join(" ")
}

function collapse(value: string): string {
  return value
    .replace(/\s+([,.;:!?])/g, "$1")
    .replace(/^[,\s.;:-]+/g, "")
    .replace(/\s{2,}/g, " ")
    .trim()
}

function wordCount(value: string): number {
  return value.trim().split(/\s+/).filter(Boolean).length
}

export function medicareLayout(index: number): LayoutVariant {
  return MEDICARE_LAYOUTS[index % MEDICARE_LAYOUTS.length]
}

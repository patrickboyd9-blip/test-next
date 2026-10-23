import type { CampaignBrief } from "@/lib/campaign-creator/types"
import { verticalForBrief } from "@/lib/design-intelligence/vertical"

/**
 * Fair Housing Act protected classes the product refuses for housing mail.
 * Income, age of a house, homeowner status, and location are not on this list.
 */
export const PROTECTED_CLASSES = [
  "race",
  "religion",
  "national_origin",
  "familial_status",
  "disability",
  "sex",
] as const

export type ProtectedClass = (typeof PROTECTED_CLASSES)[number]

export const PROTECTED_CLASS_LABEL: Record<ProtectedClass, string> = {
  race: "race",
  religion: "religion",
  national_origin: "national origin",
  familial_status: "familial status",
  disability: "disability",
  sex: "sex",
}

const HOUSING_VERTICALS = new Set(["roofing", "plumbing", "hvac", "real_estate"])

const HOUSING_TEXT =
  /\b(home\s?owners?|homes?|houses?|housing|roofs?|shingles?|gutters?|plumb\w*|hvac|air condition\w*|furnaces?|heating|cooling|real estate|realtors?|mortgages?|renters?|apartments?|propert(?:y|ies)|solar)\b/i

const AUDIENCE_NOUN = "homeowners?|households?|families|residents?|neighborhoods?|buyers?|renters?|people|owners?|tenants?"

interface ClassPattern {
  protectedClass: ProtectedClass
  regex: RegExp
}

const PATTERNS: ClassPattern[] = [
  {
    protectedClass: "race",
    regex: new RegExp(
      `\\b(?:white|black|asian)\\s+(?=${AUDIENCE_NOUN})|\\b(?:hispanic|latino|latina|latinx|caucasian|african[- ]american)\\s+(?=${AUDIENCE_NOUN})|\\bwho\\s+are\\s+(?:white|black|asian|hispanic|latinos?|latinas?|caucasian)\\b|\\b(?:no|only|exclude|excluding|without)\\s+(?:whites?|blacks?|hispanics?|asians?|latinos?|latinas?)\\b|\\bpeople of color\\b|\\bby race\\b|\\bracial\\b`,
      "gi"
    ),
  },
  {
    protectedClass: "religion",
    regex: new RegExp(
      `\\b(?:christian|jewish|muslim|catholic|protestant|hindu|buddhist|mormon|evangelical|islamic)\\s+(?=${AUDIENCE_NOUN})|\\bwho\\s+are\\s+(?:christian|jewish|muslim|catholic|religious)\\b|\\bchurchgoers?\\b|\\bpeople of faith\\b|\\breligious households?\\b|\\b(?:only|no)\\s+(?:christians?|jews?|muslims?|catholics?)\\b`,
      "gi"
    ),
  },
  {
    protectedClass: "national_origin",
    regex: new RegExp(
      `\\b(?:mexican|chinese|indian|filipino|vietnamese|korean|cuban|puerto rican)\\s+(?=${AUDIENCE_NOUN})|\\bimmigrants?\\b|\\bforeign[- ]born\\b|\\bnational origin\\b|\\bborn in\\s+[a-z]+\\b|\\bno\\s+(?:mexicans?|immigrants?|foreigners?)\\b`,
      "gi"
    ),
  },
  {
    protectedClass: "familial_status",
    regex:
      /\bfamilies with (?:young )?children\b|\bhouseholds? with (?:kids|children)\b|\bwith (?:young )?(?:kids|children)\b|\b(?:no|without) (?:kids|children)\b|\bchildless\b|\bsingle (?:mothers?|fathers?|parents?)\b|\bpregnant\b|\bfamilial status\b|\bparents with (?:young )?children\b|\bpresence of children\b/gi,
  },
  {
    protectedClass: "disability",
    regex: new RegExp(
      `\\b(?:disabled|handicapped|wheelchair)\\s+(?=${AUDIENCE_NOUN})|\\bwith (?:a )?(?:disability|disabilities|handicap)\\b|\\b(?:no|exclude) disabled\\b`,
      "gi"
    ),
  },
  {
    protectedClass: "sex",
    regex: new RegExp(
      `\\b(?:women|men|females?|males?) only\\b|\\b(?:female|male|women|men)\\s+(?=${AUDIENCE_NOUN})|\\bwho are (?:women|men|female|male)\\b|\\bsingle (?:women|men)\\b|\\bby sex\\b|\\bby gender\\b`,
      "gi"
    ),
  },
]

export function isHousingRelated(brief: CampaignBrief, text: string): boolean {
  const vertical = verticalForBrief({
    ...brief,
    otherRequirements: [brief.otherRequirements, text].filter(Boolean).join(" "),
  })
  if (HOUSING_VERTICALS.has(vertical)) return true
  const blob = [brief.goal, brief.offer, brief.audience?.description, brief.businessInfo?.name, text]
    .filter((part): part is string => Boolean(part?.trim()))
    .join(" ")
  return HOUSING_TEXT.test(blob)
}

export function findProtectedClasses(text: string, housing: boolean): ProtectedClass[] {
  if (!housing || !text.trim()) return []
  const found: ProtectedClass[] = []
  for (const pattern of PATTERNS) {
    pattern.regex.lastIndex = 0
    if (pattern.regex.test(text)) found.push(pattern.protectedClass)
  }
  return found
}

/** Removes protected-class phrases and leaves the lawful words around them. */
export function stripProtectedLanguage(text: string, housing: boolean): string {
  if (!housing) return text
  let next = text
  for (const pattern of PATTERNS) {
    pattern.regex.lastIndex = 0
    next = next.replace(pattern.regex, " ")
  }
  return next.replace(/\s+,/g, ",").replace(/\s{2,}/g, " ").replace(/\s+,/g, ",").trim()
}

export function fairHousingNote(blocked: readonly ProtectedClass[]): string | undefined {
  if (blocked.length === 0) return undefined
  const labels = blocked.map((item) => PROTECTED_CLASS_LABEL[item])
  const list =
    labels.length === 1
      ? labels[0]
      : `${labels.slice(0, -1).join(", ")} or ${labels[labels.length - 1]}`
  return `We can't aim housing mail by ${list}. That part was left out. Income, home age, whether someone owns the home, and location can stay.`
}

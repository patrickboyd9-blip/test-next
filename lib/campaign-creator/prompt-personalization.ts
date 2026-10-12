import type { CampaignBrief, CreativeSpec } from "./types"
import { cloneSpec } from "./spec-diff"

/** Facts a customer can state in the Studio chat to tailor a mailer. */
export interface PersonalizationFacts {
  businessName?: string
  phone?: string
  website?: string
  offer?: string
  photoDirection?: string
}

const PHONE = /(?:\+?1[\s.-]?)?(?:\(\s*\d{3}\s*\)|\d{3})[\s.-]\d{3}[\s.-]\d{4}/
const URL = /https?:\/\/[^\s,)]+/i
const DOMAIN = /\b(?:www\.)?[a-z0-9][-a-z0-9]*\.[a-z]{2,}(?:\/[^\s,)]*)?/i

const COPY_FIELDS = ["headline", "subheadline", "body", "callToAction"] as const

export function personalizationFromPrompt(prompt: string): PersonalizationFacts {
  const text = prompt.trim()
  const facts: PersonalizationFacts = {}

  const name =
    matchValue(text, /\b(?:business name|company name|our name|our business)\s*(?:is|:)\s+/i) ??
    matchValue(text, /\bname\s+(?:to|is)\s+/i)
  if (name) facts.businessName = name

  if (/\b(phone|call|number)\b/i.test(text)) {
    const phone = text.match(PHONE)?.[0]?.replace(/\s+/g, " ").trim()
    if (phone) facts.phone = phone
  }

  if (/\b(website|site|url)\b/i.test(text)) {
    const raw = text.match(URL)?.[0] ?? text.match(DOMAIN)?.[0]
    if (raw) facts.website = normalizeWebsite(raw)
  }

  const offer = matchValue(text, /\b(?:offer|special)\s+(?:is|to)\s+/i)
  if (offer) facts.offer = offer

  const photo = text.match(/\b(?:photo|picture|image)\s+(?:of|showing|:)\s+([^.]{8,180})/i)
  if (photo?.[1]) facts.photoDirection = photo[1].trim()

  return facts
}

export function hasPersonalizationFacts(facts: PersonalizationFacts): boolean {
  return Boolean(
    facts.businessName || facts.phone || facts.website || facts.offer || facts.photoDirection
  )
}

/**
 * Writes chat facts onto the postcard spec.
 * The previous business name, when the brief has one, is replaced in the copy.
 */
export function applyPersonalizationToSpec(
  spec: CreativeSpec,
  brief: CampaignBrief,
  facts: PersonalizationFacts
): CreativeSpec {
  if (!hasPersonalizationFacts(facts)) return spec

  const next = cloneSpec(spec)
  let changed = false

  if (facts.phone && facts.phone !== next.phone) {
    next.phone = facts.phone
    changed = true
  }
  if (facts.website && facts.website !== next.website) {
    next.website = facts.website
    next.qrDestination = facts.website
    changed = true
  }
  if (facts.offer && facts.offer !== next.offer) {
    next.offer = facts.offer
    changed = true
  }
  if (facts.businessName) {
    const previous = brief.businessInfo?.name?.trim()
    if (previous && previous.toLowerCase() !== facts.businessName.toLowerCase()) {
      for (const field of COPY_FIELDS) {
        const value = next[field]
        if (!value || !value.includes(previous)) continue
        next[field] = value.split(previous).join(facts.businessName)
        changed = true
      }
    }
  }
  if (facts.photoDirection && facts.photoDirection !== next.visualDirection) {
    next.visualDirection = facts.photoDirection
    if (
      next.layoutVariant === "type_only" ||
      next.imageryRole === "none" ||
      next.imagery === "none"
    ) {
      next.layoutVariant = "image_grounded"
      next.imagery =
        !next.imagery || next.imagery === "none" ? "stock_generic_local" : next.imagery
      next.imageryRole = "neighborhood"
      delete next.imagePresence
    }
    changed = true
  }

  return changed ? next : spec
}

/** Brief fields the wordmark and later turns should keep after a successful chat edit. */
export function briefPatchFromPersonalization(
  brief: CampaignBrief,
  facts: PersonalizationFacts
): Partial<CampaignBrief> | null {
  if (!facts.businessName && !facts.phone && !facts.website && !facts.offer) return null

  const patch: Partial<CampaignBrief> = {}
  if (facts.offer) patch.offer = facts.offer
  if (facts.phone) patch.phone = facts.phone
  if (facts.website) {
    patch.website = facts.website
    patch.qrDestination = facts.website
  }
  if (facts.businessName || facts.phone || facts.website) {
    patch.businessInfo = {
      ...brief.businessInfo,
      ...(facts.businessName ? { name: facts.businessName } : {}),
      ...(facts.phone ? { phone: facts.phone } : {}),
      ...(facts.website ? { website: facts.website } : {}),
    }
  }
  return patch
}

function matchValue(text: string, lead: RegExp): string | undefined {
  const start = lead.exec(text)
  if (!start) return undefined
  const rest = text.slice(start.index + start[0].length).trim()
  const quoted = rest.match(/^["“']([^"”']{2,80})["”']/)
  if (quoted?.[1]) return clean(quoted[1])
  const plain = rest.split(/\s+\band\b|[.\n]/i)[0] ?? ""
  return clean(plain)
}

function clean(value: string): string | undefined {
  const trimmed = value.replace(/^["“'\s]+|["”'\s,]+$/g, "").trim()
  if (trimmed.length < 2 || trimmed.length > 80) return undefined
  return trimmed
}

function normalizeWebsite(raw: string): string {
  const trimmed = raw.replace(/[.,]+$/g, "")
  if (/^https?:\/\//i.test(trimmed)) return trimmed
  return `https://${trimmed.replace(/^www\./i, "")}`
}

import type {
  AudienceDefinition,
  AudienceFilter,
  AudienceGeography,
  AudienceListType,
  AudienceProviderId,
  AudienceQuantityKind,
  CampaignBrief,
} from "@/lib/campaign-creator/types"

import {
  fairHousingNote,
  findProtectedClasses,
  isHousingRelated,
  stripProtectedLanguage,
  type ProtectedClass,
} from "./fair-housing"
import { providerIdForListType, providerStateFor } from "./providers"

const EVERY_DOOR = /\bevery\s+door\b|\beddm\b|\bevery\s+mailbox\b|\bsaturation mail\b/i
const HOUSE =
  /\bhouse\s+list\b|\b(?:my|our|existing|past|current)\s+(?:customers?|clients?|patients?|donors?)\b|\bpast\s+customers?\b|\bcustomer list\b/i
const UPLOAD = /\bupload\b|\bmy list\b|\bcsv\b|\bspreadsheet\b/i
const PROSPECT = /\bprospect(?:s| list)?\b|\bpurchased list\b/i
const HOMEOWNER = /\bhome\s*owners?\b|\bown their homes?\b|\bproperty owners?\b/i
const FAMILIES =
  /\bfamilies with (?:young )?children\b|\bparents with (?:young )?children\b|\bhouseholds? with (?:kids|children)\b/i

export interface AudienceTurn {
  audience: AudienceDefinition
  blocked: ProtectedClass[]
  assistantNote: string
  showCard: boolean
}

function parseNumber(raw: string): number | undefined {
  const value = Number(raw.replace(/,/g, ""))
  if (!Number.isInteger(value) || value <= 0 || value > 5_000_000) return undefined
  return value
}

function parseMailQuantity(text: string): number | undefined {
  const cards = text.match(
    /\b(\d{1,3}(?:,\d{3})+|\d+)\s*(?:post\s*cards?|cards?|mailers?|pieces?|mailings?)\b/i
  )
  if (cards) {
    const value = parseNumber(cards[1])
    if (value !== undefined) return value
  }
  const send = text.match(/\bsend\s+(\d{1,3}(?:,\d{3})+|\d+)\b/i)
  if (!send) return undefined
  const value = parseNumber(send[1])
  // A bare 5-digit "send 92025" is a ZIP, not a piece count.
  if (value === undefined || String(value).length === 5) return undefined
  return value
}

function parseIncome(text: string): number | undefined {
  const match = text.match(
    /\b(?:household\s+)?income\s+(?:over|above|more than|at least|greater than|of)\s+\$?\s*([\d,]+)\s*(k\b)?/i
  )
  if (!match) return undefined
  const raw = Number(match[1].replace(/,/g, ""))
  if (!Number.isFinite(raw) || raw <= 0) return undefined
  const value = match[2] ? raw * 1_000 : raw
  if (value > 10_000_000) return undefined
  return value
}

function parseHomeAge(text: string): number | undefined {
  const match = text.match(
    /\b(?:homes?|houses?|properties)\s+(?:that are\s+|over\s+|older than\s+)?(\d{1,3})\s*\+?\s*years?\s+old\b/i
  )
  if (!match) return undefined
  const value = Number(match[1])
  if (!Number.isInteger(value) || value <= 0 || value > 200) return undefined
  return value
}

function parseYearBuilt(text: string): number | undefined {
  const match = text.match(/\bbuilt before\s+(19\d{2}|20\d{2})\b/i)
  if (!match) return undefined
  return Number(match[1])
}

function parseGeography(text: string): AudienceGeography | undefined {
  const radius = text.match(
    /\b(?:within\s+)?(\d+(?:\.\d+)?)\s+miles?\s+(?:of|around|from)\s+(\d{5})\b/i
  )
  if (radius) {
    const miles = Number(radius[1])
    const postalCode = radius[2]
    if (miles > 0 && miles <= 100) {
      const milesLabel = Number.isInteger(miles) ? String(miles) : String(miles)
      return {
        kind: "radius",
        postalCode,
        radiusMiles: miles,
        label: `Within ${milesLabel} miles of ${postalCode}`,
      }
    }
  }
  const zip = text.match(/\b(?:zip(?:\s*code)?|in|near|around)\s+(\d{5})\b/i)
  if (zip) {
    return { kind: "zip", postalCode: zip[1], label: `ZIP ${zip[1]}` }
  }
  return undefined
}

function money(value: number): string {
  return value.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 })
}

function upsert(filters: Map<string, AudienceFilter>, filter: AudienceFilter) {
  filters.set(filter.id, filter)
}

function soften(label: string): string {
  if (!label) return label
  return label.charAt(0).toLowerCase() + label.slice(1)
}

function describeAudience(
  geography: AudienceGeography | undefined,
  filters: AudienceFilter[],
  listType: AudienceListType | undefined
): string {
  const parts: string[] = []
  const homeowner = filters.find((filter) => filter.id === "homeowner")
  if (listType === "house") parts.push(homeowner ? "Your customers who own their homes" : "Your existing customers")
  else if (listType === "every_door") parts.push("Every Door")
  else if (homeowner) parts.push("Homeowners")
  if (geography) parts.push(parts.length === 0 ? geography.label : soften(geography.label))
  for (const filter of filters) {
    if (filter.id === "homeowner") continue
    parts.push(parts.length === 0 ? filter.label : soften(filter.label))
  }
  return parts.join(", ")
}

function listCue(text: string): { listType?: AudienceListType; explicitProvider?: AudienceProviderId } {
  if (EVERY_DOOR.test(text)) return { listType: "every_door" }
  if (UPLOAD.test(text)) {
    if (PROSPECT.test(text) && !HOUSE.test(text)) {
      return { listType: "prospect", explicitProvider: "upload" }
    }
    return { listType: HOUSE.test(text) || !PROSPECT.test(text) ? "house" : "prospect", explicitProvider: "upload" }
  }
  if (HOUSE.test(text)) return { listType: "house" }
  if (PROSPECT.test(text)) return { listType: "prospect" }
  return {}
}

function looksLikeAudience(text: string, parsed: boolean): boolean {
  if (parsed) return true
  return /\b(audience|mail to|send to|target|home\s*owners?|customers?|residents?|households?|every door|eddm|zip)\b/i.test(
    text
  )
}

/** A piece count the customer actually typed. Not a ZIP and not a household guess. */
export function pieceCountStatedIn(message: string): number | undefined {
  return parseMailQuantity(message)
}

export function audienceFromMessage(brief: CampaignBrief, message: string): AudienceTurn | null {
  const text = message.trim()
  if (!text) return null

  const housing = isHousingRelated(brief, text)
  const blocked = findProtectedClasses(text, housing)
  const cleaned = stripProtectedLanguage(text, housing)
  const existing = brief.audience

  const geography = parseGeography(cleaned) ?? existing?.geography
  const filters = new Map<string, AudienceFilter>((existing?.filters ?? []).map((filter) => [filter.id, filter]))
  if (HOMEOWNER.test(cleaned)) {
    upsert(filters, { id: "homeowner", field: "homeowner", label: "Homeowners", operator: "is", value: "yes" })
  }
  const homeAge = parseHomeAge(cleaned)
  if (homeAge !== undefined) {
    upsert(filters, {
      id: "home_age_years",
      field: "home_age_years",
      label: `Homes ${homeAge}+ years old`,
      operator: "gte",
      value: homeAge,
    })
  }
  const income = parseIncome(cleaned)
  if (income !== undefined) {
    upsert(filters, {
      id: "household_income",
      field: "household_income",
      label: `Income over ${money(income)}`,
      operator: "gte",
      value: income,
    })
  }
  const yearBuilt = parseYearBuilt(cleaned)
  if (yearBuilt !== undefined) {
    upsert(filters, {
      id: "year_built",
      field: "year_built",
      label: `Built before ${yearBuilt}`,
      operator: "lte",
      value: yearBuilt,
    })
  }
  if (!housing && FAMILIES.test(cleaned)) {
    upsert(filters, {
      id: "families_with_children",
      field: "custom",
      label: "Families with children",
      operator: "is",
      value: "yes",
    })
  }
  if (housing) filters.delete("families_with_children")

  const cue = listCue(cleaned)
  const parsedStructure =
    Boolean(parseGeography(cleaned)) ||
    HOMEOWNER.test(cleaned) ||
    homeAge !== undefined ||
    income !== undefined ||
    yearBuilt !== undefined ||
    (!housing && FAMILIES.test(cleaned)) ||
    Boolean(cue.listType)
  const quantity = parseMailQuantity(cleaned)
  if (!looksLikeAudience(cleaned, parsedStructure || quantity !== undefined || blocked.length > 0)) {
    return null
  }

  let listType = cue.listType ?? existing?.listType
  if (!listType && (geography || filters.size > 0)) listType = "prospect"

  const explicitProvider = cue.explicitProvider
  const fileCount =
    existing?.quantityKind === "from_upload" && existing.provider?.id === "upload" ? existing.quantity : undefined
  const provider = providerStateFor(
    listType,
    explicitProvider === "upload" || listType === "house" ? { uploadedRowCount: fileCount } : {},
    explicitProvider
  )

  let quantityKind: AudienceQuantityKind = existing?.quantityKind ?? "unavailable"
  let nextQuantity = existing?.quantity
  if (quantity !== undefined) {
    nextQuantity = quantity
    quantityKind = "requested"
  }
  if (provider?.id === "every_door" || provider?.id === "melissa") {
    if (quantityKind === "from_upload") {
      nextQuantity = quantity
      quantityKind = quantity !== undefined ? "requested" : "unavailable"
    }
  }
  if (nextQuantity === undefined) quantityKind = "unavailable"

  const filterList = [...filters.values()]
  const description =
    parsedStructure || !existing?.description
      ? describeAudience(geography, filterList, listType)
      : existing.description

  const audience: AudienceDefinition = {
    description,
    quantity: quantityKind === "unavailable" ? undefined : nextQuantity,
    quantityKind,
    geography,
    filters: filterList,
    listType,
    provider,
    fairHousingNote: fairHousingNote(blocked),
  }

  const note = audience.fairHousingNote
  const assistantNote = note
    ? `${note} The rest of the audience is on the card, and you can edit it.`
    : "Here's the audience I understood. Edit the card if anything is off. It will be waiting on the Audience step."

  const showCard = Boolean(
    audience.description ||
      audience.listType ||
      audience.geography ||
      (audience.filters && audience.filters.length > 0) ||
      audience.quantity ||
      note
  )

  return { audience, blocked, assistantNote, showCard }
}

function cleanText(brief: CampaignBrief, text: string): { text: string; blocked: ProtectedClass[] } {
  const housing = isHousingRelated(brief, text)
  const blocked = findProtectedClasses(text, housing)
  return { text: stripProtectedLanguage(text, housing).replace(/^[, ]+|[, ]+$/g, ""), blocked }
}

/**
 * Accepts an edit from the audience card or the audience step.
 * Recomputes the provider. Does not invent a count.
 */
export function acceptAudienceEdit(brief: CampaignBrief, draft: AudienceDefinition): AudienceDefinition {
  const descriptionClean = cleanText(brief, draft.description ?? "")
  const geographyLabel = draft.geography?.label ?? ""
  const geographyClean = cleanText(brief, geographyLabel)
  const blocked = [...new Set([...descriptionClean.blocked, ...geographyClean.blocked])]
  const filters = (draft.filters ?? []).flatMap((filter) => {
    const cleaned = cleanText(brief, filter.label)
    blocked.push(...cleaned.blocked)
    if (cleaned.blocked.length > 0) return []
    return [filter]
  })
  const uniqueBlocked = [...new Set(blocked)]

  const listType = draft.listType
  let quantity = draft.quantity
  let quantityKind: AudienceQuantityKind = draft.quantityKind ?? (quantity ? "requested" : "unavailable")
  if (typeof quantity !== "number" || !Number.isInteger(quantity) || quantity <= 0) {
    quantity = undefined
    quantityKind = "unavailable"
  }

  const keepUpload = listType === "prospect" && draft.provider?.id === "upload"
  const providerId = listType ? providerIdForListType(listType, keepUpload ? "upload" : undefined) : undefined
  if (providerId !== "upload" && quantityKind === "from_upload") {
    quantity = undefined
    quantityKind = "unavailable"
  }
  const provider = providerStateFor(
    listType,
    providerId === "upload" && quantityKind === "from_upload" ? { uploadedRowCount: quantity } : {},
    providerId
  )

  const geography = draft.geography
    ? { ...draft.geography, label: geographyClean.text || draft.geography.label }
    : undefined

  return {
    description: descriptionClean.text,
    quantity: quantityKind === "unavailable" ? undefined : quantity,
    quantityKind,
    geography: geography?.label ? geography : undefined,
    filters,
    listType,
    provider,
    fairHousingNote: fairHousingNote(uniqueBlocked),
  }
}

export function withRequestedQuantity(
  audience: AudienceDefinition | undefined,
  raw: string
): AudienceDefinition {
  const parsed = raw.trim() ? Number(raw) : undefined
  const quantity = parsed !== undefined && Number.isInteger(parsed) && parsed > 0 ? parsed : undefined
  return {
    description: audience?.description ?? "",
    ...audience,
    quantity,
    quantityKind: quantity ? "requested" : "unavailable",
  }
}

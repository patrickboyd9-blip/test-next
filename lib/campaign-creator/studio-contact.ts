/**
 * Print contact for a postcard face.
 * Brief values fill in when the spec is empty or still carrying toy chrome.
 * Not a CreativeSpec field.
 */
export interface PostcardIdentity {
  businessName?: string
  phone?: string
  website?: string
  qrDestination?: string
}

export interface StudioContact {
  businessName?: string
  phone?: string
  website?: string
  qrPayload: string | null
}

export function postcardIdentityFromBrief(brief: {
  phone?: string
  website?: string
  qrDestination?: string
  businessInfo?: { name?: string; phone?: string; website?: string }
}): PostcardIdentity {
  return {
    businessName: brief.businessInfo?.name,
    phone: brief.phone ?? brief.businessInfo?.phone,
    website: brief.website ?? brief.businessInfo?.website,
    qrDestination: brief.qrDestination,
  }
}

export function isToyPhone(value: string): boolean {
  const digits = value.replace(/\D/g, "")
  return digits === "1112223344" || digits === "11112223344" || /^0{7,}$/.test(digits)
}

export function isToyWebsite(value: string): boolean {
  const host = websiteHost(value)
  return (
    host === "abc.com" ||
    host === "example.com" ||
    host === "example.org" ||
    host === "test.com"
  )
}

export function displayWebsite(value: string): string {
  return value.trim().replace(/^https?:\/\//i, "").replace(/\/$/, "")
}

/**
 * Name to set in the type column. Hidden when the headline already is the name.
 * The logo slot still receives the raw name.
 */
export function businessNameForCard(
  businessName: string | undefined,
  headline: string | undefined
): string | undefined {
  const name = businessName?.trim()
  if (!name) return undefined
  if (headline?.trim().toLowerCase() === name.toLowerCase()) return undefined
  return name
}

export function resolveStudioContact(
  spec: { phone?: string; website?: string; qrDestination?: string },
  identity?: PostcardIdentity
): StudioContact {
  const phone = firstReal([spec.phone, identity?.phone], isToyPhone)
  const website = firstReal([spec.website, identity?.website], isToyWebsite)
  const qrPayload =
    firstScanTarget([spec.qrDestination, identity?.qrDestination], asUrl) ??
    firstScanTarget([spec.website, identity?.website, website], asUrl) ??
    firstScanTarget([spec.phone, identity?.phone, phone], asTel)

  const businessName = identity?.businessName?.trim() || undefined

  return {
    businessName,
    phone,
    website,
    qrPayload,
  }
}

function firstReal(
  values: Array<string | undefined>,
  isToy: (value: string) => boolean
): string | undefined {
  for (const value of values) {
    const trimmed = value?.trim()
    if (trimmed && !isToy(trimmed)) return trimmed
  }
  return undefined
}

function firstScanTarget(
  values: Array<string | undefined>,
  accept: (value: string) => string | null
): string | null {
  for (const value of values) {
    if (!value?.trim()) continue
    const accepted = accept(value)
    if (accepted) return accepted
  }
  return null
}

function asUrl(value: string): string | null {
  const trimmed = value.trim()
  if (!trimmed || isToyWebsite(trimmed)) return null
  if (/^https?:\/\/\S+$/i.test(trimmed)) return trimmed
  if (
    /^(?:www\.)?[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?(?:\.[a-z]{2,})(?:\/\S*)?$/i.test(
      trimmed
    )
  ) {
    return `https://${trimmed}`
  }
  return null
}

function asTel(value: string): string | null {
  const trimmed = value.trim()
  if (!trimmed || isToyPhone(trimmed)) return null
  if (!/^[\d\s().+-]+$/.test(trimmed) && !/^tel:/i.test(trimmed)) return null
  const hasPlus = trimmed.startsWith("+") || /^tel:\+/i.test(trimmed)
  const digits = trimmed.replace(/\D/g, "")
  if (digits.length < 7 || digits.length > 15) return null
  return `tel:${hasPlus ? "+" : ""}${digits}`
}

function websiteHost(value: string): string | null {
  const trimmed = value.trim().replace(/^https?:\/\//i, "").replace(/^www\./i, "")
  const host = trimmed.split(/[/?#]/)[0]?.toLowerCase()
  return host || null
}

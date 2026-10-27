/** Business Customer Gateway. A business registers here, at no charge, and receives a CRID. */
export const USPS_CRID_URL = "https://gateway.usps.com/"

export function eddmCridMissingMessage(): string {
  return "Full Service Every Door needs your Postal Service business ID (CRID). Without it, Click2Mail holds the job. Enter the number for this business. You only do this once."
}

export function eddmCridInvalidMessage(): string {
  return "That does not look like a CRID. It is the number on your Postal Service business account, with no letters."
}

export function eddmCridHelp(): string {
  return "A CRID is the free ID the Postal Service gives your business. Full Service Every Door needs it on the paperwork. You only enter it once for this business."
}

/** USPS CRIDs are numbers. Spaces and dashes are ignored. */
export function normalizeUspsCrid(value: string | undefined): string | null {
  const trimmed = value?.trim() ?? ""
  if (!trimmed) return null
  if (!/^[\d\s-]+$/.test(trimmed)) return null
  const digits = trimmed.replace(/\D/g, "")
  if (digits.length < 5 || digits.length > 15) return null
  return digits
}

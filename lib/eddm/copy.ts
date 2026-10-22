/**
 * EDDM has no recipient name. The card speaks to the neighborhood.
 */

const PERSONALIZATION = [
  /\{\{[^}]+\}\}/g,
  /\{(?:first|last|full|name|firstname|lastname)[^}]*\}/gi,
  /%\s*(?:FIRST|LAST|FNAME|LNAME|NAME)\s*%/gi,
  /<<\s*(?:first|last|name)[^>]*>>/gi,
  /\bDear\s+[A-Z][a-zA-Z'’.-]+/g,
  /\bHi\s+[A-Z][a-zA-Z'’.-]+/g,
  /\bHello\s+[A-Z][a-zA-Z'’.-]+/g,
]

export function eddmCopyRules(neighborhood?: string): string {
  const who = neighborhood?.trim()
    ? `Neighbors in ${neighborhood.trim()}`
    : "Neighbors on this route"
  return `Every Door Direct Mail rules:
- The piece goes to every address on the chosen routes. It is addressed to POSTAL CUSTOMER.
- Do not use a first name, last name, or a mail-merge token.
- Speak to the neighborhood. ${who} is the audience.
- A concrete offer, such as a coupon, belongs on the card.
- Do not write this as a Medicare mailing.`
}

export function toNeighborhoodCopy(text: string, neighborhood?: string): string {
  const replacement = neighborhood?.trim() ? `Neighbors in ${neighborhood.trim()}` : "Neighbors"
  let next = text
  for (const pattern of PERSONALIZATION) {
    pattern.lastIndex = 0
    next = next.replace(pattern, replacement)
  }
  return next.replace(/\s{2,}/g, " ").trim()
}

export function hasRecipientPersonalization(text: string): boolean {
  return PERSONALIZATION.some((pattern) => {
    pattern.lastIndex = 0
    return pattern.test(text)
  })
}

export function eddmBlockedReason(text: string): string | null {
  if (/\bmedicare\b/i.test(text)) {
    return "Every Door Direct Mail goes to every address on a route. It is not a fit for Medicare, which has to reach a specific person."
  }
  return null
}

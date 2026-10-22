import { eddmBlockedReason } from "./copy"
import { isEddmSize } from "./geometry"
import { summarizeSelection, type EddmAudience } from "./routes"

export function eddmAudienceIssue(input: {
  text: string
  audience: EddmAudience | undefined
}): string | null {
  const blocked = eddmBlockedReason(input.text)
  if (blocked) return blocked
  const audience = input.audience
  if (!audience) return "Choose the routes for this Every Door mailing."
  if (!isEddmSize(audience.size)) return "Choose a 6.5×9 or 6.25×11 card. A smaller postcard is not an EDDM flat."
  if (!audience.routes.length) return "Select at least one carrier route."
  const summary = summarizeSelection(audience.routes, audience.coverage)
  return summary.messages[0] ?? null
}

export function eddmAudienceDescription(audience: EddmAudience): string {
  const neighborhood = audience.neighborhood?.trim()
  if (neighborhood) return `Neighbors in ${neighborhood}`
  if (audience.zip) return `Every door on the selected routes in ${audience.zip}`
  return "Every door in this area"
}

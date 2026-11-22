import type { LockedHeroSize } from "@/lib/mail-templates/locked-hero"

export interface LockedHeroInstructionInput {
  campaignName: string
  size: LockedHeroSize
  businessName: string
  offer: string
  callToAction: string
  phone: string
  website: string
  instructions: string
  changeNote: string
  hasLogo: boolean
}

/** The edit request. Stays on the server. */
export function lockedHeroInstruction(input: LockedHeroInstructionInput): string {
  const lines = [
    "Edit this postcard. Keep the photograph they locked unless they asked to change it.",
    `Campaign: ${input.campaignName}`,
    `Postcard size: ${input.size === "6x9" ? "6 by 9 inches" : "5 by 8 inches"}`,
    `Business name: ${input.businessName}`,
    `Offer: ${input.offer}`,
    `Call to action: ${input.callToAction}`,
    `Phone: ${input.phone}`,
  ]
  if (input.website) lines.push(`Website: ${input.website}`)
  lines.push(`What they want changed: ${input.instructions}`)
  if (input.changeNote) lines.push(`Change the current proof like this: ${input.changeNote}`)
  lines.push(
    input.hasLogo
      ? "Place the attached logo where a logo belongs, small enough to leave the design intact."
      : "Do not add a logo."
  )
  lines.push("If a faint PROOF mark is already on the picture, leave it out. It is not part of the card.")
  return lines.join("\n")
}

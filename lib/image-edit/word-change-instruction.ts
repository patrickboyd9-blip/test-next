import type { LogoPlacement } from "./logo-placement"

const PLACEMENT_LINE: Record<LogoPlacement, string> = {
  "top-left": "Place the attached logo in the top left, small enough to leave the design intact.",
  "top-right": "Place the attached logo in the top right, small enough to leave the design intact.",
  "bottom-left": "Place the attached logo in the bottom left, small enough to leave the design intact.",
  "bottom-right": "Place the attached logo in the bottom right, small enough to leave the design intact.",
  "center-top": "Place the attached logo along the top center, small enough to leave the design intact.",
  "replace-existing": "Replace the existing logo with the attached logo. Keep it about the same size and in the same place.",
}

export interface WordChangeCopy {
  businessName: string
  headline: string
  phone: string
  website: string
  extra: string
  placement: LogoPlacement | null
}

/** The edit request. Stays on the server. */
export function wordChangeInstruction(copy: WordChangeCopy): string {
  const lines = [
    "Rewrite only the words already printed on this postcard.",
    "Keep the design, colors, photographs, and layout.",
    `Business name: ${copy.businessName}`,
    `Headline or offer: ${copy.headline}`,
    `Phone: ${copy.phone}`,
  ]
  if (copy.website) lines.push(`Website: ${copy.website}`)
  if (copy.extra) lines.push(`Short extra line: ${copy.extra}`)
  lines.push(copy.placement ? PLACEMENT_LINE[copy.placement] : "Do not add a logo.")
  return lines.join("\n")
}

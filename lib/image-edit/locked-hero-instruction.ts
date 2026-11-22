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

const CHANGE_START =
  /^(?:and\s+)?(?:change|replace|make|swap|turn|use|put|move|add|remove|keep|redraw|update|rename|set)\b/i

/** The edit request. Stays on the server. */
export function lockedHeroInstruction(input: LockedHeroInstructionInput): string {
  const note = [input.instructions, input.changeNote].filter(Boolean).join(" ")
  const changes = requiredChanges(input.instructions, input.changeNote)
  const lines = [
    "Edit this postcard. Every change in the list below is required. Do each one. Do not skip any.",
    "Required changes:",
    ...changes.map((change, index) => `${index + 1}. ${change}`),
    "When a required change asks you to replace or redraw the main subject (a person, an animal, or an object), do that. Keep the same pose, size, position, lighting, and photo style.",
    "Preserve everything that was not requested. Keep the overall layout, the composition, and the text positions, font styles, sizes, and colors of untouched elements.",
    "A new business name replaces the existing business name or logo in the same spot and at a similar size. A top-corner logo stays a top-corner logo. Never move the business name into the headline, and never replace the headline, unless a required change asks for that.",
  ]
  const rename = nameReplacement(note, input.businessName)
  if (rename) lines.push(rename)
  lines.push(
    input.hasLogo
      ? "Place the attached logo in the existing logo position, or in the position a required change names, at a similar size. Do not move the logo into the headline."
      : "Do not add a logo."
  )
  lines.push(
    "Keep text spelled exactly as given. Do not invent extra text. Keep the bottom disclaimer bar unless a required change asks to change it.",
    "Use the offer, call to action, phone, and website below only as the exact spelling when a required change touches that line, or when that line is already printed. Do not replace the headline with them unless a required change says to."
  )
  lines.push(
    `Campaign: ${input.campaignName}`,
    `Postcard size: ${input.size === "6x9" ? "6 by 9 inches" : "5 by 8 inches"}`,
    `Business name, in the existing name or logo spot: ${input.businessName}`,
    `Offer: ${input.offer}`,
    `Call to action: ${input.callToAction}`,
    `Phone: ${input.phone}`
  )
  if (input.website) lines.push(`Website: ${input.website}`)
  lines.push("Do not add a watermark. If a faint PROOF mark is already on the picture, leave it out. It is not part of the card.")
  return lines.join("\n")
}

function requiredChanges(instructions: string, changeNote: string): string[] {
  const changes = [...listedChanges(instructions), ...listedChanges(changeNote)]
  if (changes.length > 0) return changes
  return ["No separate change was written. Change nothing except the placement rules below."]
}

function listedChanges(text: string): string[] {
  const source = text.replace(/\s+/g, " ").trim()
  if (!source) return []
  const markers = source.match(/(?:^|\s)(?:\(\d{1,2}\)|\d{1,2}[.)])\s+\S/g)
  if (markers && markers.length >= 2) {
    return source
      .split(/\s*(?:\(\d{1,2}\)|\d{1,2}[.)])\s+/)
      .flatMap(splitClauses)
  }
  if (source.includes(";")) {
    const parts = source.split(/\s*;\s*/).flatMap(splitClauses)
    if (parts.length >= 2) return parts
  }
  const sentences = source.split(/(?<=[.!?])\s+(?=[A-Z“"'])/).flatMap(splitClauses)
  return sentences.length > 0 ? sentences : splitClauses(source)
}

function splitClauses(text: string): string[] {
  const tidy = text.replace(/\s+/g, " ").trim().replace(/^[*-]\s*/, "").replace(/[;,]\s*$/, "")
  if (!tidy) return []
  const commas = tidy.split(/\s*,\s+/).map(stripLead).filter(Boolean)
  if (commas.length >= 2 && commas.every((piece) => CHANGE_START.test(piece))) return commas
  const ands = tidy.split(/\s+and\s+/i).map(stripLead).filter(Boolean)
  if (ands.length >= 2 && ands.every((piece) => CHANGE_START.test(piece))) return ands
  return [tidy]
}

function stripLead(value: string): string {
  return value.replace(/^and\s+/i, "").replace(/[;,]\s*$/, "").trim()
}

function nameReplacement(note: string, businessName: string): string | null {
  const next = businessName.replace(/\s+/g, " ").trim()
  if (next.length < 2) return null
  const old = previousBusinessName(note, next)
  const quotedOld = old ? ` "${old}"` : ""
  return `Replace the business name/logo text${quotedOld} with "${next}" in the same location.`
}

function previousBusinessName(note: string, businessName: string): string | null {
  const escaped = businessName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  const patterns = [
    new RegExp(
      String.raw`(?:(?:business|company)\s+name|logo(?:\s+text)?)\s+from\s+["“']?(.+?)["”']?\s+to\s+["“']?${escaped}\b`,
      "i"
    ),
    new RegExp(
      String.raw`\b(?:change|replace|rename)\s+["“']([^"”']+?)["”']\s+to\s+["“']?${escaped}\b`,
      "i"
    ),
    new RegExp(
      String.raw`\b(?:change|replace|rename)\s+(?!the\s+(?:business|company|dog|color|colour|headline|photo|picture|name|logo|top|panel)\b)([A-Z][^.,;]{1,80}?)\s+to\s+["“']?${escaped}\b`,
      "i"
    ),
  ]
  for (const pattern of patterns) {
    const found = pattern.exec(note)?.[1]?.replace(/\s+/g, " ").trim().replace(/^["“']+|["”']+$/g, "")
    if (!found || found.length < 2 || found.length > 80) continue
    if (found.toLowerCase() === businessName.toLowerCase()) continue
    return found
  }
  return null
}

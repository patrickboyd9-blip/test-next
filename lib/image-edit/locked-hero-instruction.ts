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
  /** When true, the front must show this phone number. When false, leave the front phone alone. */
  phoneOnFront: boolean
  /** Printed brand from gallery data, when we know it. */
  originalBusinessName: string | null
}

const CHANGE_START =
  /^(?:and\s+)?(?:change|replace|make|swap|turn|use|put|move|add|remove|keep|redraw|update|rename|set)\b/i

/** The edit request. Stays on the server. */
export function lockedHeroInstruction(input: LockedHeroInstructionInput): string {
  const phone = phoneOnFrontRule(input.phone, input.phoneOnFront)
  const changes = [
    ...listedChanges(input.instructions),
    ...listedChanges(input.changeNote),
    ...nameMustDo(input.businessName, input.originalBusinessName),
    ...phone.changes,
  ]
  const required =
    changes.length > 0
      ? changes
      : ["No separate change was written. Change nothing except the placement rules below."]
  const lines = [
    "Edit this postcard. Every change in the list below is required. Do each one. Do not skip any.",
    "Required changes:",
    ...required.map((change, index) => `${index + 1}. ${change}`),
  ]
  if (phone.hold) lines.push(phone.hold)
  lines.push(
    "When a required change asks you to replace or redraw the main subject (a person, an animal, or an object), do that. Keep the same pose, size, position, lighting, and photo style.",
    "Preserve everything that was not requested. Keep the overall layout, the composition, and the text positions, font styles, sizes, and colors of untouched elements.",
    "When a required change replaces the business name, replace every mention, each in the same spot and at a similar size. A top-corner logo stays a top-corner logo. Never move the business name into the headline, and never replace the headline, unless a required change asks for that.",
  )
  lines.push(
    input.hasLogo
      ? "Place the attached logo in the existing logo position, or in the position a required change names, at a similar size. Do not move the logo into the headline."
      : "Do not add a logo."
  )
  lines.push(
    "Keep text spelled exactly as given. Do not invent extra text. Keep the bottom disclaimer bar unless a required change asks to change it.",
    phone.changes.length > 0
      ? "Use the offer, call to action, phone, and website below only as the exact spelling when a required change touches that line, or when that line is already printed. Do not replace the headline with them unless a required change says to."
      : "Use the offer, call to action, and website below only as the exact spelling when a required change touches that line, or when that line is already printed. Do not replace the headline with them unless a required change says to."
  )
  lines.push(
    `Campaign: ${input.campaignName}`,
    `Postcard size: ${input.size === "6x9" ? "6 by 9 inches" : "5 by 8 inches"}`,
    `Business name: ${input.businessName}`,
    `Offer: ${input.offer}`,
    `Call to action: ${input.callToAction}`,
    `Phone: ${input.phone}`
  )
  if (input.website) lines.push(`Website: ${input.website}`)
  lines.push("Do not add a watermark. If a faint PROOF mark is already on the picture, leave it out. It is not part of the card.")
  return lines.join("\n")
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

function nameMustDo(businessName: string, originalBusinessName: string | null): string[] {
  const next = businessName.replace(/\s+/g, " ").trim()
  if (next.length < 2) return []
  const old = (originalBusinessName ?? "").replace(/\s+/g, " ").trim()
  if (old.length >= 2 && old.toLowerCase() === next.toLowerCase()) return []
  if (old.length >= 2) {
    return [
      `Replace every mention of "${old}" on the front with "${next}". Include the logo text, logo subtitle or descriptor words that are part of "${old}" (including a subtitle that is only one word from that name), and any body or offer text that mentions it. Keep each in its same spot and style.`,
    ]
  }
  return [
    `Replace every mention of the existing business name and any words of it on the front with "${next}". Include the logo text, logo subtitle or descriptor words that are part of the existing business name, and any body or offer text that mentions it. Keep each in its same spot and style.`,
  ]
}

function phoneOnFrontRule(
  phone: string,
  phoneOnFront: boolean
): { changes: string[]; hold: string | null } {
  const typed = phone.replace(/\s+/g, " ").trim()
  if (!phoneOnFront || typed.length === 0) {
    return {
      changes: [],
      hold: "Do not add a phone number to the front. Do not remove or replace a phone number unless a required change asks for that.",
    }
  }
  return {
    changes: [
      `Add the phone number exactly as typed, "${typed}", to the front, near the call to action (under or beside the call-to-action line), in a legible size and a font and color matching the design, without covering the main subject or the offer, and without moving other elements. If the original already shows a phone number, replace it in place instead.`,
    ],
    hold: null,
  }
}

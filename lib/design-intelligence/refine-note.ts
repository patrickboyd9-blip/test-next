import { hexToRgb } from "./contrast"
import { composeGridCard, textIsClipped, type GridCard } from "./grid-composer"
import { headlineRepeatsOffer, containsZeroDollar } from "./offer-copy"
import type { DesignRationale, TypeSeat } from "./rationale"
import { isDesignRationale } from "./rationale"
import type { CreativeSpec } from "@/lib/campaign-creator/types"

/**
 * Plain-English refine notes. A note can ask for several changes.
 * Copy-only rewrites stay with the creative engine.
 * A change that does not alter the rendered card is not a success.
 */

export type DesignIntent = "contrast" | "offer-scale" | "new-photo" | "warmer" | "show-full" | "sky"

export interface DesignRevision {
  handled: boolean
  ok: boolean
  spec: CreativeSpec
  explanation: string
  intent: DesignIntent | null
}

export interface RefineOptions {
  businessName?: string
  /** The seat Studio is already painting, when the spec has not stored one. */
  photoSeat?: TypeSeat | null
}

export function reviseFromNote(spec: CreativeSpec, note: string, options?: RefineOptions): DesignRevision {
  const intents = designIntents(note)
  if (intents.length === 0 || !isDesignRationale(spec.designRationale)) {
    return { handled: false, ok: false, spec, explanation: "", intent: null }
  }
  let next = spec
  for (const intent of intents) next = applyIntent(next, intent)
  for (let attempt = 0; attempt < 4 && !revisionLanded(spec, next, intents, options); attempt += 1) {
    next = strengthen(spec, next, intents, options)
  }
  const safety = safetyCheck(spec, next)
  if (!safety.ok) {
    return { handled: true, ok: false, spec, explanation: safety.explanation, intent: intents[0] ?? null }
  }
  if (!revisionLanded(spec, next, intents, options)) {
    return {
      handled: true,
      ok: false,
      spec,
      explanation: "The card did not change, so that note was not applied.",
      intent: intents[0] ?? null,
    }
  }
  return {
    handled: true,
    ok: true,
    spec: next,
    explanation: explain(intents),
    intent: intents[0] ?? null,
  }
}

export function designIntent(note: string): DesignIntent | null {
  return designIntents(note)[0] ?? null
}

export function designIntents(note: string): DesignIntent[] {
  const text = note.replace(/\s+/g, " ").trim()
  if (!text) return []
  const intents: DesignIntent[] = []
  if (/cut off|clipped|truncat|show it in full|in full|entire headline|overflow/i.test(text)) intents.push("show-full")
  if (/sky side|on the sky|the sky/i.test(text)) intents.push("sky")
  if (/hard to see|can(?:not|'t) read|washed|contrast|on the photo/i.test(text)) intents.push("contrast")
  if (/bigger|larger|make free|free bigger/i.test(text)) intents.push("offer-scale")
  if (/different photo|new photo|another photo|change the photo/i.test(text)) intents.push("new-photo")
  if (/warmer|warm color|more warmth/i.test(text)) intents.push("warmer")
  if (intents.length === 0 && /\b(headline|say|rewrite|body copy|call to action)\b/i.test(text)) return []
  return intents
}

/** A tall rail on the calm side, starting in the sky. */
export function skyRail(current?: TypeSeat | null): TypeSeat {
  const side = current?.side ?? "left"
  return {
    side,
    ink: current?.ink ?? "dark",
    scrim: true,
    shadow: true,
    rect: {
      x: side === "right" ? 0.46 : 0,
      y: 0,
      w: Math.max(0.48, current?.rect.w ?? 0),
      h: 0.92,
    },
  }
}

function applyIntent(spec: CreativeSpec, intent: DesignIntent): CreativeSpec {
  const next = structuredClone(spec)
  if (!isDesignRationale(next.designRationale)) return next
  const design = next.designRationale
  if (intent === "contrast") {
    design.type_seat = contrastSeat(design.type_seat)
  } else if (intent === "offer-scale") {
    design.scale_ratios = {
      ...design.scale_ratios,
      hero: "offer",
      offer_to_headline_cap: Math.min(2.4, Math.max(1.85, design.scale_ratios.offer_to_headline_cap + 0.25)),
    }
    design.refine = { ...design.refine, minOfferPt: Math.max(design.refine?.minOfferPt ?? 0, 48) }
  } else if (intent === "new-photo") {
    const direction = next.visualDirection?.trim() ?? ""
    next.visualDirection = `${direction} Another angle of the same job, with open sky or a plain wall on one side.`.trim()
  } else if (intent === "warmer") {
    design.palette = {
      ...design.palette,
      accent_hex: warmHex(design.palette.accent_hex),
      neutral_hex: design.palette.neutral_hex.map((hex, index) => (index === 0 ? warmHex(hex) : hex)) as typeof design.palette.neutral_hex,
    }
    if (Array.isArray(next.palette) && next.palette.length > 0) {
      next.palette = [warmHex(next.palette[0] ?? "#C4371C"), ...next.palette.slice(1)]
    }
  } else if (intent === "show-full") {
    design.refine = { ...design.refine, showAllCopy: true }
  } else {
    design.refine = { ...design.refine, skySide: true, showAllCopy: true }
    design.type_seat = skyRail(design.type_seat)
  }
  next.designRationale = design
  return next
}

function strengthen(before: CreativeSpec, after: CreativeSpec, intents: DesignIntent[], options?: RefineOptions): CreativeSpec {
  const next = structuredClone(after)
  if (!isDesignRationale(next.designRationale) || !isDesignRationale(before.designRationale)) return next
  const design = next.designRationale
  const beforeOffer = composeResolved(before, options).front.texts.find((text) => text.role === "offer")?.fontPt ?? 36
  const afterOffer = composeResolved(after, options).front.texts.find((text) => text.role === "offer")?.fontPt ?? beforeOffer
  if (intents.includes("offer-scale")) {
    const grown = afterOffer > beforeOffer + 0.4
    design.scale_ratios = {
      ...design.scale_ratios,
      hero: "offer",
      offer_to_headline_cap: Math.min(2.4, design.scale_ratios.offer_to_headline_cap + 0.4),
    }
    design.refine = {
      ...design.refine,
      minOfferPt: Math.max(design.refine?.minOfferPt ?? 0, grown ? afterOffer : Math.max(beforeOffer, afterOffer) + 8),
    }
  }
  if (intents.includes("show-full") || intents.includes("sky") || intents.includes("contrast")) {
    design.refine = { ...design.refine, showAllCopy: true, skySide: design.refine?.skySide || intents.includes("sky") }
    design.type_seat = skyRail(design.type_seat ?? options?.photoSeat)
  }
  next.designRationale = design
  return next
}

const LAYOUT_INTENTS: readonly DesignIntent[] = ["show-full", "offer-scale", "sky", "contrast"]

/** A layout note has to change the painted card. A photo or palette note has to change that request. */
function revisionLanded(before: CreativeSpec, after: CreativeSpec, intents: DesignIntent[], options?: RefineOptions): boolean {
  if (!intents.every((intent) => intentMet(before, after, intent, options))) return false
  const paintChanged = paintSignature(before, options) !== paintSignature(after, options)
  if (intents.some((intent) => LAYOUT_INTENTS.includes(intent))) return paintChanged
  return paintChanged || intents.length > 0
}

function paintSignature(spec: CreativeSpec, options?: RefineOptions): string {
  const card = composeResolved(spec, options)
  const lines = card.front.texts.map((text) =>
    `${text.role}:${text.fontPt}:${text.lines.join("/")}:${text.rect.x.toFixed(2)}:${text.rect.y.toFixed(2)}:${text.rect.w.toFixed(2)}:${text.rect.h.toFixed(2)}`
  )
  const seat = isDesignRationale(spec.designRationale) ? resolvedSeat(spec.designRationale, options?.photoSeat) : null
  return [...lines, seat ? `${seat.side}:${seat.rect.w.toFixed(2)}:${seat.rect.h.toFixed(2)}` : "noseat"].join("|")
}

function composeResolved(spec: CreativeSpec, options?: RefineOptions): GridCard {
  const rationale = isDesignRationale(spec.designRationale) ? spec.designRationale : null
  if (!rationale) {
    throw new Error("Refine comparison needs a design rationale.")
  }
  const seat = resolvedSeat(rationale, options?.photoSeat)
  return composeGridCard({
    rationale: seat ? { ...rationale, type_seat: seat } : rationale,
    spec,
    businessName: options?.businessName,
  })
}

function intentMet(before: CreativeSpec, after: CreativeSpec, intent: DesignIntent, options?: RefineOptions): boolean {
  if (intent === "new-photo") return (before.visualDirection ?? "") !== (after.visualDirection ?? "")
  if (intent === "warmer") return paletteKey(before) !== paletteKey(after)
  if (intent === "contrast") {
    const seat = isDesignRationale(after.designRationale) ? after.designRationale.type_seat : null
    return Boolean(seat?.scrim)
  }
  if (intent === "sky") {
    const design = isDesignRationale(after.designRationale) ? after.designRationale : null
    return Boolean(design?.refine?.skySide)
  }
  if (intent === "offer-scale") return offerPt(after, options) > offerPt(before, options) + 0.4
  const card = composeResolved(after, options)
  const texts = [...card.front.texts]
  if (card.front.lockup?.phone) texts.push(card.front.lockup.phone)
  if (card.front.lockup?.website) texts.push(card.front.lockup.website)
  return !card.front.overflows && texts.every((text) => !textIsClipped(text))
}

function offerPt(spec: CreativeSpec, options?: RefineOptions): number {
  return composeResolved(spec, options).front.texts.find((text) => text.role === "offer")?.fontPt ?? 0
}

function paletteKey(spec: CreativeSpec): string {
  if (!isDesignRationale(spec.designRationale)) return ""
  const palette = spec.designRationale.palette
  return `${palette.accent_hex}|${palette.neutral_hex.join(",")}`
}

function resolvedSeat(rationale: DesignRationale, photoSeat?: TypeSeat | null): TypeSeat | null {
  if (rationale.refine?.skySide) return skyRail(photoSeat ?? rationale.type_seat)
  return rationale.type_seat ?? photoSeat ?? null
}

function safetyCheck(before: CreativeSpec, after: CreativeSpec): { ok: boolean; explanation: string } {
  if (before.phone !== after.phone) return { ok: false, explanation: "The phone number moved. That note was not applied." }
  const painted = `${after.headline ?? ""} ${after.offer ?? ""}`
  if (containsZeroDollar(painted)) return { ok: false, explanation: "The card would have painted $0. That note was not applied." }
  if (before.headline && after.headline && headlineRepeatsOffer(after.headline, after.offer ?? "") && !headlineRepeatsOffer(before.headline, before.offer ?? "")) {
    return { ok: false, explanation: "The headline would repeat the offer. That note was not applied." }
  }
  return { ok: true, explanation: "" }
}

function explain(intents: DesignIntent[]): string {
  const lines: string[] = []
  if (intents.includes("show-full")) lines.push("The headline is shown in full.")
  if (intents.includes("offer-scale")) lines.push("FREE is larger than the headline.")
  if (intents.includes("sky")) lines.push("The type sits on the sky side.")
  if (intents.includes("contrast")) lines.push("Type moved onto a calmer patch, with a light scrim so the small lines clear the photograph.")
  if (intents.includes("new-photo")) lines.push("A new photograph is on the way, with open sky or wall for the type.")
  if (intents.includes("warmer")) lines.push("The palette is warmer.")
  return lines.join(" ")
}

function contrastSeat(current: TypeSeat | undefined): TypeSeat {
  const side = current?.side === "right" ? "left" : "right"
  return {
    side,
    ink: "dark",
    scrim: true,
    shadow: true,
    rect: side === "right"
      ? { x: 0.5, y: 0.04, w: 0.44, h: 0.7 }
      : { x: 0.04, y: 0.04, w: 0.44, h: 0.7 },
  }
}

function warmHex(hex: string): string {
  const [r, g, b] = hexToRgb(hex)
  return `#${channel(r + 28)}${channel(Math.round(g * 0.94))}${channel(b - 32)}`
}

function channel(value: number): string {
  return Math.max(0, Math.min(255, value)).toString(16).padStart(2, "0")
}

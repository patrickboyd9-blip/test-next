import { hexToRgb } from "./contrast"
import { headlineRepeatsOffer, containsZeroDollar } from "./offer-copy"
import type { DesignRationale, TypeSeat } from "./rationale"
import { isDesignRationale } from "./rationale"
import type { CreativeSpec } from "@/lib/campaign-creator/types"

/**
 * Plain-English refine notes, turned into one concrete design change.
 * Copy notes stay with the creative engine. These four are design.
 */

export type DesignIntent = "contrast" | "offer-scale" | "new-photo" | "warmer"

export interface DesignRevision {
  handled: boolean
  ok: boolean
  spec: CreativeSpec
  explanation: string
  intent: DesignIntent | null
}

export function reviseFromNote(spec: CreativeSpec, note: string): DesignRevision {
  const intent = designIntent(note)
  if (!intent || !isDesignRationale(spec.designRationale)) {
    return { handled: false, ok: false, spec, explanation: "", intent: null }
  }
  const next = applyIntent(spec, spec.designRationale, intent)
  const check = verifyDesignChange(spec, next, intent)
  return {
    handled: true,
    ok: check.ok,
    spec: check.ok ? next : spec,
    explanation: check.explanation,
    intent,
  }
}

export function designIntent(note: string): DesignIntent | null {
  const text = note.replace(/\s+/g, " ").trim()
  if (!text) return null
  if (/\b(headline|say|rewrite|body copy|call to action)\b/i.test(text) && !/\b(free|photo|color|warmer|contrast|hard to see)\b/i.test(text)) {
    return null
  }
  if (/hard to see|can(?:not|'t) read|washed|contrast|on the photo/i.test(text)) return "contrast"
  if (/bigger|larger|make free|free bigger/i.test(text)) return "offer-scale"
  if (/different photo|new photo|another photo|change the photo/i.test(text)) return "new-photo"
  if (/warmer|warm color|more warmth/i.test(text)) return "warmer"
  return null
}

function applyIntent(spec: CreativeSpec, rationale: DesignRationale, intent: DesignIntent): CreativeSpec {
  const next = structuredClone(spec)
  const design = structuredClone(rationale)
  if (intent === "contrast") {
    design.type_seat = contrastSeat(design.type_seat)
  } else if (intent === "offer-scale") {
    design.scale_ratios = {
      ...design.scale_ratios,
      hero: "offer",
      offer_to_headline_cap: Math.min(2.4, Math.max(1.85, design.scale_ratios.offer_to_headline_cap + 0.2)),
    }
  } else if (intent === "new-photo") {
    const direction = next.visualDirection?.trim() ?? ""
    next.visualDirection = `${direction} Another angle of the same job, with open sky or a plain wall on one side.`.trim()
  } else {
    design.palette = {
      ...design.palette,
      accent_hex: warmHex(design.palette.accent_hex),
      neutral_hex: design.palette.neutral_hex.map((hex, index) => (index === 0 ? warmHex(hex) : hex)) as typeof design.palette.neutral_hex,
    }
    if (Array.isArray(next.palette) && next.palette.length > 0) {
      next.palette = [warmHex(next.palette[0] ?? "#C4371C"), ...next.palette.slice(1)]
    }
  }
  next.designRationale = design
  return next
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

export function verifyDesignChange(before: CreativeSpec, after: CreativeSpec, intent: DesignIntent): { ok: boolean; explanation: string } {
  const prior = isDesignRationale(before.designRationale) ? before.designRationale : null
  const next = isDesignRationale(after.designRationale) ? after.designRationale : null
  if (!prior || !next) return { ok: false, explanation: "The note did not land on this card." }
  if (before.phone !== after.phone) return { ok: false, explanation: "The phone number moved. That note was not applied." }
  const painted = `${after.headline ?? ""} ${after.offer ?? ""}`
  if (containsZeroDollar(painted)) return { ok: false, explanation: "The card would have painted $0. That note was not applied." }
  if (before.headline && after.headline && headlineRepeatsOffer(after.headline, after.offer ?? "") && !headlineRepeatsOffer(before.headline, before.offer ?? "")) {
    return { ok: false, explanation: "The headline would repeat the offer. That note was not applied." }
  }
  if (intent === "contrast") {
    const moved = next.type_seat?.scrim === true && (next.type_seat.side !== prior.type_seat?.side || next.type_seat.ink !== prior.type_seat?.ink || !prior.type_seat)
    if (!moved) return { ok: false, explanation: "The type is still sitting where it was." }
    return { ok: true, explanation: "Type moved onto a calmer patch, with a light scrim so the small lines clear the photograph." }
  }
  if (intent === "offer-scale") {
    const grew = next.scale_ratios.hero === "offer" && next.scale_ratios.offer_to_headline_cap > prior.scale_ratios.offer_to_headline_cap
    if (!grew && !(prior.scale_ratios.hero !== "offer" && next.scale_ratios.hero === "offer")) {
      return { ok: false, explanation: "FREE is the same size as before." }
    }
    return { ok: true, explanation: "FREE is larger than the headline." }
  }
  if (intent === "new-photo") {
    if ((after.visualDirection ?? "") === (before.visualDirection ?? "")) {
      return { ok: false, explanation: "The photograph brief did not change." }
    }
    return { ok: true, explanation: "A new photograph is on the way, with open sky or wall for the type." }
  }
  if (next.palette.accent_hex === prior.palette.accent_hex) {
    return { ok: false, explanation: "The colors stayed the same." }
  }
  return { ok: true, explanation: "The palette is warmer." }
}

function warmHex(hex: string): string {
  const [r, g, b] = hexToRgb(hex)
  return `#${channel(r + 28)}${channel(Math.round(g * 0.94))}${channel(b - 32)}`
}

function channel(value: number): string {
  return Math.max(0, Math.min(255, value)).toString(16).padStart(2, "0")
}

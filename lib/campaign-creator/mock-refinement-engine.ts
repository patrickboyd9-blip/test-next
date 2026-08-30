import type { CampaignBrief, CreativeSpec, LayoutHints } from "./types"
import {
  buildPreservationNote,
  buildSpecDiff,
  buildSuccessStudioResponse,
  cloneSpec,
} from "./spec-diff"
import { metricUsesPhone, metricUsesQr } from "./creative-state"
import {
  conflictCopyAmbiguous,
  conflictCopyOffer,
  conflictCopyPhone,
  conflictCopyQr,
  conflictCopyUnrecognized,
} from "./studio-copy"

export interface RefinementInput {
  brief: CampaignBrief
  currentSpec: CreativeSpec
  prompt: string
}

export type RefinementOutcome =
  | {
      kind: "success"
      spec: CreativeSpec
      specDiff: ReturnType<typeof buildSpecDiff>
      studioResponse: string
    }
  | {
      kind: "conflict"
      conflictType: "qr" | "phone" | "offer" | "ambiguous" | "unrecognized"
      studioResponse: string
    }

export function applyMockRefinement(input: RefinementInput): RefinementOutcome {
  const prompt = input.prompt.trim().toLowerCase()
  if (!prompt) {
    return {
      kind: "conflict",
      conflictType: "unrecognized",
      studioResponse: conflictCopyUnrecognized(),
    }
  }

  if (
    /\b(make it better|better\b|improve)\b/.test(prompt) &&
    !/\b(headline|color|warmer|bigger|qr|phone|offer)\b/.test(prompt)
  ) {
    return {
      kind: "conflict",
      conflictType: "ambiguous",
      studioResponse: conflictCopyAmbiguous(),
    }
  }

  if (/\b(remove|delete|hide)\b.*\b(qr|code)\b/.test(prompt) && metricUsesQr(input.brief)) {
    return {
      kind: "conflict",
      conflictType: "qr",
      studioResponse: conflictCopyQr(input.brief),
    }
  }

  if (
    /\b(remove|delete|hide)\b.*\b(phone|number)\b/.test(prompt) &&
    metricUsesPhone(input.brief)
  ) {
    return {
      kind: "conflict",
      conflictType: "phone",
      studioResponse: conflictCopyPhone(),
    }
  }

  if (/\b(remove|delete|hide)\b.*\b(offer|discount)\b/.test(prompt) && input.brief.offer) {
    return {
      kind: "conflict",
      conflictType: "offer",
      studioResponse: conflictCopyOffer(),
    }
  }

  const next = cloneSpec(input.currentSpec)
  const hints: LayoutHints = { ...next.layoutHints }
  let matched = false

  if (
    /\b(bigger|larger)\b.*\b(headline|title)\b/.test(prompt) ||
    /\bheadline\b.*\b(bigger|larger)\b/.test(prompt)
  ) {
    hints.headlineScale = (hints.headlineScale ?? 1) + 0.15
    matched = true
  }

  if (/\bwarmer\b/.test(prompt) || /\bwarm(er)?\s+(color|tone|palette)\b/.test(prompt)) {
    next.palette = ["#c2703d", "#e8a87c", "#faf3e8"]
    next.tone = "Warm, welcoming, approachable"
    matched = true
  }

  if (
    /\b(green|red)\b.*\bborder\b/.test(prompt) ||
    /\bborder\b.*\b(green|red)\b/.test(prompt)
  ) {
    const color = prompt.includes("green") ? "#2d6a4f" : "#c0392b"
    next.palette = [color, next.palette?.[1] ?? "#4a90a4", next.palette?.[2] ?? "#f5f5f0"]
    matched = true
  }

  if (/\bphone\b/.test(prompt) && /\b(bottom.?right|lower.?right|move)\b/.test(prompt)) {
    hints.phonePosition = "bottom-right"
    matched = true
  }

  if (
    /\b(bigger|larger|prominent)\b.*\b(qr|code)\b/.test(prompt) ||
    /\bqr\b.*\b(bigger|prominent)\b/.test(prompt)
  ) {
    hints.qrProminence = "large"
    matched = true
  }

  const headlineMatch = prompt.match(
    /(?:headline|title)\s+(?:to|as|:)\s+["']?([^"']+)["']?/
  )
  if (headlineMatch?.[1]) {
    next.headline = headlineMatch[1].trim()
    matched = true
  }

  if (!matched) {
    return {
      kind: "conflict",
      conflictType: "unrecognized",
      studioResponse: conflictCopyUnrecognized(),
    }
  }

  next.layoutHints = hints
  const specDiff = buildSpecDiff(input.currentSpec, next)

  const preserved: string[] = []
  if (!specDiff.changedRegions.includes("callToAction") && next.callToAction) {
    preserved.push("QR code")
  }
  if (!specDiff.changedRegions.includes("offer") && next.offer) {
    preserved.push("offer")
  }

  const preservationNote = buildPreservationNote(preserved)
  let studioResponse = buildSuccessStudioResponse(specDiff, preservationNote)

  if (hints.phonePosition === "bottom-right") {
    studioResponse =
      "Done — your phone number is now bottom-right. " +
      (preservationNote ?? "The QR code stays centered since that's your primary booking path.")
  } else if (hints.qrProminence === "large") {
    studioResponse =
      "Done — the QR code is more prominent. " +
      (preservationNote ?? "Your headline and offer are unchanged.")
  } else if (hints.headlineScale) {
    studioResponse =
      "Done — headline is larger. " +
      (preservationNote ?? "Your offer and QR code are unchanged.")
  }

  return { kind: "success", spec: next, specDiff, studioResponse }
}

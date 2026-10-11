import type { UploadedDesign, UploadedDesignFile, UploadedDesignReview } from "@/lib/campaign-creator/types"

import { preflightBlocksApproval } from "./preflight"

/**
 * What the reviewer is asked to judge on the uploaded front and back.
 * The customer never sees scores from this list.
 */
export const DESIGN_REVIEW_SYSTEM = `You are a Modern Mail designer looking at a postcard the customer already made. You do not edit their file. You do not score, grade, pass, or fail it.

Look at the front and the back together. Use these rules:
- Headline clarity and size. The headline should be short, about eight words or fewer, and large enough to lead the card.
- Offer prominence. The offer is the headline or the line directly under it.
- Contrast. The headline, the offer, and the call to action should be easy to read at a glance, about 4.5:1 or stronger.
- A single focal point. The eye should land in one place first.
- Phone, website, and QR code. When the card asks someone to respond, those should be present and legible. Phone type at least 11 points. A QR code at least 0.75 inches, with clear space around it, and dark marks on a light field.
- Safe zone. Type stays a quarter inch inside the edge where the card is cut.
- Address area. On the back, the address, postage, and barcode cover a reserved area. Ink there will not show.

Return 3 to 5 short suggestions.
The first suggestion says what already works well.
When you suggest a change, start with "You might consider". The tone is encouraging and never critical.
Do not mention a score, a grade, a rubric id, a pass, or a fail.
Do not say you changed the file or that you will change it.`

export interface UploadedArtworkFace {
  mediaType: UploadedDesignFile["mediaType"]
  bytes: Uint8Array
}

export function isDesignReviewAvailable(env: NodeJS.ProcessEnv = process.env): boolean {
  if (env.CREATIVE_ENGINE === "mock") return false
  return Boolean(env.ANTHROPIC_API_KEY?.trim())
}

/** Customer-facing question. Keep this sentence exact. */
export const DESIGN_REVIEW_QUESTION = "Do you want our team to review and offer some feedback?"

const CRITICAL_START =
  /^(?:wrong|bad|poor|weak|fails?|failed|error|don'?t|do not|you must|you need to|you should|fix|this is|this fails|never|ugly)\b/i

/**
 * Keeps 3–5 friendly suggestions. Strips scores and grades.
 * Does not touch the uploaded file.
 */
export function normalizeDesignReview(raw: unknown): string[] {
  const suggestions = readSuggestions(raw)
    .map((item) => stripScoreLanguage(item))
    .map((item, index) => softenSuggestion(item, index))
    .filter((item) => item.length > 0)
    .slice(0, 5)

  if (suggestions.length < 3) {
    throw new Error("The review did not include enough suggestions.")
  }
  return suggestions
}

export function declineUploadedDesignReview(design: UploadedDesign): UploadedDesign {
  return {
    ...design,
    review: { declined: true },
  }
}

export function attachDesignReview(design: UploadedDesign, suggestions: string[], reviewedAt: string): UploadedDesign {
  const review: UploadedDesignReview = { suggestions, reviewedAt }
  return { ...design, review }
}

/** A review, including a decline, never adds a blocking preflight issue. */
export function reviewBlocksApproval(design: UploadedDesign | undefined): boolean {
  if (!design) return false
  return preflightBlocksApproval(design.issues)
}

function readSuggestions(raw: unknown): string[] {
  if (!isRecord(raw) || !Array.isArray(raw.suggestions)) {
    throw new Error("The review did not come back in a usable form.")
  }
  return raw.suggestions
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.replace(/\s+/g, " ").trim())
    .filter((item) => item.length > 0)
}

function stripScoreLanguage(text: string): string {
  return text
    .replace(/\b(?:score|grade|rating)\s*(?:of|:)?\s*[A-F][+-]?(?!\w)/gi, "")
    .replace(/\b(?:score|grade|rating)\s*(?:of|:)?\s*\d+(?:\s*\/\s*\d+)?(?!\w)/gi, "")
    .replace(/\b\d+\s*\/\s*\d+\b/g, "")
    .replace(/\b[A-F][+-](?!\w)/g, "")
    .replace(/^[\s.,:;–-]+/, "")
    .replace(/\s+([.,])/g, "$1")
    .replace(/\s{2,}/g, " ")
    .replace(/\s+\./g, ".")
    .trim()
}

function softenSuggestion(text: string, index: number): string {
  if (!text) return ""
  if (index === 0) return text
  if (/^you might consider\b/i.test(text)) return text
  if (!CRITICAL_START.test(text)) return text
  const rest = text.replace(/[.]+$/, "")
  const lowered = rest.charAt(0).toLowerCase() + rest.slice(1)
  return `You might consider ${lowered}.`
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}

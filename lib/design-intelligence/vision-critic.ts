import type { CreativeSpec } from "@/lib/campaign-creator/types"

import { estimateUsd, logTokenCost, type TokenCost } from "./cost"
import { VISION_GRADE_ANCHOR, letterFor, type LetterGrade } from "./composition-grade"
import { composeGridCard } from "./grid-composer"
import { isDesignRationale } from "./rationale"
import type { TastePick } from "./taste-retrieval"

/**
 * Vision critic. It sees the rendered card beside two or three A-grade
 * references and writes a grade against the rubric. Contrast and overflow
 * stay machine gates in composition-grade; this call does not override them
 * upward past the panel cap.
 */

const MODEL = "claude-sonnet-5"

export interface VisionCritique {
  score: number
  letter: LetterGrade
  explanation: string
  redesign: string
  weakness: string
  usage: TokenCost
}

export async function requestComparativeCritique(input: {
  png: Buffer
  references: Array<{ id: string; bytes: Buffer; mediaType: "image/jpeg" | "image/png" | "image/webp"; principle: string }>
  vertical: string
  env: NodeJS.ProcessEnv
  cardId?: string
}): Promise<VisionCritique | null> {
  const apiKey = input.env.ANTHROPIC_API_KEY?.trim()
  if (!apiKey || input.env.DESIGN_CRITIC === "machine") return null
  if (input.references.length < 2) return null
  try {
    const Anthropic = (await import("@anthropic-ai/sdk")).default
    const client = new Anthropic({ apiKey })
    const images = [
      {
        type: "image" as const,
        source: { type: "base64" as const, media_type: "image/png" as const, data: input.png.toString("base64") },
      },
      ...input.references.slice(0, 3).map((reference) => ({
        type: "image" as const,
        source: {
          type: "base64" as const,
          media_type: reference.mediaType,
          data: reference.bytes.toString("base64"),
        },
      })),
    ]
    const response = await client.messages.create({
      model: input.env.DESIGN_MODEL?.trim() || MODEL,
      max_tokens: 500,
      system: [
        "You grade one candidate postcard against an A+ direct-mail rubric.",
        "The first image is the candidate. The later images are A-grade references for comparison only.",
        "Never tell the designer to copy a reference brand, photo, layout, or line.",
        VISION_GRADE_ANCHOR,
        'Return JSON only: {"score": number 0-100, "letter": "A"|"A-"|"B+"|"B"|"B-"|"C+"|"C"|"C-"|"D"|"F", "explanation": "two sentences", "weakness": "the single biggest weakness, one sentence", "redesign": "the one structural change that fixes that weakness"}',
      ].join("\n"),
      messages: [
        {
          role: "user",
          content: [
            ...images,
            {
              type: "text",
              text: [
                `Vertical: ${input.vertical}.`,
                "References, in order after the candidate:",
                ...input.references.slice(0, 3).map((reference) => `- ${reference.id}: ${reference.principle}`),
                "Explain the score. A panel of boxes is B- or C+, not A.",
              ].join("\n"),
            },
          ],
        },
      ],
    })
    const parsed = parseJson(response.content.filter((block) => block.type === "text").map((block) => block.text).join("\n"))
    if (!parsed || typeof parsed !== "object") return null
    const row = parsed as { score?: unknown; letter?: unknown; explanation?: unknown; redesign?: unknown; weakness?: unknown }
    const score = typeof row.score === "number" ? Math.max(0, Math.min(100, row.score)) : null
    if (score === null) return null
    const letter = typeof row.letter === "string" ? row.letter : letterFor(score)
    const usage: TokenCost = {
      cardId: input.cardId ?? "card",
      step: "critic",
      model: response.model,
      inputTokens: response.usage?.input_tokens ?? 0,
      outputTokens: response.usage?.output_tokens ?? 0,
      estimatedUsd: estimateUsd(response.usage?.input_tokens ?? 0, response.usage?.output_tokens ?? 0, input.env),
    }
    logTokenCost(usage)
    return {
      score,
      letter: letterFor(typeof row.letter === "string" ? scoreFromLetter(letter, score) : score),
      explanation: typeof row.explanation === "string" ? row.explanation.slice(0, 500) : "",
      redesign: typeof row.redesign === "string" ? row.redesign.slice(0, 240) : "Open the field and let the offer float.",
      weakness: typeof row.weakness === "string" ? row.weakness.slice(0, 240) : "",
      usage,
    }
  } catch (error) {
    console.info(`[design-intelligence] ${JSON.stringify({ step: "vision-critic", error: error instanceof Error ? error.message : "critic failed" })}`)
    return null
  }
}

export function parseRefinementReview(text: string): { addressed: boolean; regression: string } | null {
  const parsed = parseJson(text)
  if (!parsed || typeof parsed !== "object") return null
  const row = parsed as { addressed?: unknown; regression?: unknown }
  if (typeof row.addressed !== "boolean") return null
  return {
    addressed: row.addressed,
    regression: typeof row.regression === "string" ? row.regression.slice(0, 240) : "",
  }
}

/**
 * Asks the vision critic whether a plain-English note shows up on the card
 * and whether anything else slipped. No key, no render: the machine check stands.
 */
export async function reviewRefinementNote(input: {
  before: CreativeSpec
  after: CreativeSpec
  note: string
  businessName?: string
  env?: NodeJS.ProcessEnv
}): Promise<{ addressed: boolean; regression: string } | null> {
  const env = input.env ?? process.env
  const apiKey = env.ANTHROPIC_API_KEY?.trim()
  if (!apiKey || env.DESIGN_CRITIC === "machine") return null
  if (!isDesignRationale(input.before.designRationale) || !isDesignRationale(input.after.designRationale)) return null
  try {
    const beforeCard = composeGridCard({
      rationale: input.before.designRationale,
      spec: input.before,
      businessName: input.businessName,
    })
    const afterCard = composeGridCard({
      rationale: input.after.designRationale,
      spec: input.after,
      businessName: input.businessName,
    })
    const { renderStudioCardPng } = await import("./studio-render")
    const payload = input.after.qrDestination ?? input.after.website ?? input.after.phone ?? "https://example.com/book"
    const beforePng = await renderStudioCardPng(beforeCard.front, payload, { ppi: 72 })
    const afterPng = await renderStudioCardPng(afterCard.front, payload, { ppi: 72 })
    const Anthropic = (await import("@anthropic-ai/sdk")).default
    const client = new Anthropic({ apiKey })
    const response = await client.messages.create({
      model: env.DESIGN_MODEL?.trim() || MODEL,
      max_tokens: 200,
      system: [
        "You check one design revision.",
        "The first image is the card before the note. The second image is the card after.",
        "Addressed means the note is visibly fixed. A regression is a phone, offer, or line that got worse.",
        'Return JSON only: {"addressed": true or false, "regression": "one sentence, or empty"}',
      ].join("\n"),
      messages: [
        {
          role: "user",
          content: [
            { type: "image", source: { type: "base64", media_type: "image/png", data: beforePng.toString("base64") } },
            { type: "image", source: { type: "base64", media_type: "image/png", data: afterPng.toString("base64") } },
            { type: "text", text: `The note was: ${input.note}` },
          ],
        },
      ],
    })
    const text = response.content.filter((block) => block.type === "text").map((block) => block.text).join("\n")
    return parseRefinementReview(text)
  } catch (error) {
    console.info(`[design-intelligence] ${JSON.stringify({ step: "refine-review", error: error instanceof Error ? error.message : "review failed" })}`)
    return null
  }
}

export function referencePicksForCritique(picks: readonly TastePick[]): TastePick[] {
  const graded = picks.filter((pick) => pick.grade === "A" || pick.grade === "A-")
  const pool = graded.length >= 2 ? graded : picks
  return pool.slice(0, 3)
}

function scoreFromLetter(letter: string, fallback: number): number {
  const known: Record<string, number> = {
    A: 95, "A-": 91, "B+": 88, B: 85, "B-": 81, "C+": 78, C: 74, "C-": 71, D: 64, F: 50,
  }
  return known[letter] ?? fallback
}

function parseJson(text: string): unknown {
  const start = text.indexOf("{")
  const end = text.lastIndexOf("}")
  if (start < 0 || end <= start) return null
  try {
    return JSON.parse(text.slice(start, end + 1)) as unknown
  } catch {
    return null
  }
}

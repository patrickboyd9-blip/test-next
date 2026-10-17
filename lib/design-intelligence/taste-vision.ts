import type { ModelUsage } from "./model"
import { parseTasteAnalysis, type TasteAnalysis } from "./taste"

/**
 * Vision reading of one reference mailer.
 * Tests call the parser. The live call runs only when a key is set.
 */

const MODEL = "claude-sonnet-5"

export function tasteVisionSystem(): string {
  return [
    "You are a world-class direct-mail art director reading one reference postcard.",
    "Describe only what is visible. Return JSON. Do not transcribe a brand name, phone number, URL, street, slogan, or price.",
    "Talk about principles: eye path, the focal element, how large the offer is next to the headline and the body, whitespace, which color is the ground, the type, and the accent, how type meets the imagery, and how the response block is built.",
    "Say what makes the piece work, in one transferable sentence.",
    "Grade it. A light ground, type set directly on that ground, one hero offer, and a cut-out subject with at most one row of small thumbnails is an A when contrast and the response are sound.",
    "A tidy slab of type beside a photograph is a B-minus. A floating card or a stack of boxes is a C-plus. An official-notice costume or a fake deadline is an F.",
    "Never tell anyone to copy the piece.",
    'Keys: eyePath, focalElement, scaleRatios {offerToHeadline, headlineToBody}, whitespace, paletteRoles {ground, type, accent}, typeIntegration (on_open_canvas | on_panel | on_scrim | boxed | mixed), responseBlock, whatMakesItWork, grade (A, A-, B+, B, B-, C+, C, C-, D, F), industry, offerType (numeral | percent | free | inspection | other), feel (integrated | panel | boxed | calm), compositionFamily.',
  ].join(" ")
}

export async function analyzeMailerTaste(input: {
  id: string
  bytes: Buffer
  mediaType: "image/jpeg" | "image/png" | "image/webp"
  env: NodeJS.ProcessEnv
  now?: string
}): Promise<{ analysis: TasteAnalysis | null; usage: ModelUsage | null }> {
  if (isPrivateId(input.id)) return { analysis: null, usage: null }
  const apiKey = input.env.ANTHROPIC_API_KEY?.trim()
  if (!apiKey) return { analysis: null, usage: null }
  try {
    const Anthropic = (await import("@anthropic-ai/sdk")).default
    const client = new Anthropic({ apiKey })
    const model = input.env.DESIGN_TASTE_MODEL?.trim() || input.env.DESIGN_MODEL?.trim() || MODEL
    const response = await client.messages.create({
      model,
      max_tokens: 900,
      system: tasteVisionSystem(),
      messages: [
        {
          role: "user",
          content: [
            { type: "image", source: { type: "base64", media_type: input.mediaType, data: input.bytes.toString("base64") } },
            { type: "text", text: `Id: ${input.id}. This image is a reference, not art to copy. Return JSON only.` },
          ],
        },
      ],
    })
    const text = response.content.filter((block) => block.type === "text").map((block) => block.text).join("\n")
    const analysis = parseTasteAnalysis(input.id, parseJson(text), {
      model: response.model,
      analyzedAt: input.now ?? new Date().toISOString(),
      groundedBy: "vision",
    })
    return {
      analysis,
      usage: {
        model: response.model,
        inputTokens: response.usage?.input_tokens ?? 0,
        outputTokens: response.usage?.output_tokens ?? 0,
      },
    }
  } catch (error) {
    console.info(`[design-intelligence] ${JSON.stringify({ step: "taste", error: error instanceof Error ? error.message : "taste failed" })}`)
    return { analysis: null, usage: null }
  }
}

export function visionCriticSystem(): string {
  return [
    "You grade one postcard render against the A+ direct-mail rubric, looking at it beside two or three A-grade references.",
    "Learn the principle. Do not copy a brand, a photo, a slogan, or a layout.",
    "Legibility is already measured from pixels. Do not excuse type that fails contrast.",
    "A panel-style local-service card, type trapped in a color slab beside a photo, is a B-minus or a C-plus even when it is tidy.",
    "A strong card has a light ground, a two-color headline set on that ground, a cut-out subject, one hero offer, and at most one row of small thumbnails. That pattern is an A when the response is one group and nothing extra is shouting.",
    "Anything below a B should say what one structural change would move it up.",
    'Return JSON only: {"score": number 0-100, "letter": "A"|"A-"|"B+"|"B"|"B-"|"C+"|"C"|"C-"|"D"|"F", "explanation": "two sentences", "edit": "one structural edit"}.',
  ].join(" ")
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

function isPrivateId(id: string): boolean {
  return id.toLowerCase().includes("private")
}

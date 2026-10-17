import type {
  CreativeEngine,
  GenerateDirectionsInput,
  GenerateDirectionsResult,
  RefineDirectionInput,
  RefineDirectionResult,
  RegenerateDirectionsInput,
} from "./creative-engine"
import {
  CreativeGenerationInvalidError,
  currentSpecFromInput,
  detectPromptConflict,
  finalizeRefinement,
  normalizeGenerationResult,
  withGenerationRetryFeedback,
} from "./creative-engine-guards"
import { applyDesignIntelligence } from "@/lib/design-intelligence/pipeline"

import { buildCreativeIntelligenceContext } from "./creative-intelligence"
import { loadReferenceMailerImages, type ReferenceMailerImage } from "@/lib/reference-corpus/mailer-images"
import { RESEARCH_QUALITY_THRESHOLD } from "./research-quality"
import {
  CREATIVE_PROMPT_VERSION,
  DIRECTION_NAME_CONSTRAINT,
  IMAGE_PRESENCE_TOOL_DESCRIPTION,
  buildGenerateSystemPrompt,
  buildGenerateUserMessage,
  buildRefineSystemPrompt,
  buildRefineUserMessage,
  buildRegenerateSystemPrompt,
  buildRegenerateUserMessage,
} from "./prompts"
import {
  DESIGN_REVIEW_SYSTEM,
  normalizeDesignReview,
  type UploadedArtworkFace,
} from "@/lib/bring-your-own-design/design-review"
import { createAnthropicClient, type AnthropicToolUseBlock } from "./load-anthropic-sdk"
import {
  GENERATED_SPEC_TOOL_REQUIRED,
  IMAGE_PRESENCES,
  IMAGERY_ROLES,
  LAYOUT_VARIANTS,
  LEAD_JOBS,
  TYPE_ROLES,
  normalizeLayoutVariant,
  type ColorBlock,
  type CreativeDirection,
  type CreativeSpec,
  type HeadlinePosition,
  type ImagePresence,
  type ImageryKey,
  type ImageryRole,
  type LeadJob,
  type OfferBadge,
  type ResearchPhotoCrop,
  type TypeRole,
} from "./types"

const MODEL = "claude-sonnet-5"
const GENERATE_MAX_TOKENS = 8192
const REFINE_MAX_TOKENS = 2048

const GENERATE_TOOL_NAME = "propose_creative_directions"
const REFINE_TOOL_NAME = "apply_creative_refinement"
const REVIEW_TOOL_NAME = "offer_design_feedback"
const SCORE_TOOL_NAME = "score_research_directions"
const REVIEW_MAX_TOKENS = 1024

const scoreDirectionsTool = {
  name: SCORE_TOOL_NAME,
  description:
    "Internal craft scores for three directions compared with reference mailers. Not customer copy.",
  input_schema: {
    type: "object" as const,
    properties: {
      directions: {
        type: "array",
        minItems: 3,
        maxItems: 3,
        items: {
          type: "object",
          properties: {
            hierarchy: { type: "number" },
            legibility: { type: "number" },
            offerClarity: { type: "number" },
            photoRelevance: { type: "number" },
            craftResemblance: { type: "number" },
          },
          required: [
            "hierarchy",
            "legibility",
            "offerClarity",
            "photoRelevance",
            "craftResemblance",
          ],
        },
      },
    },
    required: ["directions"],
  },
}

interface VisionScore {
  hierarchy: number
  legibility: number
  offerClarity: number
  photoRelevance: number
  craft: number
  total: number
}

const offerDesignFeedbackTool = {
  name: REVIEW_TOOL_NAME,
  description:
    "Offer 3 to 5 friendly suggestions about the uploaded postcard. No scores, grades, or file edits.",
  input_schema: {
    type: "object" as const,
    properties: {
      suggestions: {
        type: "array",
        minItems: 3,
        maxItems: 5,
        items: { type: "string" },
        description:
          "3 to 5 sentences. The first says what works well. Changes start with 'You might consider'. No scores or grades.",
      },
    },
    required: ["suggestions"],
  },
}

const specToolProperties = {
  layoutVariant: {
    type: "string",
    enum: [...LAYOUT_VARIANTS],
  },
  headline: { type: "string" },
  subheadline: { type: "string" },
  body: { type: "string" },
  callToAction: { type: "string" },
  offer: { type: "string" },
  phone: { type: "string" },
  website: { type: "string" },
  qrDestination: { type: "string" },
  visualDirection: { type: "string" },
  tone: { type: "string" },
  palette: { type: "array", items: { type: "string" } },
  imagery: {
    type: "string",
    enum: ["stock_hvac", "stock_restaurant", "stock_generic_local", "logo_primary", "none"],
  },
  leadJob: {
    type: "string",
    enum: LEAD_JOBS,
  },
  imageryRole: {
    type: "string",
    enum: IMAGERY_ROLES,
  },
  typeRole: {
    type: "string",
    enum: TYPE_ROLES,
  },
  imagePresence: {
    type: "string",
    enum: IMAGE_PRESENCES,
    description: IMAGE_PRESENCE_TOOL_DESCRIPTION,
  },
  layoutHints: {
    type: "object",
    properties: {
      headlineScale: { type: "number" },
      phonePosition: { type: "string", enum: ["default", "bottom-right"] },
      qrProminence: { type: "string", enum: ["default", "large"] },
      headlinePosition: {
        type: "string",
        enum: ["beside_photo", "over_quiet_area", "on_color_field", "in_band"],
      },
      photoCrop: { type: "string", enum: ["tight", "open", "space_for_type"] },
      offerBadge: { type: "string", enum: ["none", "inline", "band"] },
      colorBlock: { type: "string", enum: ["none", "field", "band"] },
    },
  },
} as const

const generateDirectionsTool = {
  name: GENERATE_TOOL_NAME,
  description:
    "Propose exactly three distinct postcard directions from the campaign brief.",
  input_schema: {
    type: "object" as const,
    properties: {
      promptVersion: {
        type: "string",
        description: `Echo ${CREATIVE_PROMPT_VERSION} so we can trace this response.`,
      },
      directions: {
        type: "array",
        minItems: 3,
        maxItems: 3,
        items: {
          type: "object",
          properties: {
            name: {
              type: "string",
              description: DIRECTION_NAME_CONSTRAINT,
            },
            rationale: { type: "string" },
            tags: { type: "array", items: { type: "string" } },
            recommended: { type: "boolean" },
            designedToDrive: { type: "string" },
            oneLineDifference: { type: "string" },
            spec: {
              type: "object",
              properties: specToolProperties,
              required: [...GENERATED_SPEC_TOOL_REQUIRED],
            },
          },
          required: ["name", "rationale", "tags", "recommended", "designedToDrive", "spec"],
        },
      },
    },
    required: ["directions"],
  },
}

const refineDirectionTool = {
  name: REFINE_TOOL_NAME,
  description:
    "Apply a natural-language refinement or return a conflict without changing the spec.",
  input_schema: {
    type: "object" as const,
    properties: {
      promptVersion: { type: "string" },
      outcome: { type: "string", enum: ["success", "conflict"] },
      studioResponse: { type: "string" },
      spec: {
        type: "object",
        description: "Full next spec snapshot. Required when outcome is success.",
        properties: specToolProperties,
      },
    },
    required: ["outcome", "studioResponse"],
  },
}

/**
 * Anthropic-backed CreativeEngine. The SDK is loaded at runtime only —
 * see load-anthropic-sdk.ts. Callers go through getCreativeEngine().
 */
export class AnthropicCreativeEngine implements CreativeEngine {
  private client: ReturnType<typeof createAnthropicClient>

  constructor(apiKey: string) {
    this.client = createAnthropicClient(apiKey)
  }

  async generateDirections(
    input: GenerateDirectionsInput
  ): Promise<GenerateDirectionsResult> {
    const intelligence = buildCreativeIntelligenceContext(input.brief)
    const images = await loadReferenceMailerImages(
      (intelligence.referenceCards ?? []).map((card) => card.mmrId)
    )
    return this.generateWithRetry(input.brief, input.canvas, images, (reasons) =>
      this.requestDirections({
        system: buildGenerateSystemPrompt(input.canvas, intelligence),
        user: withGenerationRetryFeedback(
          buildGenerateUserMessage(input.brief, input.canvas),
          reasons
        ),
        images,
      }),
      { ownerId: input.ownerId, campaignId: input.campaignId }
    )
  }

  async refineDirection(input: RefineDirectionInput): Promise<RefineDirectionResult> {
    const currentSpec = currentSpecFromInput(input)
    if (detectPromptConflict(input.brief, input.prompt)) {
      return finalizeRefinement({
        brief: input.brief,
        directionId: input.direction.id,
        currentSpec,
        prompt: input.prompt,
        proposed: { outcome: "conflict" },
      })
    }

    const raw = await this.requestRefinement(input, currentSpec)
    return finalizeRefinement({
      brief: input.brief,
      directionId: input.direction.id,
      currentSpec,
      prompt: input.prompt,
      proposed: raw,
    })
  }

  async regenerateDirections(
    input: RegenerateDirectionsInput
  ): Promise<GenerateDirectionsResult> {
    const intelligence = buildCreativeIntelligenceContext(input.brief)
    const images = await loadReferenceMailerImages(
      (intelligence.referenceCards ?? []).map((card) => card.mmrId)
    )
    return this.generateWithRetry(input.brief, input.canvas, images, (reasons) =>
      this.requestDirections({
        system: buildRegenerateSystemPrompt(input.canvas, intelligence),
        user: withGenerationRetryFeedback(buildRegenerateUserMessage(input), reasons),
        images,
      }),
      { ownerId: input.ownerId, campaignId: input.campaignId }
    )
  }

  private async generateWithRetry(
    brief: GenerateDirectionsInput["brief"],
    canvas: GenerateDirectionsInput["canvas"],
    images: ReferenceMailerImage[],
    request: (reasons?: string[]) => Promise<CreativeDirection[]>,
    context?: { ownerId?: string; campaignId?: string }
  ): Promise<GenerateDirectionsResult> {
    let reasons: string[] | undefined
    let lastError: unknown
    let best: GenerateDirectionsResult | undefined
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const directions = await request(reasons)
        const result = await this.applyVisionCritique(
          normalizeGenerationResult(brief, directions, {
            stripInventedFacts: true,
          }),
          images
        )
        const weak =
          images.length > 0 &&
          result.directions.some(
            (direction) => (direction.research?.quality?.score ?? 10) < RESEARCH_QUALITY_THRESHOLD
          )
        if (weak && attempt === 0) {
          reasons = result.directions
            .flatMap((direction) => direction.research?.quality?.notes ?? [])
            .slice(0, 8)
          best = result
          continue
        }
        return applyDesignIntelligence(brief, result, canvas, process.env, context)
      } catch (error) {
        lastError = error
        if (!(error instanceof CreativeGenerationInvalidError) || attempt === 1) {
          if (best) return applyDesignIntelligence(brief, best, canvas, process.env, context)
          throw error
        }
        reasons = error.reasons
      }
    }
    if (best) return applyDesignIntelligence(brief, best, canvas, process.env, context)
    throw lastError instanceof Error
      ? lastError
      : new CreativeGenerationInvalidError(["generation failed"])
  }

  private async requestDirections(input: {
    system: string
    user: string
    images?: ReferenceMailerImage[]
  }): Promise<CreativeDirection[]> {
    const images = input.images ?? []
    const response = await this.client.messages.create({
      model: MODEL,
      max_tokens: GENERATE_MAX_TOKENS,
      system: input.system,
      messages: [
        {
          role: "user",
          content:
            images.length > 0
              ? [
                  ...images.map((image) => ({
                    type: "image" as const,
                    source: {
                      type: "base64" as const,
                      media_type: image.mediaType,
                      data: image.bytes.toString("base64"),
                    },
                  })),
                  {
                    type: "text" as const,
                    text: `${referenceImagePreface(images)}\n\n${input.user}`,
                  },
                ]
              : input.user,
        },
      ],
      tools: [generateDirectionsTool],
      tool_choice: { type: "tool", name: GENERATE_TOOL_NAME },
    })

    const toolUse = response.content.find(
      (block): block is AnthropicToolUseBlock => block.type === "tool_use"
    )
    if (!toolUse) {
      throw new Error("Creative engine did not return structured directions.")
    }

    return parseGeneratedDirections(toolUse.input)
  }

  /**
   * When reference scans are on disk, ask the model to compare each direction
   * with those scans. The score stays internal. A failed call keeps the rubric.
   */
  private async applyVisionCritique(
    result: GenerateDirectionsResult,
    images: ReferenceMailerImage[]
  ): Promise<GenerateDirectionsResult> {
    if (images.length === 0) return result
    try {
      const critique = await this.requestVisionCritique(result.directions, images)
      return {
        ...result,
        directions: result.directions.map((direction, index) =>
          mergeVisionScore(direction, critique[index])
        ),
      }
    } catch {
      return {
        ...result,
        directions: result.directions.map((direction) => noteVisionMiss(direction)),
      }
    }
  }

  private async requestVisionCritique(
    directions: CreativeDirection[],
    images: ReferenceMailerImage[]
  ): Promise<VisionScore[]> {
    const described = directions
      .map((direction, index) => {
        const hints = direction.spec.layoutHints
        return [
          `Direction ${index + 1}: layout ${direction.spec.layoutVariant ?? "unset"}.`,
          `Headline: ${direction.spec.headline ?? ""}.`,
          `Offer: ${direction.spec.offer ?? "none"}.`,
          `Photo share target: ${direction.research?.parameters.photoShare ?? "unset"}.`,
          `Headline position: ${hints?.headlinePosition ?? "unset"}. Offer treatment: ${hints?.offerBadge ?? "unset"}. Color block: ${hints?.colorBlock ?? "unset"}.`,
        ].join(" ")
      })
      .join("\n")

    const response = await this.client.messages.create({
      model: MODEL,
      max_tokens: REVIEW_MAX_TOKENS,
      system:
        "You compare postcard directions with researched mailers. Score craft only. Do not write customer copy. Do not suggest copying a brand, slogan, or logo.",
      messages: [
        {
          role: "user",
          content: [
            ...images.map((image) => ({
              type: "image" as const,
              source: {
                type: "base64" as const,
                media_type: image.mediaType,
                data: image.bytes.toString("base64"),
              },
            })),
            {
              type: "text" as const,
              text: `Reference mailers are the images. Each direction below is described the way it will be painted. Score hierarchy, legibility at arm's length, offer clarity, photo relevance, and resemblance to the craft of the references. Each score is 0, 1, or 2.\n\n${described}`,
            },
          ],
        },
      ],
      tools: [scoreDirectionsTool],
      tool_choice: { type: "tool", name: SCORE_TOOL_NAME },
    })

    const toolUse = response.content.find(
      (block): block is AnthropicToolUseBlock => block.type === "tool_use"
    )
    if (!toolUse || !isRecord(toolUse.input) || !Array.isArray(toolUse.input.directions)) {
      return []
    }
    return toolUse.input.directions.flatMap((item) => {
      if (!isRecord(item)) return []
      const hierarchy = clampScore(item.hierarchy)
      const legibility = clampScore(item.legibility)
      const offerClarity = clampScore(item.offerClarity)
      const photoRelevance = clampScore(item.photoRelevance)
      const craft = clampScore(item.craftResemblance)
      return [{ hierarchy, legibility, offerClarity, photoRelevance, craft, total: hierarchy + legibility + offerClarity + photoRelevance + craft }]
    })
  }

  private async requestRefinement(
    input: RefineDirectionInput,
    currentSpec: CreativeSpec
  ): Promise<{
    outcome: "success" | "conflict"
    spec?: CreativeSpec
    studioResponse?: string
  }> {
    const response = await this.client.messages.create({
      model: MODEL,
      max_tokens: REFINE_MAX_TOKENS,
      system: buildRefineSystemPrompt(
        input.canvas,
        buildCreativeIntelligenceContext(input.brief)
      ),
      messages: [
        {
          role: "user",
          content: buildRefineUserMessage({
            brief: input.brief,
            canvas: input.canvas,
            direction: input.direction,
            currentSpec,
            revisions: input.revisions,
            prompt: input.prompt,
          }),
        },
      ],
      tools: [refineDirectionTool],
      tool_choice: { type: "tool", name: REFINE_TOOL_NAME },
    })

    const toolUse = response.content.find(
      (block): block is AnthropicToolUseBlock => block.type === "tool_use"
    )
    if (!toolUse) {
      throw new Error("Creative engine did not return a structured refinement.")
    }

    return parseRefinement(toolUse.input)
  }

  async reviewUploadedDesign(input: {
    front: UploadedArtworkFace
    back: UploadedArtworkFace
  }): Promise<string[]> {
    const response = await this.client.messages.create({
      model: MODEL,
      max_tokens: REVIEW_MAX_TOKENS,
      system: DESIGN_REVIEW_SYSTEM,
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: "Front of the postcard." },
            artworkBlock(input.front),
            { type: "text", text: "Back of the postcard." },
            artworkBlock(input.back),
            {
              type: "text",
              text: "Use the tool. Start with what works well. Do not score the design or edit the file.",
            },
          ],
        },
      ],
      tools: [offerDesignFeedbackTool],
      tool_choice: { type: "tool", name: REVIEW_TOOL_NAME },
    })

    const toolUse = response.content.find(
      (block): block is AnthropicToolUseBlock => block.type === "tool_use"
    )
    if (!toolUse) {
      throw new Error("Creative engine did not return design feedback.")
    }
    return normalizeDesignReview(toolUse.input)
  }
}

export async function reviewUploadedArtworkWithAnthropic(
  apiKey: string,
  input: { front: UploadedArtworkFace; back: UploadedArtworkFace }
): Promise<string[]> {
  return new AnthropicCreativeEngine(apiKey).reviewUploadedDesign(input)
}

function artworkBlock(face: UploadedArtworkFace) {
  const data = Buffer.from(face.bytes).toString("base64")
  if (face.mediaType === "application/pdf") {
    return {
      type: "document" as const,
      source: {
        type: "base64" as const,
        media_type: "application/pdf" as const,
        data,
      },
      title: "Postcard",
    }
  }
  return {
    type: "image" as const,
    source: {
      type: "base64" as const,
      media_type: face.mediaType,
      data,
    },
  }
}

function coerceJson(value: unknown): unknown {
  if (typeof value !== "string") return value
  const trimmed = value.trim()
  if (!trimmed.startsWith("{") && !trimmed.startsWith("[")) return value
  try {
    return JSON.parse(trimmed)
  } catch {
    return value
  }
}

function parseGeneratedDirections(raw: unknown): CreativeDirection[] {
  const parsed = coerceJson(raw)
  if (!isRecord(parsed)) {
    throw new CreativeGenerationInvalidError(["tool output is missing directions"])
  }

  let directions = coerceJson(parsed.directions)
  if (isRecord(directions) && !Array.isArray(directions)) {
    directions = coerceJson(directions.directions)
  }
  if (!Array.isArray(directions)) {
    throw new CreativeGenerationInvalidError(["tool output is missing directions"])
  }

  return directions.map((item, index) => {
    if (!isRecord(item)) {
      throw new CreativeGenerationInvalidError([`direction ${index + 1} is not an object`])
    }
    const spec = parseSpec(item.spec)
    if (!spec) {
      throw new CreativeGenerationInvalidError([`direction ${index + 1} is missing a spec`])
    }

    const tags = Array.isArray(item.tags)
      ? item.tags.filter((tag): tag is string => typeof tag === "string")
      : []

    return {
      id: `pending-${index}`,
      name: asString(item.name),
      rationale: asString(item.rationale),
      tags,
      recommended: item.recommended === true,
      designedToDrive: asString(item.designedToDrive),
      oneLineDifference: asOptionalString(item.oneLineDifference),
      spec,
      createdAt: "",
    }
  })
}

function parseRefinement(raw: unknown): {
  outcome: "success" | "conflict"
  spec?: CreativeSpec
  studioResponse?: string
} {
  if (!isRecord(raw)) {
    return { outcome: "conflict", studioResponse: "" }
  }

  const outcome = raw.outcome === "success" ? "success" : "conflict"
  const spec = outcome === "success" ? parseSpec(raw.spec) : undefined
  return {
    outcome: spec || outcome === "conflict" ? outcome : "conflict",
    spec,
    studioResponse: asOptionalString(raw.studioResponse),
  }
}

function parseSpec(raw: unknown): CreativeSpec | undefined {
  if (!isRecord(raw)) return undefined

  const spec: CreativeSpec = {
    layoutVariant: normalizeLayoutVariant(
      typeof raw.layoutVariant === "string" ? raw.layoutVariant : undefined
    ),
    headline: asOptionalString(raw.headline),
    subheadline: asOptionalString(raw.subheadline),
    body: asOptionalString(raw.body),
    callToAction: asOptionalString(raw.callToAction),
    offer: asOptionalString(raw.offer),
    phone: asOptionalString(raw.phone),
    website: asOptionalString(raw.website),
    qrDestination: asOptionalString(raw.qrDestination),
    visualDirection: asOptionalString(raw.visualDirection),
    tone: asOptionalString(raw.tone),
    palette: Array.isArray(raw.palette)
      ? raw.palette.filter((color): color is string => typeof color === "string")
      : undefined,
    imagery: isImageryKey(raw.imagery) ? raw.imagery : undefined,
    leadJob: isLeadJob(raw.leadJob) ? raw.leadJob : undefined,
    imageryRole: isImageryRole(raw.imageryRole) ? raw.imageryRole : undefined,
    typeRole: isTypeRole(raw.typeRole) ? raw.typeRole : undefined,
    imagePresence: isImagePresence(raw.imagePresence) ? raw.imagePresence : undefined,
  }

  if (isRecord(raw.layoutHints)) {
    spec.layoutHints = {
      headlineScale:
        typeof raw.layoutHints.headlineScale === "number"
          ? raw.layoutHints.headlineScale
          : undefined,
      phonePosition:
        raw.layoutHints.phonePosition === "bottom-right" ||
        raw.layoutHints.phonePosition === "default"
          ? raw.layoutHints.phonePosition
          : undefined,
      qrProminence:
        raw.layoutHints.qrProminence === "large" ||
        raw.layoutHints.qrProminence === "default"
          ? raw.layoutHints.qrProminence
          : undefined,
      headlinePosition: isHeadlinePosition(raw.layoutHints.headlinePosition)
        ? raw.layoutHints.headlinePosition
        : undefined,
      photoCrop: isPhotoCrop(raw.layoutHints.photoCrop) ? raw.layoutHints.photoCrop : undefined,
      offerBadge: isOfferBadge(raw.layoutHints.offerBadge) ? raw.layoutHints.offerBadge : undefined,
      colorBlock: isColorBlock(raw.layoutHints.colorBlock) ? raw.layoutHints.colorBlock : undefined,
    }
  }

  return spec
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}

function asString(value: unknown): string {
  return typeof value === "string" ? value : ""
}

function asOptionalString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value : undefined
}

function isImageryKey(value: unknown): value is ImageryKey {
  return (
    value === "stock_hvac" ||
    value === "stock_restaurant" ||
    value === "stock_generic_local" ||
    value === "logo_primary" ||
    value === "none"
  )
}

function isLeadJob(value: unknown): value is LeadJob {
  return typeof value === "string" && (LEAD_JOBS as readonly string[]).includes(value)
}

function isImageryRole(value: unknown): value is ImageryRole {
  return typeof value === "string" && (IMAGERY_ROLES as readonly string[]).includes(value)
}

function isTypeRole(value: unknown): value is TypeRole {
  return typeof value === "string" && (TYPE_ROLES as readonly string[]).includes(value)
}

function isImagePresence(value: unknown): value is ImagePresence {
  return typeof value === "string" && (IMAGE_PRESENCES as readonly string[]).includes(value)
}

function isHeadlinePosition(value: unknown): value is HeadlinePosition {
  return (
    value === "beside_photo" ||
    value === "over_quiet_area" ||
    value === "on_color_field" ||
    value === "in_band"
  )
}

function isPhotoCrop(value: unknown): value is ResearchPhotoCrop {
  return value === "tight" || value === "open" || value === "space_for_type"
}

function isOfferBadge(value: unknown): value is OfferBadge {
  return value === "none" || value === "inline" || value === "band"
}

function isColorBlock(value: unknown): value is ColorBlock {
  return value === "none" || value === "field" || value === "band"
}

function clampScore(value: unknown): number {
  const number = typeof value === "number" ? value : 0
  return Math.max(0, Math.min(2, Math.round(number)))
}

function referenceImagePreface(images: ReferenceMailerImage[]): string {
  const ids = images.map((image) => image.mmrId).join(", ")
  return `The images above are researched mailers (${ids}). Study hierarchy, how much of the card is photograph versus type, where the offer sits, color blocking, and type scale. Do not copy brands, slogans, logos, phone numbers, or artwork. Design an original piece for this brief.`
}

function mergeVisionScore(
  direction: CreativeDirection,
  score: VisionScore | undefined
): CreativeDirection {
  if (!score || !direction.research?.quality) return direction
  return {
    ...direction,
    research: {
      ...direction.research,
      quality: {
        ...direction.research.quality,
        score: Math.min(direction.research.quality.score, score.total),
        hierarchy: score.hierarchy,
        legibility: score.legibility,
        offerClarity: score.offerClarity,
        photoRelevance: score.photoRelevance,
        craftResemblance: score.craft,
        notes: [
          ...direction.research.quality.notes,
          "Compared with reference mailer images. Internal only.",
        ],
      },
    },
  }
}

function noteVisionMiss(direction: CreativeDirection): CreativeDirection {
  if (!direction.research?.quality) return direction
  return {
    ...direction,
    research: {
      ...direction.research,
      quality: {
        ...direction.research.quality,
        notes: [
          ...direction.research.quality.notes,
          "Reference images were available but the visual comparison did not finish. The rubric score stands.",
        ],
      },
    },
  }
}

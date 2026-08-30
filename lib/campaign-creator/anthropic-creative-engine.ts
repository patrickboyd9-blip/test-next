import Anthropic from "@anthropic-ai/sdk"

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
} from "./creative-engine-guards"
import {
  CREATIVE_PROMPT_VERSION,
  buildGenerateSystemPrompt,
  buildGenerateUserMessage,
  buildRefineSystemPrompt,
  buildRefineUserMessage,
  buildRegenerateSystemPrompt,
  buildRegenerateUserMessage,
} from "./prompts"
import type {
  CreativeDirection,
  CreativeSpec,
  ImageryKey,
  LayoutVariant,
} from "./types"

const MODEL = "claude-sonnet-5"
const GENERATE_MAX_TOKENS = 8192
const REFINE_MAX_TOKENS = 2048

const GENERATE_TOOL_NAME = "propose_creative_directions"
const REFINE_TOOL_NAME = "apply_creative_refinement"

const specToolProperties = {
  format: { type: "string", enum: ["postcard_4x6"] },
  layoutVariant: {
    type: "string",
    enum: ["offer_hero", "trust_first", "urgency_banner", "photo_led", "minimal_cta"],
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
  backLayout: { type: "string", enum: ["standard_address"] },
  layoutHints: {
    type: "object",
    properties: {
      headlineScale: { type: "number" },
      phonePosition: { type: "string", enum: ["default", "bottom-right"] },
      qrProminence: { type: "string", enum: ["default", "large"] },
    },
  },
} as const

const generateDirectionsTool: Anthropic.Tool = {
  name: GENERATE_TOOL_NAME,
  description:
    "Propose exactly three distinct postcard directions from the campaign brief.",
  input_schema: {
    type: "object",
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
            name: { type: "string" },
            rationale: { type: "string" },
            tags: { type: "array", items: { type: "string" } },
            recommended: { type: "boolean" },
            designedToDrive: { type: "string" },
            oneLineDifference: { type: "string" },
            spec: {
              type: "object",
              properties: specToolProperties,
              required: [
                "format",
                "layoutVariant",
                "headline",
                "body",
                "callToAction",
                "visualDirection",
                "tone",
                "palette",
                "imagery",
                "backLayout",
              ],
            },
          },
          required: ["name", "rationale", "tags", "recommended", "designedToDrive", "spec"],
        },
      },
    },
    required: ["directions"],
  },
}

const refineDirectionTool: Anthropic.Tool = {
  name: REFINE_TOOL_NAME,
  description:
    "Apply a natural-language refinement or return a conflict without changing the spec.",
  input_schema: {
    type: "object",
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
 * Anthropic-backed CreativeEngine. The only creative-engine file that may
 * import the Anthropic SDK. Callers go through getCreativeEngine().
 */
export class AnthropicCreativeEngine implements CreativeEngine {
  private client: Anthropic

  constructor(apiKey: string) {
    this.client = new Anthropic({ apiKey })
  }

  async generateDirections(
    input: GenerateDirectionsInput
  ): Promise<GenerateDirectionsResult> {
    return this.generateWithRetry(input.brief, () =>
      this.requestDirections({
        system: buildGenerateSystemPrompt(),
        user: buildGenerateUserMessage(input.brief),
      })
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
    return this.generateWithRetry(input.brief, () =>
      this.requestDirections({
        system: buildRegenerateSystemPrompt(),
        user: buildRegenerateUserMessage(input),
      })
    )
  }

  private async generateWithRetry(
    brief: GenerateDirectionsInput["brief"],
    request: () => Promise<CreativeDirection[]>
  ): Promise<GenerateDirectionsResult> {
    let lastError: unknown
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const directions = await request()
        return normalizeGenerationResult(brief, directions, {
          stripInventedFacts: true,
        })
      } catch (error) {
        lastError = error
        if (!(error instanceof CreativeGenerationInvalidError) || attempt === 1) {
          throw error
        }
      }
    }
    throw lastError instanceof Error
      ? lastError
      : new CreativeGenerationInvalidError(["generation failed"])
  }

  private async requestDirections(input: {
    system: string
    user: string
  }): Promise<CreativeDirection[]> {
    const response = await this.client.messages.create({
      model: MODEL,
      max_tokens: GENERATE_MAX_TOKENS,
      system: input.system,
      messages: [{ role: "user", content: input.user }],
      tools: [generateDirectionsTool],
      tool_choice: { type: "tool", name: GENERATE_TOOL_NAME },
    })

    const toolUse = response.content.find(
      (block): block is Anthropic.ToolUseBlock => block.type === "tool_use"
    )
    if (!toolUse) {
      throw new Error("Creative engine did not return structured directions.")
    }

    return parseGeneratedDirections(toolUse.input)
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
      system: buildRefineSystemPrompt(),
      messages: [
        {
          role: "user",
          content: buildRefineUserMessage({
            brief: input.brief,
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
      (block): block is Anthropic.ToolUseBlock => block.type === "tool_use"
    )
    if (!toolUse) {
      throw new Error("Creative engine did not return a structured refinement.")
    }

    return parseRefinement(toolUse.input)
  }
}

function parseGeneratedDirections(raw: unknown): CreativeDirection[] {
  if (!isRecord(raw) || !Array.isArray(raw.directions)) {
    throw new CreativeGenerationInvalidError(["tool output is missing directions"])
  }

  return raw.directions.map((item, index) => {
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
    format: raw.format === "postcard_4x6" ? "postcard_4x6" : undefined,
    layoutVariant: isLayoutVariant(raw.layoutVariant) ? raw.layoutVariant : undefined,
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
    backLayout: raw.backLayout === "standard_address" ? "standard_address" : undefined,
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

function isLayoutVariant(value: unknown): value is LayoutVariant {
  return (
    value === "offer_hero" ||
    value === "trust_first" ||
    value === "urgency_banner" ||
    value === "photo_led" ||
    value === "minimal_cta"
  )
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

import { randomUUID } from "crypto"

import type { ImageBrief, ImageBriefOccupancy, ImageBriefRole } from "./image-brief"
import {
  GENERATED_ASSET_SOURCE_CLASS,
  type GeneratedAsset,
  type ImageGenerationAdapter,
} from "./image-generation"

export const OPENAI_IMAGE_PROVIDER = "openai"
/** Evaluated snapshot pin from the first-slice provider research. */
export const OPENAI_IMAGE_MODEL = "gpt-image-2.5-flare-2026-09-08"
export const OPENAI_IMAGE_SIZE = "1536x1024"
export const OPENAI_IMAGE_QUALITY = "high"
export const OPENAI_IMAGES_GENERATIONS_URL =
  "https://api.openai.com/v1/images/generations"

export const OPENAI_IMAGE_HARD_NEGATIVES = [
  "text",
  "headlines",
  "prices",
  "phone numbers",
  "URLs",
  "QR codes",
  "logos",
  "watermarks",
  "badges",
  "starbursts",
  "pill buttons",
  "footer icon rows",
  "postcard or flyer chrome",
  "UI or card chrome",
  "design a mailer",
] as const

const OCCUPANCY_INSTRUCTION: Record<ImageBriefOccupancy, string> = {
  field:
    "This photograph is the visual ground. Make a full-bleed-ready original photograph. Leave any quiet or empty region named in the conceived situation empty and low-detail so type can occupy it later. Do not fill every inch.",
  supporting:
    "This photograph is a supporting image beside type, not the hero collage and not a finished mailer. Keep the scene quiet enough that type can lead.",
  witness:
    "This photograph is a small witness to a type-led piece. Keep it restrained and secondary. It is not a full-bleed field and not a designed card.",
}

const ROLE_MODE_LOCK: Record<ImageBriefRole, string> = {
  consequence:
    "Mode: consequence. An original illustrative category situation. Not lifestyle stock, not gore, and not this recipient's documented condition.",
  crew:
    "Mode: work / crew. An illustrative professional work situation. Not an actual named team and not documentary proof of this customer's job.",
  neighborhood:
    "Mode: environmental / local situation. Not this recipient's property. Not generic neighborhood stock treated as proof.",
}

export class OpenAIImageGenerationNotConfiguredError extends Error {
  constructor() {
    super(
      "OpenAI image generation is not configured. Set OPENAI_API_KEY on the server."
    )
    this.name = "OpenAIImageGenerationNotConfiguredError"
  }
}

export class OpenAIImageGenerationFailedError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "OpenAIImageGenerationFailedError"
  }
}

export interface OpenAIImagesGenerationsRequest {
  model: string
  prompt: string
  n: 1
  size: typeof OPENAI_IMAGE_SIZE
  quality: typeof OPENAI_IMAGE_QUALITY
  output_format: "png"
  moderation: "auto"
}

export function buildOpenAIImagePrompt(brief: ImageBrief): string {
  const toneLine = brief.tone?.trim()
    ? `Tone: ${brief.tone.trim()}`
    : null
  const doNotInvent = brief.doNotInvent.map((item) => `- ${item}`).join("\n")
  const hardNegatives = OPENAI_IMAGE_HARD_NEGATIVES.map(
    (item) => `- ${item}`
  ).join("\n")

  return [
    "Execute this already-conceived photograph only. Do not invent a new subject, campaign, layout, or visual direction.",
    `Imagery role: ${brief.imageryRole}`,
    ROLE_MODE_LOCK[brief.imageryRole],
    `Lead job: ${brief.leadJob}`,
    `Occupancy: ${brief.occupancy}`,
    OCCUPANCY_INSTRUCTION[brief.occupancy],
    toneLine,
    "Conceived situation:",
    brief.visualDirection,
    "This is an original illustrative category situation or general representation. It is communication, not evidence. It is not documentation of this recipient's home, property, actual crew, or damage-as-fact. Do not invent campaign-specific proof. Do not treat generic or interchangeable stock as if it proves a specific customer situation. When NOT: cheap fear or gore escalation.",
    "Do not invent:",
    doNotInvent,
    "Hard negatives — do not depict:",
    hardNegatives,
    "Generate an original photograph. Do not generate headline, offer, CTA, phone number, URL, QR code, typography, palette, or postcard layout. Those are not part of this image.",
  ]
    .filter((line): line is string => Boolean(line))
    .join("\n")
}

export function buildOpenAIImageRequest(
  brief: ImageBrief
): OpenAIImagesGenerationsRequest {
  return {
    model: OPENAI_IMAGE_MODEL,
    prompt: buildOpenAIImagePrompt(brief),
    n: 1,
    size: OPENAI_IMAGE_SIZE,
    quality: OPENAI_IMAGE_QUALITY,
    output_format: "png",
    moderation: "auto",
  }
}

export function createOpenAIImageGenerationAdapter(): ImageGenerationAdapter {
  const apiKey = process.env.OPENAI_API_KEY?.trim()
  if (!apiKey) {
    throw new OpenAIImageGenerationNotConfiguredError()
  }
  return new OpenAIImageGenerationAdapter({ apiKey })
}

export class OpenAIImageGenerationAdapter implements ImageGenerationAdapter {
  #apiKey: string
  #fetchImpl: typeof fetch
  #now: () => Date
  #createId: () => string

  constructor(options: {
    apiKey: string
    fetch?: typeof fetch
    now?: () => Date
    createId?: () => string
  }) {
    const apiKey = options.apiKey.trim()
    if (!apiKey) {
      throw new OpenAIImageGenerationNotConfiguredError()
    }
    this.#apiKey = apiKey
    this.#fetchImpl = options.fetch ?? fetch
    this.#now = options.now ?? (() => new Date())
    this.#createId = options.createId ?? randomUUID
  }

  async generate(brief: ImageBrief): Promise<GeneratedAsset> {
    const request = buildOpenAIImageRequest(brief)
    const response = await this.#fetchImpl(OPENAI_IMAGES_GENERATIONS_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.#apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(request),
    })

    if (!response.ok) {
      throw new OpenAIImageGenerationFailedError(
        `OpenAI image generation failed with status ${response.status}.`
      )
    }

    const payload = (await parseJson(response)) as {
      data?: Array<{ b64_json?: string; url?: string }>
    }
    const image = payload.data?.[0]
    const src = imageSrcFromPayload(image)

    if (!src) {
      throw new OpenAIImageGenerationFailedError(
        "OpenAI image generation returned an empty or malformed image payload."
      )
    }

    return {
      id: this.#createId(),
      src,
      sourceClass: GENERATED_ASSET_SOURCE_CLASS,
      provider: OPENAI_IMAGE_PROVIDER,
      model: OPENAI_IMAGE_MODEL,
      generatedAt: this.#now().toISOString(),
    }
  }
}

async function parseJson(response: Response): Promise<unknown> {
  try {
    return await response.json()
  } catch {
    throw new OpenAIImageGenerationFailedError(
      "OpenAI image generation returned an empty or malformed image payload."
    )
  }
}

function imageSrcFromPayload(
  image: { b64_json?: string; url?: string } | undefined
): string | null {
  const encoded = image?.b64_json?.trim()
  if (encoded) return `data:image/png;base64,${encoded}`
  const url = image?.url?.trim()
  return url || null
}

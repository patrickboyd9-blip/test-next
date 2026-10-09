import { randomUUID } from "crypto"

import type { ImageBrief } from "./image-brief"
import {
  GENERATED_ASSET_SOURCE_CLASS,
  type GeneratedAsset,
  type ImageGenerationAdapter,
  type ImageGenerationOptions,
} from "./image-generation"
import {
  OPENAI_IMAGE_MODEL_FALLBACK,
  OPENAI_IMAGE_MODEL_PIN,
  estimateImageCostUsd,
  logImageCost,
  resolveOpenAIImageSettings,
  type OpenAIImageQuality,
  type OpenAIImageUsage,
  type StudioImageTier,
} from "./openai-image-settings"
import {
  OPENAI_IMAGE_ALWAYS_EXCLUSIONS,
  buildOpenAIImagePrompt,
} from "./photography-shot-list"

export const OPENAI_IMAGE_PROVIDER = "openai"
/** Documented GPT Image 2.5 Flare snapshot. Override with OPENAI_IMAGE_MODEL. */
export const OPENAI_IMAGE_MODEL = OPENAI_IMAGE_MODEL_PIN
export const OPENAI_IMAGE_SIZE = "1536x1024"
export const OPENAI_IMAGE_QUALITY = "medium"
export const OPENAI_IMAGES_GENERATIONS_URL =
  "https://api.openai.com/v1/images/generations"

export { OPENAI_IMAGE_ALWAYS_EXCLUSIONS, buildOpenAIImagePrompt }

/** Phrases the shot list must keep out of the photograph. */
export const OPENAI_IMAGE_HARD_NEGATIVES = [
  "text",
  "letters",
  "signage",
  "logos",
  "watermarks",
  "QR codes",
  "overlays",
  "plastic skin",
  "CGI gloss",
  "symmetrical faces",
  "warped tools",
] as const

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
  n: number
  size: string
  quality: OpenAIImageQuality
  output_format: "png"
  moderation: "auto"
}

export interface OpenAIImageGenerationResult {
  asset: GeneratedAsset
  alternates: GeneratedAsset[]
  usage: OpenAIImageUsage | null
}

export function buildOpenAIImageRequest(
  brief: ImageBrief,
  options?: { tier?: StudioImageTier; env?: NodeJS.ProcessEnv }
): OpenAIImagesGenerationsRequest {
  const settings = resolveOpenAIImageSettings(options?.tier ?? "preview", options?.env)
  return {
    model: settings.model,
    prompt: buildOpenAIImagePrompt(brief),
    n: settings.candidateCount,
    size: settings.size,
    quality: settings.quality,
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
  #env: NodeJS.ProcessEnv | undefined

  constructor(options: {
    apiKey: string
    fetch?: typeof fetch
    now?: () => Date
    createId?: () => string
    /** When omitted, production reads process.env at call time. */
    env?: NodeJS.ProcessEnv
  }) {
    const apiKey = options.apiKey.trim()
    if (!apiKey) {
      throw new OpenAIImageGenerationNotConfiguredError()
    }
    this.#apiKey = apiKey
    this.#fetchImpl = options.fetch ?? fetch
    this.#now = options.now ?? (() => new Date())
    this.#createId = options.createId ?? randomUUID
    this.#env = options.env
  }

  async generate(
    brief: ImageBrief,
    options?: ImageGenerationOptions
  ): Promise<GeneratedAsset> {
    const detailed = await this.generateDetailed(brief, options)
    return detailed.asset
  }

  async generateDetailed(
    brief: ImageBrief,
    options?: ImageGenerationOptions
  ): Promise<OpenAIImageGenerationResult> {
    const tier = options?.tier ?? "preview"
    const env = this.#env ?? process.env
    let request = buildOpenAIImageRequest(brief, { tier, env })
    if (options?.candidateCount) {
      request = {
        ...request,
        n: Math.min(3, Math.max(1, options.candidateCount)),
      }
    }

    let attempt = 1
    let response = await this.#post(request)
    if (!response.ok) {
      const body = await readErrorBody(response)
      const fallback =
        isUnknownModelError(response.status, body) &&
        request.model !== OPENAI_IMAGE_MODEL_FALLBACK
      if (!fallback) {
        this.#log(request, tier, options, response.status, null, attempt)
        throw new OpenAIImageGenerationFailedError(
          `OpenAI image generation failed with status ${response.status}.`
        )
      }
      this.#log(request, tier, options, response.status, null, attempt)
      request = { ...request, model: OPENAI_IMAGE_MODEL_FALLBACK }
      attempt = 2
      response = await this.#post(request)
    }

    if (!response.ok) {
      this.#log(request, tier, options, response.status, null, attempt)
      throw new OpenAIImageGenerationFailedError(
        `OpenAI image generation failed with status ${response.status}.`
      )
    }

    const payload = (await parseJson(response)) as {
      data?: Array<{ b64_json?: string; url?: string }>
      usage?: OpenAIImageUsage
    }
    const images = payload.data ?? []
    const chosenIndex = pickCandidateIndex(images)
    const chosen = images[chosenIndex]
    const src = imageSrcFromPayload(chosen)
    if (!src) {
      throw new OpenAIImageGenerationFailedError(
        "OpenAI image generation returned an empty or malformed image payload."
      )
    }

    const generatedAt = this.#now().toISOString()
    const toAsset = (imageSrc: string, index: number): GeneratedAsset => ({
      id: index === chosenIndex ? this.#createId() : `${this.#createId()}-${index}`,
      src: imageSrc,
      sourceClass: GENERATED_ASSET_SOURCE_CLASS,
      provider: OPENAI_IMAGE_PROVIDER,
      model: request.model,
      generatedAt,
    })

    const asset = toAsset(src, chosenIndex)
    const alternates = images.flatMap((image, index) => {
      if (index === chosenIndex) return []
      const alternateSrc = imageSrcFromPayload(image)
      return alternateSrc ? [toAsset(alternateSrc, index)] : []
    })

    this.#log(request, tier, options, response.status, payload.usage ?? null, attempt)
    return { asset, alternates, usage: payload.usage ?? null }
  }

  async #post(request: OpenAIImagesGenerationsRequest): Promise<Response> {
    return this.#fetchImpl(OPENAI_IMAGES_GENERATIONS_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.#apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(request),
    })
  }

  #log(
    request: OpenAIImagesGenerationsRequest,
    tier: StudioImageTier,
    options: ImageGenerationOptions | undefined,
    status: number,
    usage: OpenAIImageUsage | null,
    attempt: number
  ): void {
    logImageCost({
      model: request.model,
      quality: request.quality,
      size: request.size,
      n: request.n,
      tier,
      campaignId: options?.campaignId,
      directionId: options?.directionId,
      attempt,
      status,
      usage,
      estimatedUsd: estimateImageCostUsd(usage),
    })
  }
}

export function pickCandidateIndex(
  images: Array<{ b64_json?: string; url?: string }>
): number {
  let best = 0
  let bestSize = -1
  for (let index = 0; index < images.length; index += 1) {
    const encoded = images[index]?.b64_json?.trim() ?? ""
    const size = encoded ? encoded.length : (images[index]?.url?.trim().length ?? 0)
    if (size > bestSize) {
      best = index
      bestSize = size
    }
  }
  return best
}

function isUnknownModelError(status: number, body: string): boolean {
  if (status !== 400 && status !== 404) return false
  return /model_not_found|unknown model|invalid model|does not exist|model .* not found/i.test(
    body
  )
}

async function readErrorBody(response: Response): Promise<string> {
  try {
    return (await response.text()).slice(0, 500)
  } catch {
    return ""
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

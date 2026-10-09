/**
 * Direct Images API settings for POST /v1/images/generations.
 * The Responses API image tool is intentionally not used: it rewrites prompts.
 *
 * gpt-image-2.5-flare-2026-09-08 is the documented default snapshot of
 * GPT Image 2.5 Flare (https://developers.openai.com/api/docs/models/gpt-image-2.5-flare).
 * Flare is the fast 2.5 model, which matters under a 60s function cap.
 * If that snapshot is rejected, the caller falls back to gpt-image-2.
 */

export const OPENAI_IMAGE_MODEL_PIN = "gpt-image-2.5-flare-2026-09-08"
export const OPENAI_IMAGE_MODEL_FALLBACK = "gpt-image-2"

/** Landscape preview. Standard GPT Image size, medium quality, fast enough for three directions. */
export const OPENAI_IMAGE_SIZE_PREVIEW = "1536x1024"
export const OPENAI_IMAGE_QUALITY_PREVIEW = "medium"

/**
 * 5×8 trim at 300 DPI is 2400×1500. 2400×1504 is a valid Images API size
 * (edges are multiples of 16) and covers the trim, not the bleed.
 * The artwork canvas is 8.5×5.5 in, which is 2550×1650 at 300 DPI.
 * 2550 and 1650 are not multiples of 16, so the final default rounds up
 * to 2560×1664. That covers the bleed canvas without upscaling.
 */
export const OPENAI_IMAGE_SIZE_TRIM = "2400x1504"
export const OPENAI_IMAGE_SIZE_FINAL = "2560x1664"
export const OPENAI_IMAGE_QUALITY_FINAL = "high"

export const PRINT_CANVAS_PX = { width: 2550, height: 1650 } as const

const MIN_PIXELS = 655_360
const MAX_PIXELS = 8_294_400
const MAX_EDGE = 3840

export const OPENAI_IMAGE_QUALITIES = [
  "low",
  "medium",
  "high",
  "xhigh",
  "max",
  "auto",
] as const
export type OpenAIImageQuality = (typeof OPENAI_IMAGE_QUALITIES)[number]

export type StudioImageTier = "preview" | "final"

export interface ResolvedImageSettings {
  model: string
  quality: OpenAIImageQuality
  size: string
  candidateCount: number
}

export function isSupportedGptImageSize(size: string): boolean {
  const match = /^(\d+)x(\d+)$/.exec(size.trim())
  if (!match) return false
  const width = Number(match[1])
  const height = Number(match[2])
  if (!Number.isInteger(width) || !Number.isInteger(height)) return false
  if (width % 16 !== 0 || height % 16 !== 0) return false
  if (width > MAX_EDGE || height > MAX_EDGE || width < 16 || height < 16) return false
  const longEdge = Math.max(width, height)
  const shortEdge = Math.min(width, height)
  if (longEdge / shortEdge > 3) return false
  const pixels = width * height
  return pixels >= MIN_PIXELS && pixels <= MAX_PIXELS
}

/** Round each edge up to a multiple of 16, then give up if the result is illegal. */
export function snapGptImageSize(width: number, height: number): string | null {
  const snappedWidth = Math.ceil(width / 16) * 16
  const snappedHeight = Math.ceil(height / 16) * 16
  const size = `${snappedWidth}x${snappedHeight}`
  return isSupportedGptImageSize(size) ? size : null
}

export function resolveOpenAIImageModel(env?: NodeJS.ProcessEnv): string {
  const pinned = env?.OPENAI_IMAGE_MODEL?.trim()
  return pinned || OPENAI_IMAGE_MODEL_PIN
}

export function resolveOpenAIImageSettings(
  tier: StudioImageTier,
  env?: NodeJS.ProcessEnv
): ResolvedImageSettings {
  const preview = tier === "preview"
  const fallbackQuality = preview
    ? OPENAI_IMAGE_QUALITY_PREVIEW
    : OPENAI_IMAGE_QUALITY_FINAL
  const fallbackSize = preview ? OPENAI_IMAGE_SIZE_PREVIEW : OPENAI_IMAGE_SIZE_FINAL
  const qualityEnv = preview
    ? env?.OPENAI_IMAGE_QUALITY_PREVIEW
    : env?.OPENAI_IMAGE_QUALITY_FINAL
  const sizeEnv = preview
    ? env?.OPENAI_IMAGE_SIZE_PREVIEW
    : env?.OPENAI_IMAGE_SIZE_FINAL
  const countEnv = preview
    ? env?.OPENAI_IMAGE_CANDIDATES_PREVIEW
    : env?.OPENAI_IMAGE_CANDIDATES_FINAL

  return {
    model: resolveOpenAIImageModel(env),
    quality: qualityFrom(qualityEnv, fallbackQuality),
    size: sizeFrom(sizeEnv, fallbackSize),
    candidateCount: countFrom(countEnv, 1),
  }
}

function qualityFrom(
  value: string | undefined,
  fallback: OpenAIImageQuality
): OpenAIImageQuality {
  const quality = value?.trim().toLowerCase()
  if (!quality) return fallback
  return (OPENAI_IMAGE_QUALITIES as readonly string[]).includes(quality)
    ? (quality as OpenAIImageQuality)
    : fallback
}

function sizeFrom(value: string | undefined, fallback: string): string {
  const size = value?.trim()
  if (!size) return fallback
  return isSupportedGptImageSize(size) ? size : fallback
}

function countFrom(value: string | undefined, fallback: number): number {
  if (!value?.trim()) return fallback
  const parsed = Number(value)
  if (!Number.isInteger(parsed)) return fallback
  return Math.min(3, Math.max(1, parsed))
}

/**
 * GPT Image 2.5 token rates from the image generation guide:
 * $5 / 1M text input, $8 / 1M image input, $30 / 1M image output.
 * Direct Images API calls do not get cached-input pricing.
 */
export interface OpenAIImageUsage {
  input_tokens?: number
  output_tokens?: number
  total_tokens?: number
  input_tokens_details?: { text_tokens?: number; image_tokens?: number }
  output_tokens_details?: { image_tokens?: number; text_tokens?: number }
}

export function estimateImageCostUsd(usage: OpenAIImageUsage | null): number | null {
  if (!usage) return null
  const details = usage.input_tokens_details
  const textTokens = details
    ? (details.text_tokens ?? 0)
    : (usage.input_tokens ?? 0)
  const imageIn = details?.image_tokens ?? 0
  const imageOut =
    usage.output_tokens_details?.image_tokens ?? usage.output_tokens ?? 0
  if (textTokens === 0 && imageIn === 0 && imageOut === 0) {
    if (!usage.total_tokens) return null
    return roundUsd(usage.total_tokens * 30e-6)
  }
  return roundUsd(textTokens * 5e-6 + imageIn * 8e-6 + imageOut * 30e-6)
}

function roundUsd(value: number): number {
  return Math.round(value * 10_000) / 10_000
}

export interface ImageCostLog {
  model: string
  quality: string
  size: string
  n: number
  tier: StudioImageTier
  campaignId?: string
  directionId?: string
  attempt: number
  status: number
  usage: OpenAIImageUsage | null
  estimatedUsd: number | null
}

export function imageCostLogLine(entry: ImageCostLog): string {
  return JSON.stringify({ event: "studio_image_cost", ...entry })
}

export function logImageCost(entry: ImageCostLog): void {
  console.info(imageCostLogLine(entry))
}

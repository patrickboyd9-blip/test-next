import { randomUUID } from "node:crypto"

import { GENERATED_ASSET_SOURCE_CLASS, type GeneratedAsset, type ImageGenerationAdapter, type ImageGenerationOptions } from "./image-generation"
import type { ImageBrief } from "./image-brief"
import { buildOpenAIImagePrompt } from "./openai-image-generation"
import { trimPhotoFrame } from "./trim-photo-frame"

/**
 * google/nano-banana-pro on Replicate. 1K and 2K are $0.15 per image. 4K is $0.30.
 * This client asks for 2K and does not enable the fallback model.
 */
export const IMAGEN_ESTIMATED_USD = 0.15
export const IMAGEN_IMAGE_PROVIDER = "replicate"
export const IMAGEN_IMAGE_MODEL = "google/nano-banana-pro"
export const NANO_BANANA_RESOLUTION = "2K"
export const IMAGEN_ASPECT_RATIO = "4:3"
/** Ratios google/nano-banana-pro accepts. match_input_image is omitted because we send no reference image. */
export const IMAGEN_ASPECT_RATIOS = {
  "1:1": 1,
  "2:3": 2 / 3,
  "3:2": 3 / 2,
  "3:4": 3 / 4,
  "4:3": 4 / 3,
  "4:5": 4 / 5,
  "5:4": 5 / 4,
  "9:16": 9 / 16,
  "16:9": 16 / 9,
  "21:9": 21 / 9,
} as const

/** The supported ratio closest to the photo slot (width / height), compared in log space. */
export function imagenAspectFor(slotAspect?: number): string {
  if (!slotAspect || !Number.isFinite(slotAspect) || slotAspect <= 0) return IMAGEN_ASPECT_RATIO
  return Object.entries(IMAGEN_ASPECT_RATIOS).reduce((best, [k, v]) => (Math.abs(Math.log(v / slotAspect)) < Math.abs(Math.log(IMAGEN_ASPECT_RATIOS[best as keyof typeof IMAGEN_ASPECT_RATIOS] / slotAspect)) ? k : best), IMAGEN_ASPECT_RATIO)
}

const FULL_BLEED_NOTE = " Full-bleed photograph that fills the entire frame edge to edge. No border, no frame, no mat, no white or gray margin, not a printed photo."

/** google/imagen-4 on Replicate. About $0.04 per image. */
export const IMAGEN4_IMAGE_MODEL = "google/imagen-4"
export const IMAGEN4_ESTIMATED_USD = 0.04

export async function generateImagen4Jpeg(
  prompt: string,
  options: { token: string; aspectRatio: string; fetch?: typeof fetch }
): Promise<Buffer> {
  const fetchImpl = options.fetch ?? fetch
  const headers = {
    Authorization: `Bearer ${options.token}`,
    "Content-Type": "application/json",
    Prefer: "wait=60",
  }
  const res = await fetchImpl(`https://api.replicate.com/v1/models/${IMAGEN4_IMAGE_MODEL}/predictions`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      input: {
        prompt,
        aspect_ratio: options.aspectRatio,
        output_format: "jpg",
        safety_filter_level: "block_only_high",
      },
    }),
  })
  if (!res.ok) throw imageModelHttpError(res.status, IMAGEN4_IMAGE_MODEL)
  let pred = (await res.json()) as { id?: string; status: string; output?: string | string[]; urls?: { get?: string }; error?: string }
  for (let i = 0; i < 60 && !["succeeded", "failed", "canceled"].includes(pred.status); i++) {
    await new Promise((r) => setTimeout(r, 2000))
    const next = pred.urls?.get
    if (!next) break
    pred = (await (await fetchImpl(next, { headers: { Authorization: headers.Authorization } })).json()) as typeof pred
  }
  const url = Array.isArray(pred.output) ? pred.output[0] : pred.output
  if (pred.status !== "succeeded" || !url) {
    throw new Error(`Image generation ${pred.status}. No photograph was saved.`)
  }
  const img = await fetchImpl(url)
  if (!img.ok) throw new Error(`Image download failed with status ${img.status}. No photograph was saved.`)
  console.log("[image-generation]", JSON.stringify({ provider: IMAGEN_IMAGE_PROVIDER, model: IMAGEN4_IMAGE_MODEL, prediction: pred.id ?? "", estimatedUsd: IMAGEN4_ESTIMATED_USD }))
  return Buffer.from(await img.arrayBuffer())
}

export function imageModelHttpError(status: number, model: string): Error {
  if (status === 410) {
    return new Error(`The image model ${model} is retired. Replicate returned 410, so no photograph was saved.`)
  }
  return new Error(`Image generation failed with status ${status}. No photograph was saved.`)
}

export function nanoBananaInput(prompt: string, aspectRatio: string) {
  return {
    prompt,
    aspect_ratio: aspectRatio,
    resolution: NANO_BANANA_RESOLUTION,
    output_format: "png" as const,
    safety_filter_level: "block_only_high" as const,
  }
}

export class ImagenNotConfiguredError extends Error {
  constructor() {
    super("REPLICATE_API_TOKEN is not configured.")
    this.name = "ImagenNotConfiguredError"
  }
}

export function createImagenImageGenerationAdapter(env: NodeJS.ProcessEnv = process.env): ImageGenerationAdapter {
  const token = env.REPLICATE_API_TOKEN?.trim()
  if (!token) throw new ImagenNotConfiguredError()
  return new ImagenImageGenerationAdapter({ token })
}

export class ImagenImageGenerationAdapter implements ImageGenerationAdapter {
  #token: string
  #fetch: typeof fetch
  constructor(options: { token: string; fetch?: typeof fetch }) {
    this.#token = options.token
    this.#fetch = options.fetch ?? fetch
  }

  async generate(brief: ImageBrief, options?: ImageGenerationOptions): Promise<GeneratedAsset> {
    const headers = { Authorization: `Bearer ${this.#token}`, "Content-Type": "application/json", Prefer: "wait=60" }
    const res = await this.#fetch(`https://api.replicate.com/v1/models/${IMAGEN_IMAGE_MODEL}/predictions`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        input: nanoBananaInput(buildOpenAIImagePrompt(brief) + FULL_BLEED_NOTE, imagenAspectFor(options?.slotAspect)),
      }),
    })
    if (!res.ok) throw imageModelHttpError(res.status, IMAGEN_IMAGE_MODEL)
    let pred = (await res.json()) as { id: string; status: string; output?: string | string[]; urls?: { get?: string } }
    for (let i = 0; i < 60 && !["succeeded", "failed", "canceled"].includes(pred.status); i++) {
      await new Promise((r) => setTimeout(r, 2000))
      pred = (await (await this.#fetch(pred.urls!.get!, { headers: { Authorization: headers.Authorization } })).json()) as typeof pred
    }
    const url = Array.isArray(pred.output) ? pred.output[0] : pred.output
    if (pred.status !== "succeeded" || !url) throw new Error(`Image generation ${pred.status}. No photograph was saved.`)
    const img = await this.#fetch(url)
    if (!img.ok) throw new Error(`Image download failed with status ${img.status}. No photograph was saved.`)
    const b64 = (await trimPhotoFrame(Buffer.from(await img.arrayBuffer()))).toString("base64")
    console.log("[image-generation]", JSON.stringify({ provider: IMAGEN_IMAGE_PROVIDER, model: IMAGEN_IMAGE_MODEL, prediction: pred.id, estimatedUsd: IMAGEN_ESTIMATED_USD }))
    return { id: randomUUID(), src: `data:image/png;base64,${b64}`, sourceClass: GENERATED_ASSET_SOURCE_CLASS, provider: IMAGEN_IMAGE_PROVIDER, model: IMAGEN_IMAGE_MODEL, generatedAt: new Date().toISOString() }
  }
}

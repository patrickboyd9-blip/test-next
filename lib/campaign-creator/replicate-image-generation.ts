import { randomUUID } from "node:crypto"

import { GENERATED_ASSET_SOURCE_CLASS, type GeneratedAsset, type ImageGenerationAdapter, type ImageGenerationOptions } from "./image-generation"
import type { ImageBrief } from "./image-brief"
import { buildOpenAIImagePrompt } from "./openai-image-generation"
import { trimPhotoFrame } from "./trim-photo-frame"

/** Patrick's blind photo test (Oct 27 2026): Imagen 4 won 5 of 10 scenes. About $0.04 per image on Replicate. */
export const IMAGEN_IMAGE_PROVIDER = "replicate"
export const IMAGEN_IMAGE_MODEL = "google/imagen-4"
export const IMAGEN_ASPECT_RATIO = "4:3"
/** Ratios google/imagen-4 accepts (it has no 3:2). */
export const IMAGEN_ASPECT_RATIOS = { "1:1": 1, "4:3": 4 / 3, "16:9": 16 / 9, "3:4": 3 / 4, "9:16": 9 / 16 } as const

/** The supported ratio closest to the photo slot (width / height), compared in log space. */
export function imagenAspectFor(slotAspect?: number): string {
  if (!slotAspect || !Number.isFinite(slotAspect) || slotAspect <= 0) return IMAGEN_ASPECT_RATIO
  return Object.entries(IMAGEN_ASPECT_RATIOS).reduce((best, [k, v]) => (Math.abs(Math.log(v / slotAspect)) < Math.abs(Math.log(IMAGEN_ASPECT_RATIOS[best as keyof typeof IMAGEN_ASPECT_RATIOS] / slotAspect)) ? k : best), IMAGEN_ASPECT_RATIO)
}

const FULL_BLEED_NOTE = " Full-bleed photograph that fills the entire frame edge to edge. No border, no frame, no mat, no white or gray margin, not a printed photo."

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
      body: JSON.stringify({ input: { prompt: buildOpenAIImagePrompt(brief) + FULL_BLEED_NOTE, aspect_ratio: imagenAspectFor(options?.slotAspect), output_format: "png", safety_filter_level: "block_only_high" } }),
    })
    if (!res.ok) throw new Error(`Imagen generation failed with status ${res.status}.`)
    let pred = (await res.json()) as { id: string; status: string; output?: string | string[]; urls?: { get?: string } }
    for (let i = 0; i < 60 && !["succeeded", "failed", "canceled"].includes(pred.status); i++) {
      await new Promise((r) => setTimeout(r, 2000))
      pred = (await (await this.#fetch(pred.urls!.get!, { headers: { Authorization: headers.Authorization } })).json()) as typeof pred
    }
    const url = Array.isArray(pred.output) ? pred.output[0] : pred.output
    if (pred.status !== "succeeded" || !url) throw new Error(`Imagen generation ${pred.status}.`)
    const img = await this.#fetch(url)
    if (!img.ok) throw new Error(`Imagen download failed with status ${img.status}.`)
    const b64 = (await trimPhotoFrame(Buffer.from(await img.arrayBuffer()))).toString("base64")
    console.log("[image-generation]", JSON.stringify({ provider: IMAGEN_IMAGE_PROVIDER, model: IMAGEN_IMAGE_MODEL, prediction: pred.id, estimatedUsd: 0.04 }))
    return { id: randomUUID(), src: `data:image/png;base64,${b64}`, sourceClass: GENERATED_ASSET_SOURCE_CLASS, provider: IMAGEN_IMAGE_PROVIDER, model: IMAGEN_IMAGE_MODEL, generatedAt: new Date().toISOString() }
  }
}

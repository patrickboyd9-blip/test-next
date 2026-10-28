import type { TypeSeat } from "@/lib/design-intelligence/rationale"

import type { ImageBrief } from "./image-brief"

export interface ImageGenerationOptions {
  tier?: "preview" | "final"
  candidateCount?: number
  campaignId?: string
  directionId?: string
  /** Width / height of the photo slot, so providers can request the closest aspect ratio. */
  slotAspect?: number
}

/**
 * Execute-only generation boundary. Receives an already-conceived ImageBrief.
 * Does not author strategy, CreativeSpec, or renderer state.
 * Implementations may be OpenAI, Recraft, FLUX, or another provider later.
 */
export interface ImageGenerationAdapter {
  generate(brief: ImageBrief, options?: ImageGenerationOptions): Promise<GeneratedAsset>
}

export const GENERATED_ASSET_SOURCE_CLASS = "generated" as const
export type GeneratedAssetSourceClass = typeof GENERATED_ASSET_SOURCE_CLASS

/**
 * Provider-neutral result of executing an ImageBrief.
 * Not a CreativeSpec field. Not an ImageBrief. Not persisted.
 * src is the displayable image that later enters resolveCreativeImage.
 */
export interface GeneratedAsset {
  id: string
  src: string
  sourceClass: GeneratedAssetSourceClass
  provider: string
  model: string
  generatedAt: string
  /** Calm patch measured on this photograph, so type can avoid the subject. */
  typeSeat?: TypeSeat
}

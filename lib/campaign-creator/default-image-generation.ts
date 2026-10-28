import type { GeneratedAsset, ImageGenerationAdapter, ImageGenerationOptions } from "./image-generation"
import type { ImageBrief } from "./image-brief"
import { createOpenAIImageGenerationAdapter } from "./openai-image-generation"
import { createImagenImageGenerationAdapter } from "./replicate-image-generation"

/**
 * Default photo model. IMAGE_PROVIDER=openai forces OpenAI.
 * Otherwise Imagen 4 (Replicate) runs first; OpenAI is the fallback when the
 * token is missing or a generation fails.
 */
export function createDefaultImageGenerationAdapter(env: NodeJS.ProcessEnv = process.env): ImageGenerationAdapter {
  if (env.IMAGE_PROVIDER?.trim().toLowerCase() === "openai" || !env.REPLICATE_API_TOKEN?.trim()) return createOpenAIImageGenerationAdapter()
  const primary = createImagenImageGenerationAdapter(env)
  return {
    async generate(brief: ImageBrief, options?: ImageGenerationOptions): Promise<GeneratedAsset> {
      try {
        return await primary.generate(brief, options)
      } catch (error) {
        console.warn("[image-generation] Imagen failed, falling back to OpenAI:", error instanceof Error ? error.message : "unknown")
        return createOpenAIImageGenerationAdapter().generate(brief, options)
      }
    },
  }
}

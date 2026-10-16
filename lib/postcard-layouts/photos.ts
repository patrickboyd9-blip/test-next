import type { BrandAsset } from "@/lib/campaign-creator/types"

/**
 * A customer photograph replaces the generated one when the brief already
 * carries a photo URL. Descriptions that are not URLs stay descriptions.
 */
export function customerPhotoUrls(assets: readonly BrandAsset[] | undefined): string[] {
  if (!assets) return []
  const urls: string[] = []
  for (const asset of assets) {
    if (asset.type !== "photo" && asset.type !== "graphic") continue
    const candidate = asset.fileUrl?.trim() || asset.description.trim()
    if (isPhotoUrl(candidate)) urls.push(candidate)
  }
  return urls
}

export function slotPhotoSources(input: {
  slotCount: number
  generatedSrc?: string | null
  assets?: readonly BrandAsset[]
}): Array<string | null> {
  const uploaded = customerPhotoUrls(input.assets)
  const sources: Array<string | null> = []
  for (let index = 0; index < input.slotCount; index += 1) {
    sources.push(uploaded[index] ?? (index === 0 ? input.generatedSrc ?? null : null))
  }
  if (uploaded.length > 0 && input.slotCount > 0) {
    sources[0] = uploaded[0] ?? null
    if (input.slotCount > 1) sources[1] = uploaded[1] ?? input.generatedSrc ?? null
  }
  return sources
}

function isPhotoUrl(value: string): boolean {
  return /^https?:\/\//i.test(value) || value.startsWith("blob:") || value.startsWith("data:image/")
}

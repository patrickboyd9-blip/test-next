import { galleryPhotoSrc } from "./gallery-photo-src"
import { galleryV1 } from "./gallery-v1"
import { TEMPLATE_INDUSTRY_LABELS, type TemplateIndustry } from "./types"

export interface GalleryPhoto {
  id: string
  name: string
  summary: string
  src: string
  industry: TemplateIndustry
}

export interface GalleryCategory {
  id: TemplateIndustry
  label: string
  photos: GalleryPhoto[]
}

/**
 * One group per industry that has a picture.
 * New catalog photos, including a later 18-scene set, show up here
 * as soon as the catalog and the photo manifest list them.
 */
export function galleryCategories(): GalleryCategory[] {
  const groups = new Map<TemplateIndustry, GalleryPhoto[]>()
  for (const template of galleryV1()) {
    const src = galleryPhotoSrc(template.id)
    if (!src) continue
    const photos = groups.get(template.industry) ?? []
    photos.push({
      id: template.id,
      name: template.name,
      summary: template.summary,
      src,
      industry: template.industry,
    })
    groups.set(template.industry, photos)
  }
  return [...groups.entries()].map(([id, photos]) => ({
    id,
    label: TEMPLATE_INDUSTRY_LABELS[id],
    photos,
  }))
}

/** "3 of 18" for the photo currently open in a category. */
export function photoCountLabel(index: number, total: number): string {
  return `${index + 1} of ${total}`
}

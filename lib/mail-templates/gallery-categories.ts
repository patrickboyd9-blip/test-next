import { galleryPhotoSrc } from "./gallery-photo-src"
import { GALLERY_V1_INDUSTRIES } from "./gallery-v1"
import { listMailTemplates } from "./query"
import { isTemplateIndustry, TEMPLATE_INDUSTRY_LABELS, type TemplateIndustry } from "./types"

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
  return GALLERY_V1_INDUSTRIES.flatMap((id) => {
    const photos = listMailTemplates(id).flatMap((template) => {
      const src = galleryPhotoSrc(template.id)
      if (!src) return []
      return [{ id: template.id, name: template.name, summary: template.summary, src, industry: id }]
    })
    if (photos.length === 0) return []
    return [{ id, label: TEMPLATE_INDUSTRY_LABELS[id], photos }]
  })
}

/** "3 of 18" for the photo currently open in a category. */
export function photoCountLabel(index: number, total: number): string {
  return `${index + 1} of ${total}`
}

/** URL slug for an industry page, such as /app/templates/auto-repair. */
export function galleryIndustrySlug(id: TemplateIndustry): string {
  return id.replaceAll("_", "-")
}

/** The industry that owns this gallery URL, or null when the slug is not one. */
export function galleryCategoryBySlug(slug: string): GalleryCategory | null {
  if (!/^[a-z0-9-]+$/.test(slug)) return null
  const id = slug.replaceAll("-", "_")
  if (!isTemplateIndustry(id)) return null
  return galleryCategories().find((category) => category.id === id) ?? null
}

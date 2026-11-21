import { finishedGalleryPhotos, galleryIndustryLabel } from "./gallery-finished"
import { galleryPhotoSrc } from "./gallery-photo-src"
import { GALLERY_V1_INDUSTRIES } from "./gallery-v1"
import { listMailTemplates } from "./query"

export type GalleryPhotoKind = "photo" | "finished"

export interface GalleryPhoto {
  id: string
  name: string
  summary: string
  src: string
  industry: string
  /**
   * "photo" is an empty scene the customer can letter themselves.
   * "finished" already has the words in the picture.
   */
  kind: GalleryPhotoKind
}

export interface GalleryCategory {
  id: string
  label: string
  photos: GalleryPhoto[]
}

/**
 * One group per industry that has a picture.
 * Catalog photos show up here when the photo manifest lists them.
 * Finished example mailers are appended in label order.
 */
export function galleryCategories(): GalleryCategory[] {
  const categories: GalleryCategory[] = GALLERY_V1_INDUSTRIES.flatMap((id) => {
    const photos = listMailTemplates(id).flatMap((template) => {
      const src = galleryPhotoSrc(template.id)
      if (!src) return []
      return [{ id: template.id, name: template.name, summary: template.summary, src, industry: id, kind: "photo" as const }]
    })
    if (photos.length === 0) return []
    return [{ id, label: galleryIndustryLabel(id), photos }]
  })
  const known = new Set(categories.map((category) => category.id))
  const extras = new Map<string, GalleryPhoto[]>()
  for (const photo of finishedGalleryPhotos()) {
    const existing = categories.find((category) => category.id === photo.industry)
    if (existing) {
      existing.photos.push(photo)
      continue
    }
    const group = extras.get(photo.industry) ?? []
    group.push(photo)
    extras.set(photo.industry, group)
  }
  const added = [...extras.entries()]
    .filter(([id]) => !known.has(id))
    .map(([id, photos]) => ({ id, label: galleryIndustryLabel(id), photos }))
    .sort((a, b) => a.label.localeCompare(b.label, "en"))
  return [...categories, ...added]
}

/** "3 of 18" for the photo currently open in a category. */
export function photoCountLabel(index: number, total: number): string {
  return `${index + 1} of ${total}`
}

/** URL slug for an industry page, such as /app/templates/auto-repair. */
export function galleryIndustrySlug(id: string): string {
  return id.replaceAll("_", "-")
}

/** The industry that owns this gallery URL, or null when the slug is not one. */
export function galleryCategoryBySlug(slug: string): GalleryCategory | null {
  if (!/^[a-z0-9-]+$/.test(slug)) return null
  const id = slug.replaceAll("-", "_")
  return galleryCategories().find((category) => category.id === id) ?? null
}

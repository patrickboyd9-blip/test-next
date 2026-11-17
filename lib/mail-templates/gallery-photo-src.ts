import manifestJson from "./gallery-photo-manifest.json"

const manifest = manifestJson as { photos: { id: string; src: string }[] }

/** Public path for a generated gallery photo. Null until the manifest lists it. */
export function galleryPhotoSrc(templateId: string): string | null {
  const photo = manifest.photos.find((item) => item.id === templateId)
  return photo?.src ?? null
}

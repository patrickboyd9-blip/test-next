import { finishedGalleryPhoto } from "./gallery-finished"
import manifestJson from "./gallery-photo-manifest.json"

const manifest = manifestJson as { photos: { id: string; src: string }[] }

/** Public path for a gallery photo. Null when neither manifest lists it. */
export function galleryPhotoSrc(templateId: string): string | null {
  const photo = manifest.photos.find((item) => item.id === templateId)
  return photo?.src ?? finishedGalleryPhoto(templateId)?.src ?? null
}

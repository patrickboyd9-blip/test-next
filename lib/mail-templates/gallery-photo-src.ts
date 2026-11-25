import { isListedBackgroundPhoto } from "./gallery-curation"
import { finishedGalleryPhoto } from "./gallery-finished"
import manifestJson from "./gallery-photo-manifest.json"

const manifest = manifestJson as { photos: { id: string; src: string }[] }

/** Public path for a gallery photo. Null when neither manifest lists it. */
export function galleryPhotoSrc(templateId: string): string | null {
  const finished = finishedGalleryPhoto(templateId)
  if (finished) return finished.src
  if (!isListedBackgroundPhoto(templateId)) return null
  const photo = manifest.photos.find((item) => item.id === templateId)
  return photo?.src ?? null
}

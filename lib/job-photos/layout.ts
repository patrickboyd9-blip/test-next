import type { JobCreative, JobPhotoRecord } from "@/lib/campaign-creator/types"

import { backPhotoSlot, FRONT_PHOTO_SLOT, LOW_DETAIL_MESSAGE, windowForKeep, type KeepFit } from "./crop"

export interface FacePlacement {
  face: "front" | "back"
  treatment: "photo" | "text"
  photoId: string | null
  fit: KeepFit | null
  warning: string | null
}

export function chooseBack(creative: JobCreative, treatment: "photo" | "text", photoId: string | null = null): JobCreative {
  return {
    ...creative,
    photos: creative.photos.map((photo) => ({ ...photo, keep: { ...photo.keep } })),
    frontPhotoId: creative.frontPhotoId,
    back: { treatment, photoId: treatment === "text" ? null : photoId },
  }
}

export function placeFace(creative: JobCreative, face: "front" | "back"): FacePlacement {
  if (face === "back" && creative.back.treatment === "text") {
    return { face, treatment: "text", photoId: null, fit: null, warning: null }
  }
  const photoId = face === "front" ? creative.frontPhotoId : creative.back.photoId
  const photo = creative.photos.find((item) => item.id === photoId) ?? null
  if (!photo) {
    return {
      face,
      treatment: "text",
      photoId: null,
      fit: null,
      warning: face === "front" ? "Choose a job photo for the front." : null,
    }
  }
  const slot = face === "front" ? FRONT_PHOTO_SLOT : backPhotoSlot()
  const fit = windowForKeep(photo, photo.keep, slot)
  const soft = photo.detail === "low" ? LOW_DETAIL_MESSAGE : null
  const warning = !fit.fits ? fit.reason : soft
  return {
    face,
    treatment: fit.fits ? "photo" : "text",
    photoId: photo.id,
    fit,
    warning,
  }
}

export function photoById(creative: JobCreative, id: string | null): JobPhotoRecord | null {
  if (!id) return null
  return creative.photos.find((photo) => photo.id === id) ?? null
}

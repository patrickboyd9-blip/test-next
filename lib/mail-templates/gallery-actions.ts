import type { GalleryPhotoKind } from "./gallery-categories"

export interface GalleryPhotoActions {
  /** Blank text boxes on top of the picture. Right for an empty scene. */
  editMyself: boolean
  /** Rewrite the words already printed in a finished postcard. */
  changeWords: boolean
  /** Hand the same picture to the mailer form. */
  designForMe: boolean
}

/**
 * Finished postcards already contain the words, so blank boxes are hidden.
 * Empty gallery photos keep the boxes.
 */
export function galleryPhotoActions(kind: GalleryPhotoKind | undefined): GalleryPhotoActions {
  const finished = kind === "finished"
  return {
    editMyself: !finished,
    changeWords: finished,
    designForMe: true,
  }
}

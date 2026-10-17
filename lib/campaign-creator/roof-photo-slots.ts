/**
 * Before and after photographs are two different subjects.
 * The before frame is an exterior damaged roof. The after frame is a
 * finished roof on a house. Neither frame is an interior ceiling or empty sky.
 * Words that would make the image model stitch both states into one picture
 * stay out of these strings.
 */

export type RoofPhotoSlot = "before" | "after"

export interface RoofSlotBrief {
  subject: string
  accept: readonly string[]
  refuse: readonly string[]
  refuseLine: string
  craft: string
}

const FILL =
  "The roof and the house fill the frame. Do not leave the picture as empty sky. A narrow band of sky above the ridge is fine only when the roof and a wall of the house stay the subject."

export const ROOF_SLOT_NEGATIVE_SPACE = FILL

export const ROOF_SLOT_BRIEFS: Record<RoofPhotoSlot, RoofSlotBrief> = {
  before: {
    subject:
      "An exterior roof on a house with a damaged roof: missing shingles, curled shingles, a lifted edge, and exposed underlayment. The wall of the house and the damaged roof fill the frame. Illustrative category situation, not a documented address.",
    accept: ["damaged roof", "missing shingles", "curled shingles", "exterior roof", "exposed underlayment"],
    refuse: [
      "ceiling",
      "interior",
      "bucket",
      "empty sky",
      "finished roof",
      "new roof",
      "intact roof",
      "skylight",
    ],
    refuseLine:
      "No interior, no ceiling stain, no bucket, no empty sky, and no finished new roof. The damage is on the exterior roof of a house.",
    craft:
      "Style reference only: an exterior damaged roof on a house. Do not copy a brand, a logo, or a specimen photograph.",
  },
  after: {
    subject:
      "An exterior photograph of a house with a finished roof. Straight courses, a clean roof, and an intact ridge. The wall and the eaves stay in the frame with that finished roof.",
    accept: ["finished roof", "new roof", "clean roof", "intact ridge"],
    refuse: [
      "ceiling",
      "interior",
      "bucket",
      "empty sky",
      "damaged roof",
      "missing shingles",
      "curled shingles",
      "storm damage",
    ],
    refuseLine:
      "No interior, no ceiling, no empty sky, and no damaged or missing shingles. The roof is finished, clean, and on a house.",
    craft:
      "Style reference only: a finished clean roof on a house. Do not copy a brand, a logo, or a specimen photograph.",
  },
}

export function roofSlotForTemplate(
  templateId: string | undefined,
  photoSlot: "primary" | RoofPhotoSlot | undefined
): RoofPhotoSlot | null {
  if (templateId !== "before_after") return null
  return photoSlot === "after" ? "after" : "before"
}

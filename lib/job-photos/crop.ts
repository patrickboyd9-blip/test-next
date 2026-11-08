import { addressSideContentRect } from "@/lib/print-spec/address-side-content"
import type { JobKeepBox } from "@/lib/campaign-creator/types"

export interface SlotInches {
  w: number
  h: number
}

/** Large front photograph. Type sits beside it, not on top of the kept area. */
export const FRONT_PHOTO_SLOT: SlotInches = { w: 5.6, h: 4.5 }

export function backPhotoSlot(): SlotInches {
  const rect = addressSideContentRect()
  return { w: rect.widthInches, h: rect.heightInches }
}

export type KeepFit =
  | { fits: true; window: JobKeepBox }
  | { fits: false; reason: string }

/**
 * A cover window that contains the whole keep box and matches the slot.
 * When that window cannot sit inside the photo, nothing is cropped.
 */
export function windowForKeep(
  source: { width: number; height: number },
  keep: JobKeepBox,
  slot: SlotInches
): KeepFit {
  if (keep.w < 0.04 || keep.h < 0.04) {
    return { fits: false, reason: "Mark the part of the photo that has to stay in the card." }
  }
  if (source.width < 2 || source.height < 2 || slot.w <= 0 || slot.h <= 0) {
    return { fits: false, reason: "This photo has no usable frame." }
  }
  const widthOverHeight = (slot.w / slot.h) * (source.height / source.width)
  let w = keep.w
  let h = keep.h
  if (w / h < widthOverHeight) w = h * widthOverHeight
  else h = w / widthOverHeight
  let x = keep.x + keep.w / 2 - w / 2
  let y = keep.y + keep.h / 2 - h / 2
  if (x < 0) x = 0
  if (y < 0) y = 0
  if (x + w > 1) x = 1 - w
  if (y + h > 1) y = 1 - h
  const inside = w <= 1.001 && h <= 1.001 && x >= -0.001 && y >= -0.001
  const contains =
    x <= keep.x + 0.002 &&
    y <= keep.y + 0.002 &&
    x + w >= keep.x + keep.w - 0.002 &&
    y + h >= keep.y + keep.h - 0.002
  if (!inside || !contains) {
    return {
      fits: false,
      reason: "The card cannot show all of that area on this side. Use the words-only back, or tighten what must stay in frame.",
    }
  }
  return { fits: true, window: { x, y, w, h } }
}

/** Printed size of the kept area. Below 150 dots per inch the photo is soft, and we do not invent detail. */
export function detailFor(
  source: { width: number; height: number },
  window: JobKeepBox,
  slot: SlotInches
): "ok" | "low" {
  const dpi = (source.width * window.w) / slot.w
  return dpi < 150 ? "low" : "ok"
}

export const LOW_DETAIL_MESSAGE =
  "This photo is soft for a printed postcard. Mailing it will not add detail."

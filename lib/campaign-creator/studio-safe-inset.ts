import { POSTCARD_5X8_V1 } from "@/lib/mail-catalog/pieces/postcard-5x8"

/**
 * Type stays inside the catalog safe inset. Photography may bleed to the trim.
 * Percents are of the finished 8×5 trim, which is the Studio viewing face.
 */
export interface PostcardSafeInset {
  insetInches: number
  trimWidthInches: number
  trimHeightInches: number
  xPercent: number
  yPercent: number
}

export function postcard5x8SafeInset(): PostcardSafeInset {
  const trim = POSTCARD_5X8_V1.physical.finishedTrimInches
  const inset = POSTCARD_5X8_V1.creativeCanvas.recommendedSafeTextInsetInches
  return {
    insetInches: inset,
    trimWidthInches: trim.widthInches,
    trimHeightInches: trim.heightInches,
    xPercent: (inset / trim.widthInches) * 100,
    yPercent: (inset / trim.heightInches) * 100,
  }
}

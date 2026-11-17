import { click2MailKeepOuts } from "./click2mail-keep-outs"
import {
  buildPostcardGeometry,
  type PostcardGeometry,
} from "./postcard-5x8-print-spec"

/**
 * 6×9 template geometry.
 *
 * Trim is 9 × 6 in. The page is 9.5 × 6.5 in because bleed is 0.25 in on
 * every side. The safe inset is 0.25 in inside the trim.
 *
 * The address panel is 263 × 213 pt and the barcode clear zone is 432 × 47 pt,
 * both from the bottom-right of the trim. David Webster at Click2Mail
 * confirmed those point sizes on 2026-11-10. Templates and preflight both
 * read this function.
 */
export function buildPostcard6x9PrintSpec(): PostcardGeometry {
  return buildPostcardGeometry({
    artworkCanvasInches: { widthInches: 9.5, heightInches: 6.5 },
    finishedTrimInches: { widthInches: 9, heightInches: 6 },
    bleedInchesPerSide: 0.25,
    imageBleedExtensionMinimumInches: 0.125,
    recommendedSafeTextInsetInches: 0.25,
    keepOuts: click2MailKeepOuts("6x9", 9, 6),
  })
}

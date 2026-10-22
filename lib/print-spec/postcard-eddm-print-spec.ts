import { POSTCARD_6_25X11_V1 } from "@/lib/mail-catalog/pieces/postcard-6-25x11"
import { POSTCARD_6_5X9_V1 } from "@/lib/mail-catalog/pieces/postcard-6-5x9"
import type { MailPieceCatalogEntry } from "@/lib/mail-catalog/types"
import { eddmMessageRect, type EddmSize } from "@/lib/eddm/geometry"

import { buildPostcardGeometry, type PostcardGeometry } from "./postcard-5x8-print-spec"

export function buildEddmPrintSpec(size: EddmSize): PostcardGeometry {
  const entry = size === "6.5x9" ? POSTCARD_6_5X9_V1 : POSTCARD_6_25X11_V1
  return geometryFromEntry(entry)
}

function geometryFromEntry(entry: MailPieceCatalogEntry): PostcardGeometry {
  return buildPostcardGeometry({
    artworkCanvasInches: entry.physical.artworkCanvasInches,
    finishedTrimInches: entry.physical.finishedTrimInches,
    bleedInchesPerSide: entry.physical.bleedInchesPerSide,
    imageBleedExtensionMinimumInches: entry.physical.imageBleedExtensionMinimumInches,
    recommendedSafeTextInsetInches: entry.creativeCanvas.recommendedSafeTextInsetInches,
    keepOuts: entry.creativeCanvas.reservedKeepOut.rectangles,
  })
}

/** Address-side message area in canvas inches (bleed edge, y down). */
export function eddmMessageCanvasRect(spec: PostcardGeometry) {
  const trim = eddmMessageRect({
    widthInches: spec.finishedTrimInches.widthInches,
    heightInches: spec.finishedTrimInches.heightInches,
  })
  return {
    xInches: trim.xInches + spec.bleedInchesPerSide,
    yInches: trim.yInches + spec.bleedInchesPerSide,
    widthInches: trim.widthInches,
    heightInches: trim.heightInches,
  }
}

import { CLICK2MAIL_POSTCARD_6X9_RESERVED } from "./click2mail-reserved-zones"
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
 * The address keep-out numbers live in click2mail-reserved-zones.ts.
 * David at Click2Mail has not confirmed the 6×9 boxes. Change them there.
 * Templates and preflight both read this function.
 */
export function buildPostcard6x9PrintSpec(): PostcardGeometry {
  const trimWidth = 9
  const trimHeight = 6
  const panel = CLICK2MAIL_POSTCARD_6X9_RESERVED.mailingPanel
  const strip = CLICK2MAIL_POSTCARD_6X9_RESERVED.barcodeStrip
  const panelWidth = panel.widthInches
  const panelHeight = panel.heightInches
  const stripWidth = strip.widthInches
  const stripHeight = strip.heightInches

  return buildPostcardGeometry({
    artworkCanvasInches: { widthInches: 9.5, heightInches: 6.5 },
    finishedTrimInches: { widthInches: trimWidth, heightInches: trimHeight },
    bleedInchesPerSide: 0.25,
    imageBleedExtensionMinimumInches: 0.125,
    recommendedSafeTextInsetInches: 0.25,
    keepOuts: [
      {
        id: "mailing_panel",
        xInches: trimWidth - panelWidth,
        yInches: trimHeight - panelHeight,
        widthInches: panelWidth,
        heightInches: panelHeight,
      },
      {
        id: "barcode_strip",
        xInches: trimWidth - stripWidth,
        yInches: trimHeight - stripHeight,
        widthInches: stripWidth,
        heightInches: stripHeight,
      },
    ],
  })
}

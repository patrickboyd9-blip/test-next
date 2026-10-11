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
 * The address keep-out is the measured figure from the bring-your-own-design
 * research: 3.656 in wide by 2.948 in tall from the bottom-right of the trim,
 * plus a strip 6 in wide by 0.625 in tall. That measurement is still to be
 * confirmed with Click2Mail, so it is not a published catalog version.
 * Templates and preflight both read this function.
 */
export function buildPostcard6x9PrintSpec(): PostcardGeometry {
  const trimWidth = 9
  const trimHeight = 6
  const panelWidth = 3.656
  const panelHeight = 2.948
  const stripWidth = 6
  const stripHeight = 0.625

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

import {
  buildPostcard5x8PrintSpec,
  type InchesRect,
  type PostcardGeometry,
} from "./postcard-5x8-print-spec"

export function rectsOverlap(a: InchesRect, b: InchesRect): boolean {
  const gap = 0.01
  return (
    a.xInches + a.widthInches > b.xInches + gap &&
    b.xInches + b.widthInches > a.xInches + gap &&
    a.yInches + a.heightInches > b.yInches + gap &&
    b.yInches + b.heightInches > a.yInches + gap
  )
}

/**
 * Message area on the address side: left of the mailing panel and above the
 * barcode strip. Measured in canvas inches (bleed edge, y down).
 */
export function addressSideContentRect(
  spec: PostcardGeometry = buildPostcard5x8PrintSpec()
): InchesRect {
  const panel = spec.keepOuts.find((item) => item.id === "mailing_panel")
  const strip = spec.keepOuts.find((item) => item.id === "barcode_strip")
  if (!panel || !strip) throw new Error("5×8 print spec is missing address keep-outs.")

  const x = spec.safeTextOnCanvas.xInches
  const y = spec.safeTextOnCanvas.yInches
  const rect: InchesRect = {
    xInches: x,
    yInches: y,
    widthInches: panel.canvas.xInches - 0.15 - x,
    heightInches: strip.canvas.yInches - 0.12 - y,
  }
  if (rect.widthInches <= 1 || rect.heightInches <= 1) {
    throw new Error("Address-side content area is too small to print.")
  }
  for (const keepOut of spec.keepOuts) {
    if (rectsOverlap(rect, keepOut.canvas)) {
      throw new Error(`Postcard copy overlaps the ${keepOut.id} keep-out.`)
    }
  }
  return rect
}

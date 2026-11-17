import { rgb, type PDFPage } from "pdf-lib"

import type { PostcardGeometry } from "./postcard-5x8-print-spec"

/**
 * Paints the barcode clear zone plain white on a back.
 * Photos, scrims, and a colored paper field stop at the zone; this covers
 * the zone itself so a scanner sees white, not the card color.
 */
export function paintBarcodeClearZone(page: PDFPage, spec: PostcardGeometry): void {
  const zone = spec.keepOuts.find((item) => item.id === "barcode_strip")
  if (!zone) return
  page.drawRectangle({
    x: zone.pdf.xPoints,
    y: zone.pdf.yPoints,
    width: zone.pdf.widthPoints,
    height: zone.pdf.heightPoints,
    color: rgb(1, 1, 1),
  })
}

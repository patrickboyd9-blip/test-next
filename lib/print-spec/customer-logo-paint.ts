import type { PDFImage, PDFPage } from "pdf-lib"

import { CUSTOMER_LOGO_BOX, logoContainRect } from "@/lib/campaign-creator/customer-logo"
import { canvasRectToPdf } from "@/lib/print-spec/postcard-5x8-print-spec"

/**
 * Draws the customer's logo on the front, contained in the safe upper-left.
 * Proportions stay as they are in the file. The photograph is not modified.
 */
export function paintCustomerLogo(
  page: PDFPage,
  spec: { bleedInchesPerSide: number; artworkCanvasInches: { heightInches: number } },
  logo: PDFImage | null
): void {
  if (!logo || logo.width < 1 || logo.height < 1) return
  const placed = logoContainRect(CUSTOMER_LOGO_BOX, { width: logo.width, height: logo.height })
  const bleed = spec.bleedInchesPerSide
  const pdf = canvasRectToPdf(
    {
      xInches: bleed + placed.x,
      yInches: bleed + placed.y,
      widthInches: placed.w,
      heightInches: placed.h,
    },
    spec.artworkCanvasInches.heightInches
  )
  page.drawImage(logo, {
    x: pdf.xPoints,
    y: pdf.yPoints,
    width: pdf.widthPoints,
    height: pdf.heightPoints,
  })
}

/**
 * Address-side boxes confirmed by David Webster at Click2Mail on 2026-11-10.
 * Measurements are points (72 per inch), taken from the bottom-right corner
 * of the finished trim. The barcode clear zone is empty of type, photos,
 * logos, QR codes, and offer bars. It is painted plain white because
 * Click2Mail did not say colored ink is allowed there.
 */

export const CLICK2MAIL_POINTS_PER_INCH = 72

export const CLICK2MAIL_RESERVED_POINTS = {
  "5x8": {
    mailingPanel: { widthPoints: 265.5, heightPoints: 208 },
    barcodeClearZone: { widthPoints: 433, heightPoints: 46 },
  },
  "6x9": {
    mailingPanel: { widthPoints: 263, heightPoints: 213 },
    barcodeClearZone: { widthPoints: 432, heightPoints: 47 },
  },
} as const

export type Click2MailSize = keyof typeof CLICK2MAIL_RESERVED_POINTS

export interface TrimKeepOutRect {
  id: "mailing_panel" | "barcode_strip"
  xInches: number
  yInches: number
  widthInches: number
  heightInches: number
}

/** Trim-origin rectangles, top-left, y down, anchored to the bottom-right. */
export function click2MailKeepOuts(
  size: Click2MailSize,
  trimWidthInches: number,
  trimHeightInches: number
): TrimKeepOutRect[] {
  const boxes = CLICK2MAIL_RESERVED_POINTS[size]
  return [
    anchored("mailing_panel", trimWidthInches, trimHeightInches, boxes.mailingPanel.widthPoints, boxes.mailingPanel.heightPoints),
    anchored("barcode_strip", trimWidthInches, trimHeightInches, boxes.barcodeClearZone.widthPoints, boxes.barcodeClearZone.heightPoints),
  ]
}

function anchored(
  id: TrimKeepOutRect["id"],
  trimWidthInches: number,
  trimHeightInches: number,
  widthPoints: number,
  heightPoints: number
): TrimKeepOutRect {
  const widthInches = widthPoints / CLICK2MAIL_POINTS_PER_INCH
  const heightInches = heightPoints / CLICK2MAIL_POINTS_PER_INCH
  return {
    id,
    xInches: trimWidthInches - widthInches,
    yInches: trimHeightInches - heightInches,
    widthInches,
    heightInches,
  }
}

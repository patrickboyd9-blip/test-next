import { click2MailKeepOuts, CLICK2MAIL_POINTS_PER_INCH, type Click2MailSize } from "@/lib/print-spec/click2mail-keep-outs"

export interface InchRect {
  xInches: number
  yInches: number
  widthInches: number
  heightInches: number
}

const TRIM = {
  "5x8": { widthInches: 8, heightInches: 5 },
  "6x9": { widthInches: 9, heightInches: 6 },
} as const

/** A 0.7 in code on the left, above the barcode strip and clear of the address panel. */
export function qrSafeZone(size: Click2MailSize): InchRect {
  return {
    xInches: 0.35,
    yInches: 0.4,
    widthInches: 0.7,
    heightInches: 0.7,
  }
}

export function qrOverlapsReserved(size: Click2MailSize, qr: InchRect = qrSafeZone(size)): boolean {
  const trim = TRIM[size]
  return click2MailKeepOuts(size, trim.widthInches, trim.heightInches).some((box) => overlaps(qr, box))
}

export function overlaps(a: InchRect, b: InchRect): boolean {
  return a.xInches < b.xInches + b.widthInches
    && a.xInches + a.widthInches > b.xInches
    && a.yInches < b.yInches + b.heightInches
    && a.yInches + a.heightInches > b.yInches
}

export function pointsFromBottomRight(size: Click2MailSize, qr: InchRect = qrSafeZone(size)): { right: number; bottom: number } {
  const trim = TRIM[size]
  const right = (trim.widthInches - (qr.xInches + qr.widthInches)) * CLICK2MAIL_POINTS_PER_INCH
  const bottom = (trim.heightInches - (qr.yInches + qr.heightInches)) * CLICK2MAIL_POINTS_PER_INCH
  return { right, bottom }
}

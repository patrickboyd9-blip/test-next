/**
 * Every Door geometry from the Click2Mail layout templates, measured
 * Oct 26, 2026. The address block is 4 in by 2 in at the bottom-right of
 * the trim. Bleed is 0.25 in, which is the template page size minus the trim.
 * Click2Mail prints Postal Customer and the indicia. This file only reserves
 * the box. The numbers live in lib/print-spec/click2mail-reserved-zones.ts.
 */

import { CLICK2MAIL_EDDM_ADDRESS_BLOCK } from "@/lib/print-spec/click2mail-reserved-zones"

export const EDDM_SIZES = ["6.5x9", "6.25x11"] as const
export type EddmSize = (typeof EDDM_SIZES)[number]

export const EDDM_BLEED_INCHES = 0.25
export const EDDM_SAFE_INSET_INCHES = 0.25

export interface EddmTrim {
  widthInches: number
  heightInches: number
}

export interface EddmRect {
  id: string
  xInches: number
  yInches: number
  widthInches: number
  heightInches: number
}

export function isEddmSize(value: string | undefined): value is EddmSize {
  return value === "6.5x9" || value === "6.25x11"
}

export function eddmTrim(size: EddmSize): EddmTrim {
  if (size === "6.5x9") return { widthInches: 9, heightInches: 6.5 }
  return { widthInches: 11, heightInches: 6.25 }
}

export function eddmDisplayName(size: EddmSize): string {
  return size === "6.5x9" ? "6.5×9" : "6.25×11"
}

/**
 * A flat for Every Door: one side longer than 10.5 in, or the height over
 * 6.125 in. A 5×8 card does not qualify.
 */
export function qualifiesAsEddmFlat(widthInches: number, heightInches: number): boolean {
  const short = Math.min(widthInches, heightInches)
  const long = Math.max(widthInches, heightInches)
  return long > 10.5 || short > 6.125
}

/** One reserved rectangle, flush to the bottom-right trim edge. */
export function eddmKeepOuts(trim: EddmTrim): readonly EddmRect[] {
  const block = CLICK2MAIL_EDDM_ADDRESS_BLOCK
  return [
    {
      id: "eddm_address_block",
      xInches: roundIn(trim.widthInches - block.widthInches),
      yInches: roundIn(trim.heightInches - block.heightInches),
      widthInches: block.widthInches,
      heightInches: block.heightInches,
    },
  ]
}

/** Creative area on the address side, above the reserved block. */
export function eddmMessageRect(trim: EddmTrim): EddmRect {
  const block = eddmKeepOuts(trim)[0]
  const top = EDDM_SAFE_INSET_INCHES
  const bottom = (block?.yInches ?? trim.heightInches) - EDDM_SAFE_INSET_INCHES
  return {
    id: "eddm_message",
    xInches: EDDM_SAFE_INSET_INCHES,
    yInches: top,
    widthInches: roundIn(trim.widthInches - EDDM_SAFE_INSET_INCHES * 2),
    heightInches: roundIn(Math.max(0.5, bottom - top)),
  }
}

function roundIn(value: number): number {
  return Math.round(value * 1000) / 1000
}

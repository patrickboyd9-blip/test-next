/**
 * EDDM Retail geometry from the public USPS placement rules.
 * The indicia sits in a zone 1.625 in from the right and 1.375 in from the
 * top. Other printing stays 0.125 in away. Click2Mail has not published the
 * bleed for these sizes, so the page uses the same 0.25 in bleed as the
 * other postcards until a vendor template replaces it.
 */

export const EDDM_SIZES = ["6.5x9", "6.25x11"] as const
export type EddmSize = (typeof EDDM_SIZES)[number]

export const EDDM_BLEED_INCHES = 0.25
export const EDDM_SAFE_INSET_INCHES = 0.25
export const EDDM_INDICIA_FROM_RIGHT_INCHES = 1.625
export const EDDM_INDICIA_FROM_TOP_INCHES = 1.375
export const EDDM_CLEARANCE_INCHES = 0.125
export const EDDM_ADDRESS_WIDTH_INCHES = 3.4
export const EDDM_ADDRESS_HEIGHT_INCHES = 0.8
/** The address starts below the top so the indicia is above it and to its right. */
export const EDDM_ADDRESS_TOP_INCHES = 0.45

export const EDDM_POSTAL_CUSTOMER = "POSTAL CUSTOMER"
export const EDDM_INDICIA_LINES = ["ECRWSS", "EDDM RETAIL"] as const

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
 * A flat for EDDM Retail: one side longer than 10.5 in, or the height over
 * 6.125 in. A 5×8 card does not qualify.
 */
export function qualifiesAsEddmFlat(widthInches: number, heightInches: number): boolean {
  const short = Math.min(widthInches, heightInches)
  const long = Math.max(widthInches, heightInches)
  return long > 10.5 || short > 6.125
}

export function eddmKeepOuts(trimWidthInches: number): readonly EddmRect[] {
  const indiciaX = trimWidthInches - EDDM_INDICIA_FROM_RIGHT_INCHES
  return [
    {
      id: "eddm_indicia",
      xInches: roundIn(indiciaX),
      yInches: 0,
      widthInches: EDDM_INDICIA_FROM_RIGHT_INCHES,
      heightInches: EDDM_INDICIA_FROM_TOP_INCHES,
    },
    {
      id: "postal_customer",
      xInches: roundIn(indiciaX - EDDM_CLEARANCE_INCHES - EDDM_ADDRESS_WIDTH_INCHES),
      yInches: EDDM_ADDRESS_TOP_INCHES,
      widthInches: EDDM_ADDRESS_WIDTH_INCHES,
      heightInches: EDDM_ADDRESS_HEIGHT_INCHES,
    },
  ]
}

/** Creative area on the address side, in trim inches, below the indicia band. */
export function eddmMessageRect(trim: EddmTrim): EddmRect {
  const top = EDDM_INDICIA_FROM_TOP_INCHES + EDDM_CLEARANCE_INCHES
  return {
    id: "eddm_message",
    xInches: EDDM_SAFE_INSET_INCHES,
    yInches: top,
    widthInches: roundIn(trim.widthInches - EDDM_SAFE_INSET_INCHES * 2),
    heightInches: roundIn(trim.heightInches - top - EDDM_SAFE_INSET_INCHES),
  }
}

function roundIn(value: number): number {
  return Math.round(value * 1000) / 1000
}

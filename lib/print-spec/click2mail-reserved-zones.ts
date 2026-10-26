/**
 * Address-side boxes Click2Mail prints into.
 *
 * Change Every Door sizes here. 5×8 and 6×9 stay here too, because
 * Click2Mail's David has not confirmed those boxes yet. Do not edit the
 * published 5×8 catalog version to match a change here. Ship a new catalog
 * version when David confirms the 5×8 numbers.
 *
 * Every Door, measured Oct 26, 2026 from the Word templates at
 * https://templates.click2mail.com/every-door-direct-mail/6.5x9
 * and
 * https://templates.click2mail.com/every-door-direct-mail/6.25x11
 * Each page is the trim plus 0.25 in of bleed (9.5×7 in, and 11.5×6.75 in).
 * The white address block on the back is 4.00 in wide by 2.00 in tall and
 * sits flush to the bottom-right corner of the trim. Click2Mail prints
 * Postal Customer and the indicia there. Our file leaves that rectangle blank.
 */

export const CLICK2MAIL_EDDM_ADDRESS_BLOCK = {
  widthInches: 4,
  heightInches: 2,
} as const

/**
 * Pending confirmation from Click2Mail (David, Oct 2026).
 * These match the published POSTCARD_5X8_V1 keep-outs.
 */
export const CLICK2MAIL_POSTCARD_5X8_RESERVED = {
  mailingPanel: {
    xInches: 4.3125,
    yInches: 2.125,
    widthInches: 3.6875,
    heightInches: 2.875,
  },
  barcodeStrip: {
    xInches: 2.0,
    yInches: 4.375,
    widthInches: 6.0,
    heightInches: 0.625,
  },
} as const

/**
 * Pending confirmation from Click2Mail (David, Oct 2026).
 * The 6×9 panel is measured from the bottom-right of the trim.
 */
export const CLICK2MAIL_POSTCARD_6X9_RESERVED = {
  mailingPanel: {
    widthInches: 3.656,
    heightInches: 2.948,
  },
  barcodeStrip: {
    widthInches: 6,
    heightInches: 0.625,
  },
} as const

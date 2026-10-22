/** EDDM Retail: at least 200 pieces, and at most 5,000 pieces per ZIP per day. */

export const EDDM_MIN_PIECES = 200
export const EDDM_MAX_PIECES_PER_ZIP_PER_DAY = 5_000

export interface EddmZipTotal {
  zip: string
  pieces: number
}

export function eddmLimitMessages(input: {
  pieces: number
  perZip: readonly EddmZipTotal[]
}): string[] {
  const messages: string[] = []
  if (input.pieces < EDDM_MIN_PIECES) {
    messages.push(
      `Every Door Direct Mail needs at least ${EDDM_MIN_PIECES.toLocaleString("en-US")} pieces. Select more routes.`
    )
  }
  for (const row of input.perZip) {
    if (row.pieces > EDDM_MAX_PIECES_PER_ZIP_PER_DAY) {
      messages.push(
        `Retail Every Door Direct Mail allows ${EDDM_MAX_PIECES_PER_ZIP_PER_DAY.toLocaleString("en-US")} pieces per ZIP per day. ZIP ${row.zip} has ${row.pieces.toLocaleString("en-US")}. Deselect routes or split the mailing across days.`
      )
    }
  }
  return messages
}

export function eddmWithinLimits(input: {
  pieces: number
  perZip: readonly EddmZipTotal[]
}): boolean {
  return eddmLimitMessages(input).length === 0 && input.pieces > 0
}

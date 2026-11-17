import type { ResultsLedger } from "./ledger"

export const NOT_RECORDED = "Not recorded yet"

/** Null stays blank. A recorded zero stays zero. Nothing is estimated. */
export function presentResults(ledger: ResultsLedger): { label: string; value: string }[] {
  return [
    { label: "Pieces mailed", value: count(ledger.piecesMailed) },
    { label: "Scans", value: count(ledger.scans) },
    { label: "Unique scanners", value: count(ledger.uniqueScanners) },
    { label: "Scan rate", value: rate(ledger.scanRate) },
    { label: "Calls", value: count(ledger.calls) },
    { label: "Bookings", value: count(ledger.bookings) },
    { label: "Revenue", value: ledger.revenue == null ? NOT_RECORDED : `$${ledger.revenue}` },
  ]
}

function count(value: number | null): string {
  return value == null ? NOT_RECORDED : String(value)
}

function rate(value: number | null): string {
  if (value == null) return NOT_RECORDED
  return `${Math.round(value * 1000) / 10}%`
}

/** Street, city, state, and ZIP folded so "12 Main St." matches "12 main street". */
export function addressKey(input: { street?: string; city?: string; state?: string; zip?: string }): string {
  const street = (input.street ?? "")
    .toLowerCase()
    .replace(/\bstreet\b/g, "st")
    .replace(/\bavenue\b/g, "ave")
    .replace(/\broad\b/g, "rd")
    .replace(/[^a-z0-9]/g, "")
  const city = (input.city ?? "").toLowerCase().replace(/[^a-z0-9]/g, "")
  const state = (input.state ?? "").toLowerCase().replace(/[^a-z]/g, "").slice(0, 2)
  const zip = (input.zip ?? "").replace(/\D/g, "").slice(0, 5)
  return [street, city, state, zip].filter(Boolean).join("|")
}

export interface MatchbackResult {
  mailed: number
  uploaded: number
  matched: number
  sentence: string
}

/**
 * Compares new-customer rows with the addresses that were mailed.
 * A row matches when the normalized street and ZIP are the same.
 */
export function matchback(mailed: readonly string[], uploaded: readonly string[]): MatchbackResult {
  const mailedKeys = new Set(mailed.map((line) => addressKey({ street: line })).filter(Boolean))
  const seen = new Set<string>()
  let matched = 0
  for (const line of uploaded) {
    const key = addressKey({ street: line })
    if (!key || seen.has(key)) continue
    seen.add(key)
    if (mailedKeys.has(key)) matched += 1
  }
  const uploadedCount = seen.size
  const sentence =
    mailedKeys.size === 0
      ? "Save the mailed addresses on this campaign before a match can run."
      : `${matched} of your new customers received this mailer.`
  return { mailed: mailedKeys.size, uploaded: uploadedCount, matched, sentence }
}

/** Pulls a street-like column, or the whole line when the file has no header. */
export function streetsFromCsv(csv: string): string[] {
  const lines = csv.split(/\r?\n/).map((line) => line.trim()).filter(Boolean)
  if (lines.length === 0) return []
  const header = splitCsv(lines[0] ?? "").map((cell) => cell.toLowerCase())
  const streetIndex = header.findIndex((cell) => /address|street/.test(cell) && !/email/.test(cell))
  const start = streetIndex >= 0 ? 1 : 0
  const index = streetIndex >= 0 ? streetIndex : 0
  return lines.slice(start).map((line) => splitCsv(line)[index]?.trim() ?? "").filter(Boolean)
}

function splitCsv(line: string): string[] {
  const cells: string[] = []
  let current = ""
  let quoted = false
  for (const char of line) {
    if (char === '"') {
      quoted = !quoted
      continue
    }
    if (char === "," && !quoted) {
      cells.push(current)
      current = ""
      continue
    }
    current += char
  }
  cells.push(current)
  return cells
}

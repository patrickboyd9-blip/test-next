/**
 * The line under a direction on the compare screen.
 * Research ids, blueprint codes, and the long citation stay off this line.
 */
const INTERNAL_SENTENCE = /\b(?:blueprint|pm-\d+|mmr-\d+|gold-[a-z0-9-]+)\b|\bbased on research\b|\blearn the discipline\b|\bdo not copy\b|\bresearch id\b|\binternal response\b|\bdo not print\b|^uses:/i

export function publicDirectionLine(value: string | undefined | null): string | null {
  const line = value?.replace(/\s+/g, " ").trim()
  if (!line) return null
  const kept: string[] = []
  for (const sentence of line.split(/(?<=[.!?])\s+/)) {
    const trimmed = sentence.trim()
    if (!trimmed || INTERNAL_SENTENCE.test(trimmed)) continue
    if (kept.some((item) => item.toLowerCase() === trimmed.toLowerCase())) continue
    kept.push(trimmed)
  }
  if (kept.length === 0) return null
  return kept.join(" ")
}

export function designDebugEnabled(): boolean {
  return process.env.NEXT_PUBLIC_DESIGN_DEBUG === "1"
}

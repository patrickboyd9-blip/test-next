/**
 * The line under a direction on the compare screen.
 * Research ids, blueprint codes, and the long citation stay off this line.
 */
export function publicDirectionLine(value: string | undefined | null): string | null {
  const line = value?.replace(/\s+/g, " ").trim()
  if (!line) return null
  if (/\b(?:blueprint|pm-\d+|mmr-\d+)\b/i.test(line)) return null
  if (/based on research/i.test(line)) return null
  return line
}

export function designDebugEnabled(): boolean {
  return process.env.NEXT_PUBLIC_DESIGN_DEBUG === "1"
}

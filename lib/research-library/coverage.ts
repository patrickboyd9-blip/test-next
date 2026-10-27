import type { CoverageRow, CoverageStats, ResearchEntry, ResearchIndex } from "./types"

export function coverageStats(entries: readonly ResearchEntry[], coverage: readonly CoverageRow[], pending = 0): CoverageStats {
  return {
    discovered: coverage.length,
    indexed: coverage.filter((row) => row.status === "indexed").length,
    skipped: coverage.filter((row) => row.status === "skipped").length,
    usable: entries.length,
    visual: entries.filter((entry) => entry.evidence === "visual").length,
    textOnly: entries.filter((entry) => entry.evidence === "text").length,
    gold: entries.filter((entry) => entry.gold).length,
    pending,
  }
}

export function formatCoverageReport(index: Pick<ResearchIndex, "entries" | "coverage" | "stats" | "builtAt">): string {
  const lines = [
    `Research library coverage at ${index.builtAt}`,
    `Records usable: ${index.stats.usable} (image-backed ${index.stats.visual}, text-only ${index.stats.textOnly}, gold recipes ${index.stats.gold}).`,
    `Files and folders considered: ${index.stats.discovered}. Indexed: ${index.stats.indexed}. Skipped: ${index.stats.skipped}. Still queued: ${index.stats.pending}.`,
  ]
  const skipped = index.coverage.filter((row) => row.status === "skipped")
  if (skipped.length === 0) {
    lines.push("Nothing was skipped.")
  } else {
    lines.push("Skipped, with reasons:")
    for (const row of skipped) {
      lines.push(`- ${row.path}: ${row.reason ?? "No reason recorded."}`)
    }
  }
  const missing = skipped.filter((row) => !row.reason?.trim())
  if (missing.length > 0) lines.push(`ERROR: ${missing.length} skipped row(s) have no reason.`)
  else lines.push("Every skipped row has an explicit reason.")
  lines.push("Records by industry:")
  for (const [industry, count] of industryCountEntries(index.entries)) {
    lines.push(`- ${industry}: ${count}`)
  }
  return lines.join("\n")
}

export function industryCounts(entries: readonly ResearchEntry[]): Record<string, number> {
  const counts: Record<string, number> = {}
  for (const entry of entries) {
    const industry = entry.industry || "none"
    counts[industry] = (counts[industry] ?? 0) + 1
  }
  return counts
}

function industryCountEntries(entries: readonly ResearchEntry[]): [string, number][] {
  return Object.entries(industryCounts(entries)).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
}

export function coverageBalances(coverage: readonly CoverageRow[]): boolean {
  if (coverage.length === 0) return false
  return coverage.every((row) => row.status === "indexed" || (row.status === "skipped" && Boolean(row.reason?.trim())))
}

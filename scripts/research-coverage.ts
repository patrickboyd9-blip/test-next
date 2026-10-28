import { formatCoverageReport } from "../lib/research-library/coverage"
import { fixtureResearchIndex } from "../lib/research-library/fixtures"
import { clearResearchIndexMemory, refreshResearchIndex } from "../lib/research-library"

/**
 * Prints how many private-library records are indexed.
 * Does not print file contents or tokens.
 * With RESEARCH_GITHUB_TOKEN set, pass --all to keep reading until the queue is empty.
 */
async function main(): Promise<void> {
  const all = process.argv.includes("--all")
  clearResearchIndexMemory()
  const index = await refreshResearchIndex({
    batchSize: all ? 200 : undefined,
    rounds: all ? 12 : 1,
  })
  console.log(formatCoverageReport(index))
  if (!process.env.RESEARCH_GITHUB_TOKEN?.trim() && index.entries.length === 0) {
    console.log("RESEARCH_GITHUB_TOKEN is not set, so the private repository was not read.")
    console.log("\nFixture stand-in (same parser, not the private library):")
    console.log(formatCoverageReport(fixtureResearchIndex()))
  }
  if (index.pending.length > 0) {
    console.log(`${index.pending.length} record(s) are still queued. Run again with --all to finish.`)
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})

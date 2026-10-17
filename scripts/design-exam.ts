import path from "node:path"

import { examUsesMachineEstimate, runExam } from "@/lib/design-intelligence/exam"

/**
 * Renders the ten-brief exam and writes a dated report plus images.
 *
 *   npx tsx scripts/design-exam.ts --mode baseline --out artifacts/design-exam/2026-10-17/before
 *   npx tsx scripts/design-exam.ts --mode after --out artifacts/design-exam/2026-10-17/after
 *
 * Without ANTHROPIC_API_KEY the scores are machine estimates.
 */

async function main() {
  const mode = readFlag("--mode") === "after" ? "after" : "baseline"
  const out = readFlag("--out") ?? path.join("artifacts", "design-exam", new Date().toISOString().slice(0, 10), mode === "after" ? "after" : "before")
  if (examUsesMachineEstimate(process.env)) {
    console.log("No vision key, or DESIGN_CRITIC=machine. Scores will be machine estimates.")
  }
  const report = await runExam({ mode, outDir: out, env: process.env })
  console.log(report.summary)
  console.log(out)
}

function readFlag(name: string): string | undefined {
  const index = process.argv.indexOf(name)
  if (index < 0) return undefined
  return process.argv[index + 1]
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})

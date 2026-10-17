import { mkdir } from "node:fs/promises"

import { runBenchmark } from "@/lib/design-intelligence/benchmark"

const out = process.argv[2] ?? "artifacts/design-benchmark"

async function main(): Promise<void> {
  await mkdir(out, { recursive: true })
  const report = await runBenchmark({
    outDir: out,
    env: process.env,
  })
  console.log(report.summary)
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})

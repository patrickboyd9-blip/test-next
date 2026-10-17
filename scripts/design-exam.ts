import { runDesignExam } from "@/lib/design-intelligence/exam"

const out = process.argv[2]
const label = process.argv[3] ?? "after"

async function main(): Promise<void> {
  const report = await runDesignExam({
    outDir: out,
    label,
    env: process.env,
  })
  console.log(report.note)
  console.log(`Panel average ${report.averagePanel}. Surfaced average ${report.averageSurfaced}.`)
  for (const row of report.rows) {
    console.log(`${row.id} panel ${row.panel.letter} ${row.panel.visionScore} surfaced ${row.surfaced.letter} ${row.surfaced.visionScore} ${row.surfaced.family}`)
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})

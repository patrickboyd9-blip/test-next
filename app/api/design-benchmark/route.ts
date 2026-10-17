import { NextResponse } from "next/server"

import { runBenchmark } from "@/lib/design-intelligence/benchmark"

export const maxDuration = 60

/** Scores the fixed briefs. Images stay on disk or in Blob. The response is the report, not the art. */
export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET?.trim()
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  try {
    const report = await runBenchmark({
      env: { ...process.env, DESIGN_CRITIC: process.env.DESIGN_CRITIC ?? "machine" },
    })
    return NextResponse.json({
      averageBefore: report.averageBefore,
      averageAfter: report.averageAfter,
      rows: report.rows,
      summary: report.summary,
    })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Benchmark failed." },
      { status: 500 }
    )
  }
}

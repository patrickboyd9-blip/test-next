import { NextResponse } from "next/server"

import { cronAuthorized, runDesignLibraryJob } from "@/lib/design-intelligence/sync-job"

export const maxDuration = 60

/** On-demand pull. Same secret as the daily cron. Also analyzes a vision-taste batch. */
export async function POST(request: Request) {
  if (!cronAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  const report = await runDesignLibraryJob(process.env)
  return NextResponse.json(report)
}

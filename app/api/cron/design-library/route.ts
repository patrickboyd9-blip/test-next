import { NextResponse } from "next/server"

import { cronAuthorized, runDesignLibraryJob } from "@/lib/design-intelligence/sync-job"

export const maxDuration = 60

/**
 * Daily pull of the private research libraries, then a batch of vision-taste
 * readings for new photographs.
 * 17:45 UTC is 9:45am Pacific Standard Time and 10:45am Pacific Daylight Time,
 * which is after 9:30am Pacific year round.
 */
export async function GET(request: Request) {
  if (!cronAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  const report = await runDesignLibraryJob(process.env)
  return NextResponse.json(report)
}

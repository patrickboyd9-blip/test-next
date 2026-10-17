import { NextResponse } from "next/server"

import { cronAuthorized } from "@/lib/design-intelligence/sync-job"
import { backfillVisionTaste } from "@/lib/design-intelligence/vision-taste"

export const maxDuration = 60

/**
 * Batched vision-taste backfill.
 * Authorization: Bearer CRON_SECRET.
 * Optional JSON body: { "limit": 4 }.
 */
export async function POST(request: Request) {
  if (!cronAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  let limit: number | undefined
  try {
    const body = await request.json() as { limit?: unknown }
    if (typeof body.limit === "number") limit = body.limit
  } catch {
    limit = undefined
  }
  const report = await backfillVisionTaste({ env: process.env, limit })
  return NextResponse.json(report)
}

import { NextResponse } from "next/server"

import { backfillBlueprints } from "@/lib/design-intelligence/blueprint-store"
import { cronAuthorized } from "@/lib/design-intelligence/sync-job"

export const maxDuration = 60

/**
 * Batched blueprint backfill.
 * Authorization: Bearer CRON_SECRET.
 * Structural blueprints are written for every eligible mailer.
 * Vision extraction runs for BLUEPRINT_BATCH photographs when ANTHROPIC_API_KEY is set.
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
  const report = await backfillBlueprints({ env: process.env, limit })
  return NextResponse.json(report)
}

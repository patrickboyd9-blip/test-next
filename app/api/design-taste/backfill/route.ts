import { NextResponse } from "next/server"

import { backfillDesignTaste } from "@/lib/design-intelligence/taste-backfill"

export const maxDuration = 60

/**
 * Batched vision readings for reference mailers that do not have one yet.
 * Same secret as the daily library sync. Call it again until remaining is 0.
 */
export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET?.trim()
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  const url = new URL(request.url)
  const requested = Number(url.searchParams.get("batch") ?? "")
  const report = await backfillDesignTaste({
    batch: Number.isFinite(requested) && requested > 0 ? requested : undefined,
    env: process.env,
  })
  return NextResponse.json(report)
}

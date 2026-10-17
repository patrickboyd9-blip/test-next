import { NextResponse } from "next/server"

import { analyzeNewMailer } from "@/lib/design-intelligence/model"
import { syncReferenceLibraries } from "@/lib/design-intelligence/sync"

export const maxDuration = 60

/** On-demand pull. Same secret as the daily cron. */
export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET?.trim()
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  const report = await syncReferenceLibraries({
    analyze: process.env.ANTHROPIC_API_KEY?.trim()
      ? async (entry, bytes) =>
          analyzeNewMailer({
            id: entry.id,
            bytes,
            mediaType: bytes[0] === 0x89 ? "image/png" : "image/jpeg",
            env: process.env,
          })
      : undefined,
  })
  return NextResponse.json(report)
}

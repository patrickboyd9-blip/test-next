import { NextResponse } from "next/server"

import { analyzeNewMailer } from "@/lib/design-intelligence/model"
import { syncReferenceLibraries } from "@/lib/design-intelligence/sync"

export const maxDuration = 60

/**
 * Daily pull of the private research libraries.
 * 17:45 UTC is 9:45am Pacific Standard Time and 10:45am Pacific Daylight Time,
 * which is after 9:30am Pacific year round.
 */
export async function GET(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  const report = await syncReferenceLibraries({
    analyze: process.env.ANTHROPIC_API_KEY?.trim()
      ? async (entry, bytes) => {
          const mediaType = bytes[0] === 0x89 ? "image/png" : "image/jpeg"
          return analyzeNewMailer({ id: entry.id, bytes, mediaType, env: process.env })
        }
      : undefined,
  })
  return NextResponse.json(report)
}

function authorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET?.trim()
  if (!secret) return false
  return request.headers.get("authorization") === `Bearer ${secret}`
}

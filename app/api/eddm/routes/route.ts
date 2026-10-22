import { NextResponse } from "next/server"

import { loadEddmRoutes } from "@/lib/eddm/usps"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  const query = new URL(request.url).searchParams.get("q")?.trim() ?? ""
  const result = await loadEddmRoutes({ query })
  return NextResponse.json(result)
}

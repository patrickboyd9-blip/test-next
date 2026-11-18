import { getSession } from "@/lib/auth/session"
import { listOwnedCampaigns } from "@/lib/campaign-creator/actions"
import { resultsCsv } from "@/lib/command-center/snapshot"

export const dynamic = "force-dynamic"

export async function GET() {
  const session = await getSession()
  if (!session) {
    return new Response("Sign in required.", { status: 401 })
  }
  const campaigns = await listOwnedCampaigns()
  const body = resultsCsv(campaigns, session.userId)
  return new Response(body, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": "attachment; filename=campaign-results.csv",
    },
  })
}

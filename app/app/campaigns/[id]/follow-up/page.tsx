import { notFound } from "next/navigation"

import { FollowUpReview } from "@/components/follow-up/FollowUpReview"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { requireOwnedCampaign } from "@/lib/auth/campaign-access"
import { getSession } from "@/lib/auth/session"
import { handoffBlockers, scheduleConfigured } from "@/lib/follow-up/proposal"
import { getFollowUpStore } from "@/lib/follow-up/store"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export default async function FollowUpPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ error?: string }>
}) {
  const session = await getSession()
  if (!session) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-semibold">Sign in required</h1>
        <p className="mt-2 text-sm text-muted-foreground">Follow-up proposals stay with the account that imported them.</p>
      </div>
    )
  }
  const { id } = await params
  const query = await searchParams
  let campaign
  try {
    campaign = await requireOwnedCampaign(id)
  } catch {
    notFound()
  }
  const proposal = await getFollowUpStore().latest(session.userId, id)
  const handoff = proposal
    ? handoffBlockers({
        proposal,
        trade: campaign.jobCreative?.trade ?? "unknown",
        offer: campaign.brief.offer ?? "",
        job: campaign.jobCreative ?? null,
        guidanceVersion: campaign.strategyGuidance?.sourceVersion ?? null,
        scheduleConfigured: scheduleConfigured(),
      })
    : null
  return (
    <div className="flex min-h-svh flex-col">
      <header className="flex h-14 items-center gap-2 border-b px-4">
        <SidebarTrigger />
        <span className="text-sm text-muted-foreground">Follow-up</span>
      </header>
      <FollowUpReview campaignId={id} proposal={proposal} handoff={handoff} notice={query.error ?? ""} />
    </div>
  )
}

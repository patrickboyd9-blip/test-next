import { notFound } from "next/navigation"

import { GuidancePanel } from "@/components/strategy/GuidancePanel"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { requireOwnedCampaign } from "@/lib/auth/campaign-access"
import { getSession } from "@/lib/auth/session"
import { advise, customerFacts } from "@/lib/strategy/advise"
import { readLibraryFiles } from "@/lib/strategy/library"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export default async function GuidancePage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getSession()
  if (!session) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-semibold">Sign in required</h1>
        <p className="mt-2 text-sm text-muted-foreground">Guidance stays with the account that owns the campaign.</p>
      </div>
    )
  }
  const { id } = await params
  let campaign
  try {
    campaign = await requireOwnedCampaign(id)
  } catch {
    notFound()
  }
  const live = advise({
    facts: customerFacts({
      businessName: campaign.brief.businessInfo?.name,
      offer: campaign.brief.offer,
      phone: campaign.brief.phone ?? campaign.brief.businessInfo?.phone,
      serviceAction: campaign.jobCreative?.serviceAction,
      trade: campaign.jobCreative?.trade,
    }),
    goal: campaign.brief.goal,
    files: readLibraryFiles(),
  })
  return (
    <div className="flex min-h-svh flex-col">
      <header className="flex h-14 items-center gap-2 border-b px-4">
        <SidebarTrigger />
        <span className="text-sm text-muted-foreground">Guidance</span>
      </header>
      <GuidancePanel campaignId={id} guidance={campaign.strategyGuidance ?? live} />
    </div>
  )
}

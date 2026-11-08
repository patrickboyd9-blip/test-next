import Link from "next/link"
import { notFound } from "next/navigation"

import { CampaignCreatorView } from "@/components/campaign-creator/CampaignCreatorView"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { isDesignReviewAvailable } from "@/lib/bring-your-own-design/design-review"
import { getCampaign } from "@/lib/campaign-creator/actions"
import { advise, customerFacts } from "@/lib/strategy/advise"
import { readLibraryFiles } from "@/lib/strategy/library"
import { POSTCARD_5X8_POSTAGE } from "@/lib/click2mail/cost"
import { describePrintMailMode } from "@/lib/click2mail/config"
import type { PrintMailMode } from "@/lib/click2mail/mode"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
/**
 * Hobby ceiling when Fluid Compute is off. A higher value fails that deploy
 * with "maxDuration must be between 1 and 60". Applies to Server Actions
 * used on this page (conversation, creative writing).
 * Photographs return immediately and finish in after(). Every preview that
 * is ready starts in that same invocation, still inside this 60s cap.
 * See docs/DEPLOYMENT.md.
 */
export const maxDuration = 60

function printMailMode(): PrintMailMode {
  try {
    return describePrintMailMode()
  } catch {
    return {
      environment: "stage",
      productionEnabled: false,
      credentialsConfigured: false,
      postage: POSTCARD_5X8_POSTAGE,
    }
  }
}

export default async function CampaignPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const campaign = await getCampaign(id)

  if (!campaign) {
    notFound()
  }

  return (
    <div className="flex min-h-svh flex-col">
      <header className="flex h-14 shrink-0 items-center gap-2 border-b px-4">
        <SidebarTrigger className="-ml-1" />
        <span className="text-sm font-medium text-muted-foreground">
          Campaign Creator
        </span>
        <Link href={`/app/campaigns/${id}/guidance`} className="text-sm text-muted-foreground underline">
          Guidance
        </Link>
        <Link href={`/app/campaigns/${id}/job-photos`} className="text-sm text-muted-foreground underline">
          Job photos
        </Link>
        <Link href={`/app/campaigns/${id}/follow-up`} className="text-sm text-muted-foreground underline">
          Follow-up
        </Link>
        <Link href={`/app/campaigns/${id}/history`} className="text-sm text-muted-foreground underline">
          History
        </Link>
        <Link href={`/app/campaigns/${id}/order`} className="text-sm text-muted-foreground underline">
          Review list and checkout
        </Link>
      </header>
      <p className="border-b px-4 py-3 text-sm text-muted-foreground">
        {campaign.strategyGuidance
          ? campaign.strategyGuidance.status === "limited"
            ? "Saved guidance is limited. It is not a research finding."
            : `Saved guidance: ${campaign.strategyGuidance.plans[0]?.id ?? "limited"}. Not a performance claim.`
          : advise({
              facts: customerFacts({
                businessName: campaign.brief.businessInfo?.name,
                offer: campaign.brief.offer,
                phone: campaign.brief.phone,
                serviceAction: campaign.jobCreative?.serviceAction,
                trade: campaign.jobCreative?.trade,
              }),
              goal: campaign.brief.goal,
              files: readLibraryFiles(),
            }).status === "limited"
            ? "Guidance for this trade is limited. No home-service plan was substituted."
            : "A sourced recommendation is ready. It is not a promise of more replies."}{" "}
        <Link href={`/app/campaigns/${id}/guidance`} className="underline">
          Review the evidence
        </Link>
      </p>
      <CampaignCreatorView
        initialCampaign={campaign}
        printMailMode={printMailMode()}
        designReviewAvailable={isDesignReviewAvailable()}
      />
    </div>
  )
}

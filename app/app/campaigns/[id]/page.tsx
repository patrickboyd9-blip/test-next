import { notFound } from "next/navigation"

import { CampaignCreatorView } from "@/components/campaign-creator/CampaignCreatorView"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { isDesignReviewAvailable } from "@/lib/bring-your-own-design/design-review"
import { getCampaign } from "@/lib/campaign-creator/actions"
import { markCheckoutCancelled } from "@/lib/checkout/actions"
import { checkoutAvailability } from "@/lib/checkout/stripe-config"
import { describePrintMailMode } from "@/lib/click2mail/config"
import { POSTCARD_5X8_POSTAGE } from "@/lib/click2mail/cost"
import type { PrintMailMode } from "@/lib/click2mail/mode"
import { REVIEW_MAIL_CLASS, REVIEW_PRODUCT_ID } from "@/lib/pricing/defaults"
import { customerRate, showPricingNotFinalBanner } from "@/lib/pricing/quote"
import { getPricingConfig } from "@/lib/pricing/store"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
/**
 * Hobby ceiling when Fluid Compute is off. A higher value fails that deploy
 * with "maxDuration must be between 1 and 60". Applies to Server Actions
 * used on this page (conversation, creative writing).
 * Photographs return immediately and finish in after(), one picture per
 * invocation, still inside this 60s cap. See docs/DEPLOYMENT.md.
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
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ checkout?: string }>
}) {
  const { id } = await params
  const query = await searchParams
  if (query.checkout === "cancelled") await markCheckoutCancelled(id)
  const campaign = await getCampaign(id)

  if (!campaign) {
    notFound()
  }

  const pricing = await getPricingConfig()
  const rate = customerRate(pricing, REVIEW_PRODUCT_ID, REVIEW_MAIL_CLASS)

  return (
    <div className="flex min-h-svh flex-col">
      <header className="flex h-14 shrink-0 items-center gap-2 border-b px-4">
        <SidebarTrigger className="-ml-1" />
        <span className="text-sm font-medium text-muted-foreground">
          Campaign Creator
        </span>
      </header>
      <CampaignCreatorView
        initialCampaign={campaign}
        printMailMode={printMailMode()}
        designReviewAvailable={isDesignReviewAvailable()}
        pricingRate={rate ?? undefined}
        showPricingBanner={showPricingNotFinalBanner(pricing)}
        checkout={checkoutAvailability()}
        checkoutNotice={
          query.checkout === "cancelled" ? "Payment was cancelled. Nothing was sent." : null
        }
      />
    </div>
  )
}

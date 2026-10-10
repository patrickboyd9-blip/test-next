import { notFound } from "next/navigation"

import { CampaignCreatorView } from "@/components/campaign-creator/CampaignCreatorView"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { getCampaign } from "@/lib/campaign-creator/actions"
import { describePrintMailMode } from "@/lib/click2mail/config"
import type { PrintMailMode } from "@/lib/click2mail/mode"

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
      </header>
      <CampaignCreatorView initialCampaign={campaign} printMailMode={printMailMode()} />
    </div>
  )
}

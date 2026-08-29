import { notFound } from "next/navigation"

import { CampaignCreatorView } from "@/components/campaign-creator/CampaignCreatorView"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { getCampaign } from "@/lib/campaign-creator/actions"

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
      <CampaignCreatorView initialCampaign={campaign} />
    </div>
  )
}

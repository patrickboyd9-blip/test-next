import Link from "next/link"

import { DuplicateCampaignButton } from "@/components/campaigns/DuplicateCampaignButton"
import { CockpitFrame, Eyebrow, Panel } from "@/components/cockpit/ui"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { listOwnedCampaigns } from "@/lib/campaign-creator/actions"

export const dynamic = "force-dynamic"

export default async function CampaignsPage() {
  const campaigns = await listOwnedCampaigns()
  return (
    <CockpitFrame>
      <div className="mx-auto flex max-w-3xl flex-col gap-5 px-4 py-8 sm:px-6">
        <div className="flex items-center gap-3">
          <SidebarTrigger className="text-[#e7f2fb]" />
          <Eyebrow>Campaigns</Eyebrow>
        </div>
        <h1 className="text-3xl font-semibold">Every campaign</h1>
        <p className="text-sm text-[#b7c9d8]">Status, results, a copy, and the proof. Nothing here is estimated.</p>
        {campaigns.length === 0 ? (
          <Panel className="p-5">
            <p>No campaigns on this account yet.</p>
            <Link href="/app/mail" className="mt-3 inline-flex min-h-11 items-center text-sm text-[#8ecfff] underline">
              New Mailer Campaign
            </Link>
          </Panel>
        ) : (
          <ul className="space-y-3">
            {campaigns.map((campaign) => {
              const name = campaign.name || campaign.brief.businessInfo?.name || "Untitled campaign"
              return (
                <li key={campaign.id}>
                  <Panel className="flex flex-col gap-3 p-4">
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <Link href={`/app/campaigns/${campaign.id}`} className="text-lg font-medium">
                        {name}
                      </Link>
                      <span className="text-sm text-[#b7c9d8]">{campaign.status.replaceAll("_", " ")}</span>
                    </div>
                    <div className="flex flex-wrap gap-4">
                      <Link href={`/app/campaigns/${campaign.id}/results`} className="min-h-11 text-sm text-[#8ecfff] underline">
                        Results
                      </Link>
                      <Link href={`/app/campaigns/${campaign.id}#editor`} className="min-h-11 text-sm text-[#8ecfff] underline">
                        Proof
                      </Link>
                      <DuplicateCampaignButton id={campaign.id} name={name} />
                    </div>
                  </Panel>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </CockpitFrame>
  )
}

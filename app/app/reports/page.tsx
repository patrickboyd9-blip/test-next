import Link from "next/link"

import { qrForCampaign, scansFor } from "@/lib/analytics/store"
import { CockpitFrame, Eyebrow, Panel } from "@/components/cockpit/ui"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { listOwnedCampaigns } from "@/lib/campaign-creator/actions"

export const dynamic = "force-dynamic"

export default async function ReportsPage() {
  const campaigns = await listOwnedCampaigns()
  return (
    <CockpitFrame>
      <div className="mx-auto flex max-w-3xl flex-col gap-5 px-4 py-8 sm:px-6">
        <div className="flex items-center gap-3">
          <SidebarTrigger className="text-[#e7f2fb]" />
          <Eyebrow>Reports</Eyebrow>
        </div>
        <h1 className="text-3xl font-semibold">Results across campaigns</h1>
        <p className="text-sm text-[#b7c9d8]">QR scans that were logged. Scans appear after your mail lands.</p>
        {campaigns.some((campaign) => qrForCampaign(campaign.id)?.destination === "website" || /^https:\/\//i.test(campaign.brief.qrDestination ?? "")) ? (
          <p className="text-sm text-[#b7c9d8]">
            Want to see calls and form leads too?{" "}
            <Link href={`/app/campaigns/${campaigns.find((campaign) => qrForCampaign(campaign.id)?.destination === "website" || /^https:\/\//i.test(campaign.brief.qrDestination ?? ""))?.id}/results`} className="underline">
              Switch to our free page.
            </Link>
          </p>
        ) : null}
        {campaigns.length === 0 ? (
          <Panel className="p-5 text-sm">No campaigns to report.</Panel>
        ) : (
          <ul className="divide-y divide-[#1c3d52] text-sm">
            {campaigns.map((campaign) => (
              <li key={campaign.id} className="flex min-h-14 items-center justify-between gap-3 py-2">
                <Link href={`/app/campaigns/${campaign.id}/results`} className="font-medium underline">
                  {campaign.name || "Campaign"}
                </Link>
                <span>{scansFor(campaign.id).length} scans</span>
              </li>
            ))}
          </ul>
        )}
        <Link href="/app/reports/export" className="inline-flex min-h-11 w-fit items-center rounded-xl bg-[#5ce1ff] px-4 text-sm font-semibold text-[#041018]">
          Download CSV
        </Link>
      </div>
    </CockpitFrame>
  )
}

import Link from "next/link"

import { CockpitFrame, Eyebrow, Panel } from "@/components/cockpit/ui"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { listOwnedCampaigns } from "@/lib/campaign-creator/actions"
import { getSession } from "@/lib/auth/session"
import { resultsFor } from "@/lib/tracking/ledger"

export const dynamic = "force-dynamic"

export default async function ReportsPage() {
  const session = await getSession()
  const campaigns = await listOwnedCampaigns()
  return (
    <CockpitFrame>
      <div className="mx-auto flex max-w-3xl flex-col gap-5 px-4 py-8 sm:px-6">
        <div className="flex items-center gap-3">
          <SidebarTrigger className="text-[#e7f2fb]" />
          <Eyebrow>Reports</Eyebrow>
        </div>
        <h1 className="text-3xl font-semibold">Results across campaigns</h1>
        <p className="text-sm text-[#b7c9d8]">Only recorded scans and numbers someone entered. Blank means not recorded.</p>
        {campaigns.length === 0 ? (
          <Panel className="p-5 text-sm">No campaigns to report.</Panel>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-[#8aa0b4]">
                <tr>
                  <th className="py-2 pr-3">Campaign</th>
                  <th className="py-2 pr-3">Scans</th>
                  <th className="py-2">Calls</th>
                </tr>
              </thead>
              <tbody>
                {campaigns.map((campaign) => {
                  const results = resultsFor(campaign.id, session?.userId)
                  return (
                    <tr key={campaign.id} className="border-t border-[#1c3d52]">
                      <td className="py-3 pr-3">{campaign.name || "Untitled campaign"}</td>
                      <td className="py-3 pr-3">{results.scans == null ? "Not recorded" : results.scans}</td>
                      <td className="py-3">{results.calls == null ? "Not recorded" : results.calls}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
        <Link href="/app/reports/export" className="inline-flex min-h-11 w-fit items-center rounded-xl bg-[#5ce1ff] px-4 text-sm font-semibold text-[#041018]">
          Download CSV
        </Link>
      </div>
    </CockpitFrame>
  )
}

import { CockpitFrame, Eyebrow, Panel } from "@/components/cockpit/ui"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { listOwnedCampaigns } from "@/lib/campaign-creator/actions"

export const dynamic = "force-dynamic"

export default async function ListsPage() {
  const campaigns = await listOwnedCampaigns()
  const lists = campaigns.flatMap((campaign) => {
    const description = campaign.brief.audience?.description?.trim()
    if (!description) return []
    return [{ id: campaign.id, name: campaign.name || "Untitled campaign", description, quantity: campaign.brief.audience?.quantity }]
  })
  return (
    <CockpitFrame>
      <div className="mx-auto flex max-w-3xl flex-col gap-5 px-4 py-8 sm:px-6">
        <div className="flex items-center gap-3">
          <SidebarTrigger className="text-[#e7f2fb]" />
          <Eyebrow>Lists</Eyebrow>
        </div>
        <h1 className="text-3xl font-semibold">Lists</h1>
        {lists.length === 0 ? (
          <Panel className="p-5 text-sm text-[#b7c9d8]">No lists on this account. A list appears here after a campaign names who it is for.</Panel>
        ) : (
          <ul className="space-y-3">
            {lists.map((list) => (
              <li key={list.id}>
                <Panel className="p-4">
                  <p className="font-medium">{list.name}</p>
                  <p className="text-sm text-[#b7c9d8]">{list.description}</p>
                  <p className="mt-1 text-sm text-[#8aa0b4]">{list.quantity ? `${list.quantity} people named` : "No count recorded"}</p>
                </Panel>
              </li>
            ))}
          </ul>
        )}
      </div>
    </CockpitFrame>
  )
}

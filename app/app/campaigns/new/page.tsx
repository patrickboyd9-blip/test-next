import { redirect } from "next/navigation"

import { createDraftCampaign } from "@/lib/campaign-creator/actions"

export const runtime = "nodejs"
/** Each visit creates a new campaign. A prerendered redirect would 404. */
export const dynamic = "force-dynamic"

export default async function NewCampaignPage() {
  const campaign = await createDraftCampaign()
  redirect(`/app/campaigns/${campaign.id}`)
}

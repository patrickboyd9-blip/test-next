import { redirect } from "next/navigation"

import { createDraftCampaign } from "@/lib/campaign-creator/actions"

export default async function NewCampaignPage() {
  const campaign = await createDraftCampaign()
  redirect(`/app/campaigns/${campaign.id}`)
}

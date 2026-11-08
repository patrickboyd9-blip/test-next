import { redirect } from "next/navigation"

import { createDraftCampaign } from "@/lib/campaign-creator/actions"
import { getSession } from "@/lib/auth/session"

export const runtime = "nodejs"
/** Each visit creates a new campaign. A prerendered redirect would 404. */
export const dynamic = "force-dynamic"

export default async function NewCampaignPage() {
  const session = await getSession()
  if (!session) {
    return (
      <div className="flex flex-1 flex-col gap-4 p-6 lg:p-8">
        <h1 className="text-2xl font-semibold tracking-tight">Sign in required</h1>
        <p className="max-w-xl text-sm text-muted-foreground">
          A campaign is not created until an account is signed in.
        </p>
      </div>
    )
  }
  const campaign = await createDraftCampaign()
  redirect(`/app/campaigns/${campaign.id}`)
}

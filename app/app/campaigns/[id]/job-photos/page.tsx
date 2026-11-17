import { notFound } from "next/navigation"

import { JobPhotoEditor } from "@/components/job-photos/JobPhotoEditor"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { requireOwnedCampaign } from "@/lib/auth/campaign-access"
import { getSession } from "@/lib/auth/session"
import type { JobCreative } from "@/lib/campaign-creator/types"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const EMPTY: JobCreative = {
  rightsConfirmedAt: null,
  trade: "unknown",
  serviceAction: "",
  photos: [],
  frontPhotoId: null,
  back: { treatment: "text", photoId: null },
}

export default async function JobPhotosPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ error?: string }>
}) {
  const session = await getSession()
  if (!session) {
    return (
      <div className="flex flex-1 flex-col gap-4 p-6">
        <h1 className="text-2xl font-semibold tracking-tight">Sign in required</h1>
        <p className="max-w-xl text-sm text-muted-foreground">Job photos stay with the account that uploaded them.</p>
      </div>
    )
  }
  const { id } = await params
  const query = await searchParams
  let campaign
  try {
    campaign = await requireOwnedCampaign(id)
  } catch {
    notFound()
  }
  return (
    <div className="flex min-h-svh flex-col">
      <header className="flex h-14 items-center gap-2 border-b px-4">
        <SidebarTrigger />
        <span className="text-sm text-muted-foreground">Job photos</span>
      </header>
      <JobPhotoEditor campaignId={id} initial={campaign.jobCreative ?? EMPTY} notice={query.error ?? ""} />
    </div>
  )
}

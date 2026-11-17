import Link from "next/link"
import { notFound } from "next/navigation"

import { SidebarTrigger } from "@/components/ui/sidebar"
import { getSession } from "@/lib/auth/session"
import { getCampaign } from "@/lib/campaign-creator/actions"
import { codesForCampaign, resultsFor } from "@/lib/tracking/ledger"
import { NOT_RECORDED, presentResults } from "@/lib/tracking/present"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export default async function ResultsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const campaign = await getCampaign(id)
  if (!campaign) notFound()
  const session = await getSession()
  const rows = presentResults(resultsFor(id, session?.userId))
  const codes = codesForCampaign(id, session?.userId)
  const phone = codes.find((code) => code.trackingPhone)?.trackingPhone ?? null

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 p-6">
      <header className="flex items-center gap-2">
        <SidebarTrigger />
        <h1 className="text-2xl font-semibold tracking-tight">Results</h1>
      </header>
      <p className="text-sm text-muted-foreground">
        Counts come from codes that were opened and from numbers someone entered. Nothing on this page is estimated.
      </p>
      <dl className="grid gap-3 sm:grid-cols-2">
        {rows.map((row) => (
          <div key={row.label} className="rounded-lg border px-4 py-3">
            <dt className="text-sm text-muted-foreground">{row.label}</dt>
            <dd className="mt-1 text-lg">{row.value}</dd>
          </div>
        ))}
      </dl>
      <p className="text-sm text-muted-foreground">
        {codes.length === 0
          ? "No codes have been issued for this campaign."
          : `${codes.length} ${codes.length === 1 ? "code is" : "codes are"} issued. Each one opens a redirect, then goes to the destination.`}
      </p>
      <p className="text-sm text-muted-foreground">
        Tracking number: {phone ?? NOT_RECORDED}. A number here is a design placeholder. No call is placed.
      </p>
      <Link href={`/app/campaigns/${id}`} className="text-sm underline">
        Back to the campaign
      </Link>
    </div>
  )
}

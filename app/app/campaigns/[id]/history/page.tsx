import { notFound } from "next/navigation"

import { SidebarTrigger } from "@/components/ui/sidebar"
import { getSession } from "@/lib/auth/session"
import { getCampaignRepository } from "@/lib/campaign-creator/repository"
import { getLedgerStore, paidAmount } from "@/lib/ledger/event"
import { historyForCampaign, outcomeLabel } from "@/lib/ledger/note"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export default async function HistoryPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getSession()
  if (!session) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-semibold">Sign in required</h1>
        <p className="mt-2 text-sm text-muted-foreground">Campaign history stays with the account that owns it.</p>
      </div>
    )
  }
  const { id } = await params
  let history
  try {
    history = await historyForCampaign(id, getCampaignRepository(), getLedgerStore())
  } catch {
    notFound()
  }
  const amount = paidAmount(history.events)
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 p-6">
      <header className="flex items-center gap-2">
        <SidebarTrigger />
        <h1 className="text-2xl font-semibold tracking-tight">What happened</h1>
      </header>
      <p className="text-sm text-muted-foreground">
        Only steps this server finished are listed. Nothing here is a response rate, a call count, or a return.
      </p>
      <p className="text-sm">
        Amount paid: {amount == null ? "Unknown. No confirmed charge is on record." : `$${(amount / 100).toFixed(2)}`}
      </p>
      {history.events.length === 0 ? (
        <p className="text-sm">No recorded events. Nothing is shown as sent, paid, or responded.</p>
      ) : (
        <ul className="flex flex-col gap-3 text-sm">
          {history.events.map((event) => (
            <li key={event.id} className="rounded-md border p-3">
              <p className="font-medium">{event.type.replaceAll("_", " ")} · {outcomeLabel(event.outcome)}</p>
              <p>{event.note}</p>
              <p className="text-muted-foreground">{event.occurredAt}</p>
              {event.creativeVersion ? <p>Creative version {event.creativeVersion}</p> : null}
              {event.listCount != null ? <p>{event.listCount} addresses in the saved list hash.</p> : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

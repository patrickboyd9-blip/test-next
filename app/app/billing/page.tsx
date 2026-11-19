import { CockpitFrame, Eyebrow, Panel } from "@/components/cockpit/ui"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { getSession } from "@/lib/auth/session"
import { readAudit } from "@/lib/ops/audit"

export const dynamic = "force-dynamic"

export default async function BillingPage() {
  const session = await getSession()
  const events = session ? await readAudit().catch(() => []) : []
  const mine = events.filter((event) => session && event.actorId === session.userId && (event.action === "approve" || event.action === "charge"))
  const receipts = mine.filter((event) => event.action === "charge" && charged(event.after))
  return (
    <CockpitFrame>
      <div className="mx-auto flex max-w-3xl flex-col gap-5 px-4 py-8 sm:px-6">
        <div className="flex items-center gap-3">
          <SidebarTrigger className="text-[#e7f2fb]" />
          <Eyebrow>Billing</Eyebrow>
        </div>
        <h1 className="text-3xl font-semibold">Billing</h1>
        <Panel className="p-5">
          <h2 className="font-medium">Payment method</h2>
          <p className="mt-2 text-sm text-[#b7c9d8]">No card is saved on this account. A charge still waits for approval inside the campaign.</p>
        </Panel>
        <Panel className="p-5">
          <h2 className="font-medium">Receipts</h2>
          {receipts.length === 0 ? (
            <p className="mt-2 text-sm text-[#b7c9d8]">No receipts. Nothing has been marked paid.</p>
          ) : (
            <ul className="mt-2 space-y-2 text-sm">
              {receipts.map((event) => (
                <li key={event.id}>
                  {event.at} · {dollars(event.after)} · {event.subjectId}
                </li>
              ))}
            </ul>
          )}
        </Panel>
        <Panel className="p-5">
          <h2 className="font-medium">Approval and charge history</h2>
          {mine.length === 0 ? (
            <p className="mt-2 text-sm text-[#b7c9d8]">No approvals or charge attempts are recorded for this account.</p>
          ) : (
            <ul className="mt-2 space-y-2 text-sm">
              {mine.map((event) => (
                <li key={event.id}>
                  {event.at} · {event.action} · {event.subjectId}
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </CockpitFrame>
  )
}

function charged(after: unknown): boolean {
  return Boolean(after && typeof after === "object" && (after as { charged?: unknown }).charged === true)
}

function dollars(after: unknown): string {
  const cents = after && typeof after === "object" ? (after as { amountCents?: unknown }).amountCents : null
  return typeof cents === "number" ? `$${(cents / 100).toFixed(2)}` : "Amount not recorded"
}

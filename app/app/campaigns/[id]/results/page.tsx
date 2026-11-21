import Link from "next/link"
import { headers } from "next/headers"
import { notFound, redirect } from "next/navigation"

import { ScanChoice } from "@/components/analytics/ScanChoice"
import { matchback, streetsFromCsv } from "@/lib/analytics/match"
import { outcomeFigures } from "@/lib/analytics/money"
import {
  checkInFor,
  ensureCampaignQr,
  followUpLeads,
  leadsFor,
  mailedAddresses,
  matchSentence,
  qrForCampaign,
  rememberMatch,
  saveCheckIn,
  saveMailedAddresses,
  scansFor,
  tapsFor,
} from "@/lib/analytics/store"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { getCampaign } from "@/lib/campaign-creator/actions"
import { readAudit } from "@/lib/ops/audit"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export default async function ResultsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const campaign = await getCampaign(id)
  if (!campaign) notFound()
  const headerList = await headers()
  const host = headerList.get("x-forwarded-host") ?? headerList.get("host") ?? ""
  const proto = headerList.get("x-forwarded-proto") ?? "http"
  const origin = host ? `${proto}://${host}` : ""
  const phone = campaign.brief.phone || campaign.brief.businessInfo?.phone || ""
  const headline = campaign.name || campaign.brief.businessInfo?.name || ""
  const offer = campaign.brief.offer || campaign.brief.goal || ""
  const existing = qrForCampaign(id)
  const qr = existing ?? ensureCampaignQr({
    campaignId: id,
    ownerId: campaign.ownerId,
    destination: "hosted",
    phone,
    headline,
    offer,
  })
  const scans = scansFor(id)
  const leads = leadsFor(id)
  const followUps = followUpLeads(id)
  const charges = (await readAudit().catch(() => [])).filter((event) => {
    if (event.action !== "charge" || event.subjectId !== id) return false
    const after = event.after as { charged?: boolean; amountCents?: number } | null
    return after?.charged === true && typeof after.amountCents === "number"
  })
  const chargeCents = charges.reduce((sum, event) => sum + ((event.after as { amountCents: number }).amountCents ?? 0), 0)
  const check = checkInFor(id)
  const figures = outcomeFigures({
    chargeCents: charges.length > 0 ? chargeCents : null,
    leads: leads.length,
    jobs: check?.jobs ?? null,
    revenueCents: check?.revenueCents ?? null,
  })
  const mailed = mailedAddresses(id)
  const matched = matchSentence(id)

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-8 p-6">
      <header className="flex items-center gap-2">
        <SidebarTrigger />
        <h1 className="text-2xl font-semibold tracking-tight">Results</h1>
      </header>
      <p className="text-sm text-muted-foreground">
        {scans.length} QR scans.
        {qr.parts.call ? ` ${tapsFor(id, "call")} call taps.` : ""}
        {qr.parts.form ? ` ${leads.length} form leads.` : ""}
        {qr.parts.booking ? ` ${tapsFor(id, "booking")} booking button taps. A tap is not a booked time.` : ""}
        {" "}Scans appear after your mail lands.
      </p>

      <section className="flex flex-col gap-3">
        <h2 className="text-base font-medium">When someone scans your QR code</h2>
        <p className="text-sm text-muted-foreground">
          The code on the postcard is {origin ? `${origin}/q/${qr.code}` : `/q/${qr.code}`}.
        </p>
        <form action={saveDestination} className="flex flex-col gap-3">
          <input type="hidden" name="campaignId" value={id} />
          <ScanChoice
            choice={qr.destination === "website" ? "website" : "page"}
            website={qr.website ?? ""}
            campaignId={id}
            parts={qr.parts}
            phone={qr.phone}
          />
          <button type="submit" className="min-h-11 w-fit rounded-xl bg-neutral-950 px-4 text-sm font-semibold text-white">
            Save
          </button>
        </form>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-base font-medium">Upload new customers</h2>
        <p className="text-sm text-muted-foreground">
          {mailed.length === 0
            ? "Save the mailed addresses first. Matchback compares new customers with that list."
            : `${mailed.length} mailed addresses are saved.`}
        </p>
        <form action={saveMailed} className="flex flex-col gap-2 text-sm">
          <input type="hidden" name="campaignId" value={id} />
          <label>
            Mailed addresses, one street per line or a CSV
            <textarea name="csv" rows={4} className="mt-1 w-full rounded-xl border px-3 py-2" />
          </label>
          <button type="submit" className="min-h-11 w-fit rounded-xl border px-4">Save mailed list</button>
        </form>
        <form action={runMatch} className="flex flex-col gap-2 text-sm">
          <input type="hidden" name="campaignId" value={id} />
          <label>
            New customers
            <textarea name="csv" rows={4} className="mt-1 w-full rounded-xl border px-3 py-2" />
          </label>
          <button type="submit" className="min-h-11 w-fit rounded-xl border px-4">Upload new customers</button>
        </form>
        {matched ? <p className="text-sm">{matched}</p> : null}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-base font-medium">Jobs and revenue</h2>
        <p className="text-sm text-muted-foreground">Optional. Cost uses a recorded charge, not an estimate.</p>
        <form action={saveOutcome} className="flex flex-wrap gap-3 text-sm">
          <input type="hidden" name="campaignId" value={id} />
          <label>
            Jobs won
            <input name="jobs" inputMode="numeric" defaultValue={check?.jobs ?? ""} className="mt-1 block min-h-11 w-28 rounded-xl border px-3" />
          </label>
          <label>
            Revenue in dollars
            <input name="revenue" inputMode="decimal" defaultValue={check ? (check.revenueCents / 100).toFixed(2) : ""} className="mt-1 block min-h-11 w-32 rounded-xl border px-3" />
          </label>
          <button type="submit" className="min-h-11 self-end rounded-xl border px-4">Save</button>
        </form>
        <ul className="text-sm text-muted-foreground">
          <li>{figures.costPerLead ? `Cost per lead ${figures.costPerLead}` : "Cost per lead appears after a charge and a lead are both recorded."}</li>
          <li>{figures.costPerJob ? `Cost per job ${figures.costPerJob}` : "Cost per job appears after a charge and a job are both recorded."}</li>
          <li>{figures.returnOnSpend ? `Return on spend ${figures.returnOnSpend}` : "Return on spend appears after a charge and revenue are both recorded."}</li>
        </ul>
      </section>

      {leads.length > 0 ? (
        <section>
          <h2 className="text-base font-medium">People to contact</h2>
          <p className="mt-1 text-sm text-muted-foreground">People who opted out are left off this list.</p>
          {followUps.length === 0 ? (
            <p className="mt-2 text-sm">No one to contact.</p>
          ) : (
            <ul className="mt-2 space-y-2 text-sm">
              {followUps.map((lead) => (
                <li key={lead.id}>{lead.name}{lead.phone ? ` · ${lead.phone}` : ""}{lead.message ? ` · ${lead.message}` : ""}</li>
              ))}
            </ul>
          )}
        </section>
      ) : null}

      <Link href={`/app/campaigns/${id}`} className="text-sm underline">
        Back to the campaign
      </Link>
    </div>
  )
}

async function saveDestination(form: FormData) {
  "use server"
  const id = String(form.get("campaignId") ?? "")
  const campaign = await getCampaign(id)
  if (!campaign) return
  ensureCampaignQr({
    campaignId: id,
    ownerId: campaign.ownerId,
    destination: form.get("destination") === "website" ? "website" : "hosted",
    website: String(form.get("website") ?? ""),
    phone: String(form.get("phone") ?? "") || campaign.brief.phone || campaign.brief.businessInfo?.phone || "",
    headline: campaign.name || campaign.brief.businessInfo?.name || "",
    offer: campaign.brief.offer || campaign.brief.goal || "",
    parts: {
      call: form.get("showCall") === "1",
      form: form.get("showForm") === "1",
      booking: form.get("showBooking") === "1",
      bookingUrl: String(form.get("bookingUrl") ?? ""),
    },
  })
  redirect(`/app/campaigns/${id}/results`)
}

async function saveMailed(form: FormData) {
  "use server"
  const id = String(form.get("campaignId") ?? "")
  if (!(await getCampaign(id))) return
  saveMailedAddresses(id, streetsFromCsv(String(form.get("csv") ?? "")))
  redirect(`/app/campaigns/${id}/results`)
}

async function runMatch(form: FormData) {
  "use server"
  const id = String(form.get("campaignId") ?? "")
  if (!(await getCampaign(id))) return
  const result = matchback(mailedAddresses(id), streetsFromCsv(String(form.get("csv") ?? "")))
  rememberMatch(id, result.sentence)
  redirect(`/app/campaigns/${id}/results`)
}

async function saveOutcome(form: FormData) {
  "use server"
  const id = String(form.get("campaignId") ?? "")
  if (!(await getCampaign(id))) return
  const jobs = Number(form.get("jobs") ?? 0)
  const revenue = Number(form.get("revenue") ?? 0)
  saveCheckIn(id, Number.isFinite(jobs) ? jobs : 0, Number.isFinite(revenue) ? Math.round(revenue * 100) : 0)
  redirect(`/app/campaigns/${id}/results`)
}

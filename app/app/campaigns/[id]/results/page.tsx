import Link from "next/link"
import { headers } from "next/headers"
import { notFound, redirect } from "next/navigation"

import { matchback, streetsFromCsv } from "@/lib/analytics/match"
import { outcomeFigures } from "@/lib/analytics/money"
import {
  checkInFor,
  ensureCampaignQr,
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
        {scans.length} QR scans. {tapsFor(id)} taps to call. {leads.length} form leads. Scans appear after your mail lands.
      </p>

      <section className="flex flex-col gap-3">
        <h2 className="text-base font-medium">Where the QR goes</h2>
        <p className="text-sm text-muted-foreground">
          The recommended page is hosted here. Either choice is logged, then the person continues. One code is printed for the campaign.
        </p>
        <p className="text-sm">Short link: {origin ? `${origin}/q/${qr.code}` : `/q/${qr.code}`}</p>
        <form action={saveDestination} className="flex flex-col gap-3 text-sm">
          <input type="hidden" name="campaignId" value={id} />
          <label className="flex items-center gap-2">
            <input type="radio" name="destination" value="hosted" defaultChecked={qr.destination !== "website"} />
            Our page (recommended)
          </label>
          <label className="flex items-center gap-2">
            <input type="radio" name="destination" value="website" defaultChecked={qr.destination === "website"} />
            The business website
          </label>
          <input
            name="website"
            defaultValue={qr.website ?? campaign.brief.website ?? campaign.brief.businessInfo?.website ?? ""}
            placeholder="https://example.com/offer"
            className="min-h-11 rounded-xl border px-3"
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
          <h2 className="text-base font-medium">Leads</h2>
          <ul className="mt-2 space-y-2 text-sm">
            {leads.map((lead) => (
              <li key={lead.id}>{lead.name}{lead.phone ? ` · ${lead.phone}` : ""}{lead.message ? ` · ${lead.message}` : ""}</li>
            ))}
          </ul>
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
    phone: campaign.brief.phone || campaign.brief.businessInfo?.phone || "",
    headline: campaign.name || campaign.brief.businessInfo?.name || "",
    offer: campaign.brief.offer || campaign.brief.goal || "",
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

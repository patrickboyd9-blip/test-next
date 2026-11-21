import { notFound } from "next/navigation"

import { findQr, leadsFor, saveLead } from "@/lib/analytics/store"

export const dynamic = "force-dynamic"

export default async function HostedLandingPage({
  params,
  searchParams,
}: {
  params: Promise<{ code: string }>
  searchParams: Promise<{ sent?: string; tap?: string }>
}) {
  const { code } = await params
  const query = await searchParams
  const qr = findQr(code)
  if (!qr) notFound()
  const leads = leadsFor(qr.campaignId)

  return (
    <main className="mx-auto flex min-h-svh w-full max-w-lg flex-col gap-6 px-4 py-10">
      <p className="text-xs uppercase tracking-[0.16em] text-neutral-500">Offer</p>
      <h1 className="text-3xl font-semibold tracking-tight">{qr.headline || "A note from the business"}</h1>
      {qr.offer ? <p className="text-base leading-7">{qr.offer}</p> : null}
      {qr.phone ? (
        <a href={`/p/${qr.code}/call`} className="inline-flex min-h-12 w-full items-center justify-center rounded-xl bg-neutral-950 px-4 text-sm font-semibold text-white">
          Tap to call {qr.phone}
        </a>
      ) : (
        <p className="text-sm text-neutral-600">A phone number has not been added, so there is no call button.</p>
      )}
      {query.tap === "1" ? <p className="text-sm">The call button was counted. Your phone app should open next.</p> : null}
      <form action={leadAction} className="flex flex-col gap-3">
        <input type="hidden" name="code" value={qr.code} />
        <label className="text-sm">
          Name
          <input name="name" required className="mt-1 min-h-11 w-full rounded-xl border px-3" />
        </label>
        <label className="text-sm">
          Phone
          <input name="phone" className="mt-1 min-h-11 w-full rounded-xl border px-3" />
        </label>
        <label className="text-sm">
          Email
          <input name="email" type="email" className="mt-1 min-h-11 w-full rounded-xl border px-3" />
        </label>
        <label className="text-sm">
          Message
          <textarea name="message" rows={3} className="mt-1 w-full rounded-xl border px-3 py-2" />
        </label>
        <button type="submit" className="min-h-11 rounded-xl border px-4 text-sm font-semibold">
          Send
        </button>
      </form>
      {query.sent === "1" ? <p className="text-sm">Saved. The business can read this in the campaign.</p> : null}
      <p className="text-xs text-neutral-500">{leads.length === 0 ? "No notes yet." : `${leads.length} note${leads.length === 1 ? "" : "s"} saved.`}</p>
    </main>
  )
}

async function leadAction(form: FormData) {
  "use server"
  const { redirect } = await import("next/navigation")
  const code = String(form.get("code") ?? "")
  const qr = findQr(code)
  if (!qr) return
  saveLead({
    campaignId: qr.campaignId,
    name: String(form.get("name") ?? ""),
    phone: String(form.get("phone") ?? ""),
    email: String(form.get("email") ?? ""),
    message: String(form.get("message") ?? ""),
  })
  redirect(`/p/${code}?sent=1`)
}

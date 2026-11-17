import type { MailerProof } from "@/lib/mailer-compose/flow"

/** Neutral tray so the card colors are not tinted by the cockpit. */
export function ProofTray({ proof }: { proof: MailerProof }) {
  return (
    <div className="rounded-2xl bg-[#e6e2d8] p-4 text-[#1a1c1f] sm:p-6">
      <p className="mb-3 font-mono text-[11px] uppercase tracking-[0.18em] text-[#5c564c]">Proof · sample layout</p>
      <div className="grid gap-4 lg:grid-cols-2">
        <article className="flex min-h-56 flex-col justify-between overflow-hidden rounded-xl bg-[#12243f] p-5 text-white shadow-md">
          <div>
            <p className="text-sm font-medium text-white/80">{proof.shop}</p>
            {proof.logoName ? (
              <p className="mt-1 text-xs text-[#f0b429]">Logo · {proof.logoName}</p>
            ) : null}
          </div>
          <p className="my-4 text-2xl font-semibold leading-tight tracking-tight sm:text-3xl">{proof.line}</p>
          <p className="text-sm text-white/80">{proof.phone || "No phone on the card yet"}</p>
        </article>
        <article className="flex min-h-56 flex-col justify-between rounded-xl border border-[#d5d0c6] bg-[#f7f4ee] p-5 shadow-md">
          <div>
            <p className="text-sm font-medium">{proof.shop}</p>
            <p className="mt-3 text-lg font-semibold leading-snug">{proof.line}</p>
          </div>
          <div className="mt-6 flex items-end justify-between gap-3">
            <p className="text-xs leading-relaxed text-[#5c564c]">
              Mailing address stays blank here.
              <br />
              {proof.people} {proof.people === 1 ? "person" : "people"} · {proof.to}
            </p>
            {proof.qr ? (
              <div className="grid size-16 shrink-0 place-items-center rounded-md border border-[#1a1c1f] bg-white text-[10px] font-medium">
                Code
              </div>
            ) : (
              <p className="max-w-32 text-right text-xs text-[#5c564c]">No code. Add a web address only if you want one.</p>
            )}
          </div>
        </article>
      </div>
    </div>
  )
}

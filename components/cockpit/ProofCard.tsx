import type { ReactNode } from "react"

import { QrFaceOverlay } from "@/components/qr-placement/QrFaceOverlay"
import type { MailerProof } from "@/lib/mailer-compose/flow"
import type { Click2MailSize } from "@/lib/print-spec/click2mail-keep-outs"
import type { PlacedQr } from "@/lib/qr-placement/model"
import { applyBrand, type AppliedBrand } from "@/lib/white-label/brand"

import { ProofReveal } from "./ProofReveal"

export interface ProofQr {
  size: Click2MailSize
  enabled: boolean
  codes: readonly PlacedQr[]
  onMove: (id: string, xInches: number, yInches: number) => void
}

/** Neutral tray so the card colors are not tinted by the cockpit. */
export function ProofTray({
  proof,
  brand = applyBrand(null),
  qr,
}: {
  proof: MailerProof
  brand?: AppliedBrand
  /** When set, the card stays still so a code can be dragged. */
  qr?: ProofQr
}) {
  return (
    <div className="rounded-2xl bg-[#e6e2d8] p-4 text-[#1a1c1f] sm:p-6" data-qr-postcard={qr ? "" : undefined}>
      <p className="mb-3 font-mono text-[11px] uppercase tracking-[0.18em] text-[#5c564c]">Proof · sample layout</p>
      {qr ? (
        <div className="space-y-4">
          <FaceFrame label="Front" size={qr.size}>
            <FrontFace proof={proof} brand={brand} />
            {qr.enabled ? (
              <QrFaceOverlay size={qr.size} side="front" frame="trim" codes={qr.codes} onMove={qr.onMove} />
            ) : null}
          </FaceFrame>
          <FaceFrame label="Back" size={qr.size}>
            <BackFace proof={proof} sampleCode={!qr.enabled} />
            {qr.enabled ? (
              <QrFaceOverlay size={qr.size} side="back" frame="trim" codes={qr.codes} onMove={qr.onMove} />
            ) : null}
          </FaceFrame>
        </div>
      ) : (
        <ProofReveal front={<FrontFace proof={proof} brand={brand} />} back={<BackFace proof={proof} sampleCode />} />
      )}
      {brand.poweredBy ? <p className="mt-3 text-xs text-[#5c564c]">{brand.poweredBy}</p> : null}
      {brand.supportEmail ? (
        <p className="mt-1 text-xs text-[#5c564c]">
          {brand.supportName || "Support"} · {brand.supportEmail}
        </p>
      ) : null}
    </div>
  )
}

function FaceFrame({ label, size, children }: { label: string; size: Click2MailSize; children: ReactNode }) {
  return (
    <figure className="space-y-2">
      <figcaption className="text-xs font-medium text-[#5c564c]">{label}</figcaption>
      <div className="relative overflow-hidden rounded-lg" style={{ aspectRatio: size === "6x9" ? "3 / 2" : "8 / 5" }}>
        {children}
      </div>
    </figure>
  )
}

function FrontFace({ proof, brand }: { proof: MailerProof; brand: AppliedBrand }) {
  return (
    <article className="flex h-full min-h-56 flex-col justify-between bg-[#12243f] p-5 text-white">
      <div>
        <p className="text-sm font-medium" style={{ color: brand.accent }}>{proof.shop}</p>
        {proof.logoName ? <p className="mt-1 text-xs text-[#f0b429]">Logo · {proof.logoName}</p> : null}
      </div>
      <p className="my-4 text-2xl font-semibold leading-tight tracking-tight sm:text-3xl">{proof.line}</p>
      <p className="text-sm text-white/80">{proof.phone || "No phone on the card yet"}</p>
    </article>
  )
}

function BackFace({ proof, sampleCode }: { proof: MailerProof; sampleCode: boolean }) {
  return (
    <article className="flex h-full min-h-56 flex-col justify-between bg-[#f7f4ee] p-5 text-[#1a1c1f]">
      <div>
        <p className="text-sm font-medium">{proof.shop}</p>
        <p className="mt-3 text-lg font-semibold leading-snug">{proof.line}</p>
      </div>
      <div className="mt-6 flex items-end justify-between gap-3">
        <p className="text-xs leading-relaxed text-[#5c564c]">
          Mailing address stays blank here.
          <br />
          {proof.people > 0 ? `${proof.people} ${proof.people === 1 ? "person" : "people"} · ` : ""}
          {proof.to}
        </p>
        {sampleCode && proof.qr ? (
          <div className="grid size-16 shrink-0 place-items-center rounded-md border border-[#1a1c1f] bg-white text-[10px] font-medium">
            Code
          </div>
        ) : sampleCode ? (
          <p className="max-w-32 text-right text-xs text-[#5c564c]">No code. Add a web address only if you want one.</p>
        ) : null}
      </div>
    </article>
  )
}

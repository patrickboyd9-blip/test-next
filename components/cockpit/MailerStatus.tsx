"use client"

import { useEffect, useState } from "react"
import Link from "next/link"

import {
  SAMPLE_SHOP,
  STATUS_LABEL,
  statusNeedsYou,
  type InFlightMailer,
  type MailerProof,
  type MailerStatus as MailerStatusName,
} from "@/lib/mailer-compose/flow"

import { ProofTray } from "./ProofCard"
import { MailFlight } from "./sky"
import { CockpitFrame, Eyebrow, Panel } from "./ui"

export function MailerStatus({
  mailer,
  proof,
  framed = true,
}: {
  mailer: InFlightMailer
  proof: MailerProof | null
  framed?: boolean
}) {
  const needs = statusNeedsYou(mailer.status)
  const Title = framed ? "h1" : "h2"
  const body = (
      <div className={framed ? "mx-auto flex max-w-3xl flex-col gap-5 px-4 py-6 sm:px-6 sm:py-8" : "flex flex-col gap-5"}>
        <Link href="/app" className="text-sm text-[#8ecfff]">
          Home
        </Link>
        <div className="space-y-2">
          <Eyebrow>Mailer</Eyebrow>
          <Title className="text-3xl font-semibold tracking-tight">{mailer.name}</Title>
          <p className="text-[#b7c9d8]">
            {mailer.listName} · {mailer.people} people
          </p>
        </div>
        <Panel className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <Eyebrow>Status</Eyebrow>
            <p className="mt-2 text-3xl font-semibold">{needs ? "Proof ready — approve" : STATUS_LABEL[mailer.status]}</p>
            <p className="mt-2 text-sm leading-relaxed text-[#b7c9d8]">{mailer.detail}</p>
          </div>
          {needs ? (
            <Link
              href="/app/mail"
              className="inline-flex min-h-12 items-center justify-center rounded-xl bg-[#f0a202] px-4 text-base font-semibold text-[#1a1203]"
            >
              Review proof
            </Link>
          ) : null}
        </Panel>
        {proof ? <ProofTray proof={{ ...proof, shop: proof.shop || SAMPLE_SHOP }} /> : null}
        <p className="text-sm text-[#8aa0b4]">Sample status. No live mail tracking is connected.</p>
      </div>
  )
  return framed ? <CockpitFrame>{body}</CockpitFrame> : body
}

export function PreviewStatus({ id }: { id: string }) {
  const [mailer, setMailer] = useState<InFlightMailer | null>(null)
  const [proof, setProof] = useState<MailerProof | null>(null)
  const [missing, setMissing] = useState(false)

  useEffect(() => {
    const raw = sessionStorage.getItem(`mailer-preview:${id}`)
    if (!raw) {
      setMissing(true)
      return
    }
    let saved: {
      name: string
      listName: string
      people: number
      status: MailerStatusName
      detail: string
      line: string
      shop: string
      phone: string
      qr: string | null
    }
    try {
      saved = JSON.parse(raw) as typeof saved
    } catch {
      setMissing(true)
      return
    }
    setMailer({
      id,
      name: saved.name || "New mailer",
      listName: saved.listName,
      people: saved.people,
      status: saved.status,
      detail: saved.detail,
    })
    setProof({
      shop: saved.shop,
      line: saved.line,
      to: saved.listName,
      people: saved.people,
      phone: saved.phone,
      website: saved.qr ?? "",
      logoName: null,
      qr: saved.qr,
    })
  }, [id])

  if (missing) {
    return (
      <CockpitFrame>
        <div className="mx-auto max-w-xl px-4 py-16">
          <h1 className="text-2xl font-semibold">That mailer isn’t on this screen.</h1>
          <Link href="/app" className="mt-4 inline-flex min-h-12 items-center text-[#8ecfff]">
            Back home
          </Link>
        </div>
      </CockpitFrame>
    )
  }
  if (!mailer) return <CockpitFrame><p className="px-6 py-10 text-[#b7c9d8]">Loading the preview…</p></CockpitFrame>
  return (
    <CockpitFrame>
      <div className="mx-auto flex max-w-3xl flex-col gap-5 px-4 py-6 sm:px-6 sm:py-8">
        <div className="space-y-3 text-center">
          <MailFlight mode="arrive" />
          <h1 className="mm-caption text-3xl font-semibold tracking-tight">Your mail is on its way</h1>
          <p className="text-sm text-[#b7c9d8]">Preview only. Nothing was mailed and nothing was charged.</p>
        </div>
        <MailerStatus mailer={mailer} proof={proof} framed={false} />
      </div>
    </CockpitFrame>
  )
}

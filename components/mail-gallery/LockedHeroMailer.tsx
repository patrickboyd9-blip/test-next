"use client"

import { useRef, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"

import { ProofFrame } from "@/components/campaign-creator/upload/ProofFrame"
import { QrFaceOverlay } from "@/components/qr-placement/QrFaceOverlay"
import { QrPlacementPanel } from "@/components/qr-placement/QrPlacementPanel"
import {
  CUSTOMER_PHOTO_MESSAGES,
  HERO_DESIGNING,
  HERO_EDIT_FAILED,
  PHOTO_SAVE_FAILED,
  WORD_CHANGE_LOGO,
} from "@/lib/image-edit/messages"
import { galleryPhotoSrc } from "@/lib/mail-templates/gallery-photo-src"
import { lockedHeroMissing, type LockedHeroInput } from "@/lib/mail-templates/locked-hero"
import { phoneFieldEmpty, phoneOnFrontAfterEdit } from "@/lib/mail-templates/phone-on-front"
import {
  beginLockedHeroEdit,
  finishLockedHeroEdit,
  LOCKED_HERO_PROOF_START,
  requestLockedHeroChanges,
  restartLockedHeroForm,
  type LockedHeroProofState,
} from "@/lib/mail-templates/locked-hero-proof"
import type { MailTemplate } from "@/lib/mail-templates/types"
import {
  activeQrs,
  initialQrPlacement,
  moveQr,
  normalizeScanUrl,
  POSTAGE_BLOCKED_MESSAGE,
  QR_WEBSITE_MISSING,
  type QrPlacementValue,
} from "@/lib/qr-placement/model"

const known = new Set<string>(CUSTOMER_PHOTO_MESSAGES)

const EMPTY: LockedHeroInput = {
  campaignName: "",
  size: null,
  businessName: "",
  offer: "",
  callToAction: "",
  phone: "",
  website: "",
  instructions: "",
  logoName: null,
}

export function LockedHeroMailer({ template }: { template: MailTemplate }) {
  const router = useRouter()
  const ticket = useRef(0)
  const [input, setInput] = useState<LockedHeroInput>(EMPTY)
  const [phoneOnFront, setPhoneOnFront] = useState(false)
  const [logoBase64, setLogoBase64] = useState<string | null>(null)
  const [note, setNote] = useState("")
  const [code, setCode] = useState("")
  const [state, setState] = useState<LockedHeroProofState>(LOCKED_HERO_PROOF_START)
  const [qr, setQr] = useState<QrPlacementValue>(() => initialQrPlacement("5x8", ""))
  const qrSeed = useRef(false)
  const photo = galleryPhotoSrc(template.id)
  const busy = state.phase === "designing"
  const size = input.size === "6x9" ? "6x9" : "5x8"
  const headline = [input.offer, input.callToAction].map((value) => value.replace(/\s+/g, " ").trim()).filter(Boolean).join(" · ")

  function set<K extends keyof LockedHeroInput>(key: K, value: LockedHeroInput[K]) {
    setInput((current) => ({ ...current, [key]: value }))
    setState((current) => (current.phase === "form" ? { ...current, message: "" } : current))
  }

  function setPhone(value: string) {
    setPhoneOnFront((checked) => phoneOnFrontAfterEdit(input.phone, value, checked))
    set("phone", value)
  }

  async function run(source: string | null, changeNote: string) {
    const id = ++ticket.current
    setCode("")
    setState((current) => ({ ...current, phase: "designing", message: HERO_DESIGNING, editSource: source }))
    try {
      const response = await fetch("/api/photo-edit/design", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          templateId: template.id,
          campaignName: input.campaignName,
          size: input.size,
          businessName: input.businessName,
          offer: input.offer,
          callToAction: input.callToAction,
          phone: input.phone,
          phoneOnFront: phoneFieldEmpty(input.phone) ? false : phoneOnFront,
          website: input.website,
          instructions: input.instructions,
          changeNote,
          logoBase64: logoBase64 ?? undefined,
          currentFrontBase64: source ?? undefined,
        }),
      })
      const data = (await response.json()) as {
        ok?: boolean
        message?: string
        frontSrc?: string
        backSrc?: string
        proof?: boolean
        code?: string
      }
      if (id !== ticket.current) return
      if (!data.ok || !data.frontSrc || !data.backSrc) {
        setCode(data.code ?? "")
        const message = known.has(data.message ?? "") ? (data.message as string) : HERO_EDIT_FAILED
        setState((current) => finishLockedHeroEdit(current, { ok: false, message }))
        return
      }
      setNote("")
      if (!qrSeed.current) {
        qrSeed.current = true
        setQr(initialQrPlacement(size, input.website, input.phone))
      }
      setState((current) =>
        finishLockedHeroEdit(current, {
          ok: true,
          frontSrc: data.frontSrc as string,
          backSrc: data.backSrc as string,
          proof: Boolean(data.proof),
        })
      )
    } catch {
      if (id !== ticket.current) return
      setCode("failed")
      setState((current) => finishLockedHeroEdit(current, { ok: false, message: HERO_EDIT_FAILED }))
    }
  }

  function continueForm() {
    const next = beginLockedHeroEdit(lockedHeroMissing(input))
    setState(next.state)
    if (next.run) void run(null, "")
  }

  function requestChanges() {
    const next = requestLockedHeroChanges(state, note)
    setState(next.state)
    if (next.run) void run(next.state.editSource, next.note)
  }

  function startOver() {
    ticket.current += 1
    qrSeed.current = false
    setNote("")
    setCode("")
    setState(restartLockedHeroForm())
  }

  async function approve() {
    if (!state.frontSrc) return
    if (qr.enabled && qr.codes.some((code) => code.destination === "website" && !normalizeScanUrl(code.website))) {
      setState((current) => ({ ...current, message: QR_WEBSITE_MISSING }))
      return
    }
    const id = ++ticket.current
    setState((current) => ({ ...current, phase: "designing", message: "Opening your proof." }))
    try {
      const response = await fetch("/api/photo-edit/design/accept", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          imageBase64: state.frontSrc,
          backBase64: state.backSrc,
          businessName: input.businessName,
          headline,
          offer: input.callToAction,
          phone: input.phone,
          website: input.website,
          campaignName: input.campaignName,
          size: input.size,
          qrs: activeQrs(qr),
        }),
      })
      const data = (await response.json()) as { ok?: boolean; message?: string; campaignId?: string }
      if (id !== ticket.current) return
      if (!data.ok || !data.campaignId) {
        const returned = data.message ?? ""
        const message = returned === QR_WEBSITE_MISSING || returned === POSTAGE_BLOCKED_MESSAGE || known.has(returned)
          ? returned
          : PHOTO_SAVE_FAILED
        setState((current) => finishLockedHeroEdit(current, { ok: false, message }))
        return
      }
      router.push(`/app/campaigns/${data.campaignId}`)
    } catch {
      if (id !== ticket.current) return
      setState((current) => finishLockedHeroEdit(current, { ok: false, message: PHOTO_SAVE_FAILED }))
    }
  }

  async function onLogo(file: File | undefined) {
    if (!file) {
      setLogoBase64(null)
      set("logoName", null)
      return
    }
    const type = file.type.toLowerCase()
    if (type !== "image/png" && type !== "image/jpeg") {
      setLogoBase64(null)
      set("logoName", null)
      setState((current) => ({ ...current, message: WORD_CHANGE_LOGO }))
      return
    }
    const data = await fileToDataUrl(file)
    setLogoBase64(data)
    set("logoName", file.name)
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-6 py-10" data-locked-hero={template.id} data-locked-hero-phase={state.phase}>
      <div>
        <p className="text-xs tracking-wide text-muted-foreground">GALLERY</p>
        <h1 className="mt-2 text-xl font-semibold leading-snug sm:text-2xl">Use this and have the AI make edits for me</h1>
        <p className="mt-1 text-sm leading-6 text-muted-foreground">
          This picture stays the hero. Tell us what to change. Nothing is mailed from this page.
        </p>
      </div>

      {state.phase === "form" ? (
        <>
          {photo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={photo} alt="" className="aspect-[8/5] w-full rounded-2xl object-cover" />
          ) : null}
          <form
            className="space-y-5"
            onSubmit={(event) => {
              event.preventDefault()
              continueForm()
            }}
          >
            <Field label="Campaign name" value={input.campaignName} placeholder="Spring tune-up" onChange={(value) => set("campaignName", value)} />
            <fieldset className="space-y-3">
              <legend className="text-sm font-medium">Postcard size</legend>
              <p className="text-sm text-muted-foreground">Nothing is selected until you pick.</p>
              <div className="grid gap-3 sm:grid-cols-2">
                {(["5x8", "6x9"] as const).map((choice) => (
                  <button
                    key={choice}
                    type="button"
                    aria-pressed={input.size === choice}
                    onClick={() => set("size", choice)}
                    className={`min-h-24 rounded-2xl border p-4 text-left ${input.size === choice ? "border-foreground" : ""}`}
                  >
                    {choice === "5x8" ? "5×8" : "6×9"}
                  </button>
                ))}
              </div>
            </fieldset>
            <Field label="Business name" value={input.businessName} placeholder="Harbor Roofing" onChange={(value) => set("businessName", value)} />
            <Field label="Offer" value={input.offer} placeholder="Free roof inspection this week" onChange={(value) => set("offer", value)} />
            <Field label="Call to action" value={input.callToAction} placeholder="Call to book a visit" onChange={(value) => set("callToAction", value)} />
            <Field label="Phone" value={input.phone} placeholder="(619) 555-0148" onChange={setPhone} />
            <label className={`flex min-h-11 items-center gap-2 text-sm font-normal ${phoneFieldEmpty(input.phone) ? "text-muted-foreground" : ""}`}>
              <input
                type="checkbox"
                className="size-4"
                checked={!phoneFieldEmpty(input.phone) && phoneOnFront}
                disabled={phoneFieldEmpty(input.phone)}
                onChange={(event) => setPhoneOnFront(event.target.checked)}
              />
              Show my phone number on the front
            </label>
            <Field label="Website" value={input.website} placeholder="harbor.example" hint="Optional. Add it if you want it on the card." onChange={(value) => set("website", value)} />
            <label className="block text-sm font-medium">
              What do you want changed?
              <span className="mt-1 block font-normal text-muted-foreground">
                Describe exactly what you want: wording, offer, colors, what to keep, what to change. The more specific, the better the result.
              </span>
              <textarea
                rows={5}
                value={input.instructions}
                placeholder="Keep the dog photo. Change the headline to Spring checkups, use our navy and gold, and put the phone at the bottom."
                onChange={(event) => set("instructions", event.target.value)}
                className="mt-2 min-h-28 w-full rounded-xl border bg-background px-3 py-2 font-normal"
              />
            </label>
            <div className="space-y-2">
              <label className="block text-sm font-medium">
                Logo
                <span className="mt-1 block font-normal text-muted-foreground">Highly recommended. A PNG or JPEG logo makes the card yours. You can continue without one.</span>
                <input
                  type="file"
                  accept="image/png,image/jpeg,.png,.jpg,.jpeg"
                  className="mt-2 block min-h-11 w-full text-sm"
                  onChange={(event) => void onLogo(event.target.files?.[0])}
                />
              </label>
              {input.logoName ? <p className="text-sm text-muted-foreground">{input.logoName}</p> : null}
            </div>
            {state.message ? <p className="text-sm text-destructive" role="alert">{state.message}</p> : null}
            <button type="submit" className="min-h-11 rounded-xl bg-foreground px-4 text-sm font-semibold text-background">
              Continue
            </button>
          </form>
        </>
      ) : null}

      {busy ? (
        <div className="flex items-center gap-3 rounded-2xl border px-4 py-6" role="status" aria-busy="true">
          <span className="inline-block size-5 animate-spin rounded-full border-2 border-muted-foreground border-t-foreground" aria-hidden="true" />
          <p className="text-sm font-medium">{state.message}</p>
        </div>
      ) : null}

      {state.frontSrc && state.backSrc && state.phase !== "designing" ? (
        <div className="grid gap-6">
          <figure className="flex flex-col gap-2">
            <figcaption className="text-sm font-medium">Front</figcaption>
            <div className={`relative overflow-hidden rounded-lg border bg-white ${size === "6x9" ? "aspect-[3/2]" : "aspect-[8/5]"}`}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={state.frontSrc} alt="Front of the postcard" className="absolute inset-0 h-full w-full object-fill" />
              {qr.enabled ? (
                <QrFaceOverlay
                  size={size}
                  side="front"
                  frame="trim"
                  codes={qr.codes}
                  onMove={(id, x, y) => setQr((current) => moveQr(current, size, id, x, y))}
                />
              ) : null}
              {state.proof ? <ProofMark tone="light" /> : null}
            </div>
          </figure>
          <ProofFrame src={state.backSrc} mediaType="image/jpeg" face="back" label="Back" size={size}>
            {qr.enabled ? (
              <QrFaceOverlay
                size={size}
                side="back"
                frame="canvas"
                codes={qr.codes}
                onMove={(id, x, y) => setQr((current) => moveQr(current, size, id, x, y))}
              />
            ) : null}
            {state.proof ? <ProofMark tone="dark" /> : null}
          </ProofFrame>
          {state.phase === "proof" ? (
            <QrPlacementPanel
              value={qr}
              size={size}
              businessName={input.businessName}
              headline={headline}
              offer={input.callToAction}
              onChange={setQr}
            />
          ) : null}
          <p className="text-sm text-muted-foreground">The address side stays clear for postage.</p>
        </div>
      ) : null}

      {state.phase === "proof" ? (
        <div className="space-y-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
            <button type="button" className="min-h-11 rounded-xl bg-foreground px-4 text-sm font-semibold text-background" onClick={() => void approve()}>
              Approve
            </button>
            <button type="button" className="min-h-11 rounded-xl border px-4 text-sm" onClick={startOver}>
              Start over
            </button>
          </div>
          <label className="block text-sm font-medium">
            What should change?
            <textarea
              rows={3}
              value={note}
              placeholder="Make the headline shorter and move the phone to the bottom."
              onChange={(event) => setNote(event.target.value)}
              className="mt-1 min-h-20 w-full rounded-xl border bg-background px-3 py-2 font-normal"
            />
          </label>
          <button type="button" className="min-h-11 rounded-xl border px-4 text-sm font-semibold" onClick={requestChanges}>
            Request changes
          </button>
        </div>
      ) : null}

      {state.phase === "error" ? (
        <div className="flex flex-col gap-2 sm:flex-row">
          <button type="button" className="min-h-11 rounded-xl bg-foreground px-4 text-sm font-semibold text-background" onClick={() => void run(state.editSource, note)}>
            Try again
          </button>
          <button type="button" className="min-h-11 rounded-xl border px-4 text-sm" onClick={startOver}>
            Start over
          </button>
        </div>
      ) : null}

      {state.phase !== "form" && state.phase !== "designing" && state.message ? (
        <p className="text-sm" role="status">
          {state.message}{" "}
          {code === "allowance" ? (
            <Link href="/app/billing" className="underline">
              Add a card
            </Link>
          ) : null}
          {code === "sign-in" ? (
            <Link href="/sign-in" className="underline">
              Sign in
            </Link>
          ) : null}
        </p>
      ) : null}
    </div>
  )
}

function ProofMark({ tone }: { tone: "light" | "dark" }) {
  const color = tone === "dark" ? "text-[#1c2430]/40" : "text-white/45"
  return (
    <span className={`pointer-events-none absolute inset-0 flex items-center justify-center text-4xl font-semibold tracking-[0.3em] sm:text-6xl ${color}`} aria-hidden="true">
      PROOF
    </span>
  )
}

function Field({
  label,
  value,
  placeholder,
  hint,
  onChange,
}: {
  label: string
  value: string
  placeholder: string
  hint?: string
  onChange: (value: string) => void
}) {
  return (
    <label className="block text-sm font-medium">
      {label}
      {hint ? <span className="mt-1 block font-normal text-muted-foreground">{hint}</span> : null}
      <input
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1 min-h-11 w-full rounded-xl border bg-background px-3 font-normal"
      />
    </label>
  )
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : "")
    reader.onerror = () => reject(new Error("logo"))
    reader.readAsDataURL(file)
  })
}

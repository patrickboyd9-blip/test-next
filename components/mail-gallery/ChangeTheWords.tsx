"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"

import {
  CUSTOMER_PHOTO_MESSAGES,
  PHOTO_EDIT_FAILED,
  PHOTO_EDITED,
  PHOTO_EDITING,
  PHOTO_SAVE_FAILED,
  WORD_CHANGE_NEED_DETAILS,
  WORD_CHANGE_NEED_PLACE,
} from "@/lib/image-edit/messages"
import { LOGO_PLACEMENTS, type LogoPlacement } from "@/lib/image-edit/logo-placement"

const known = new Set<string>(CUSTOMER_PHOTO_MESSAGES)

const PLACEMENT_LABELS: Record<LogoPlacement, string> = {
  "top-left": "Top left",
  "top-right": "Top right",
  "bottom-left": "Bottom left",
  "bottom-right": "Bottom right",
  "center-top": "Center top",
  "replace-existing": "Replace the existing logo",
}

export function ChangeTheWords({
  templateId,
  imageSrc,
  onBack,
}: {
  templateId: string
  imageSrc: string
  onBack: () => void
}) {
  const router = useRouter()
  const [businessName, setBusinessName] = useState("")
  const [headline, setHeadline] = useState("")
  const [phone, setPhone] = useState("")
  const [website, setWebsite] = useState("")
  const [extra, setExtra] = useState("")
  const [logo, setLogo] = useState<string | null>(null)
  const [logoName, setLogoName] = useState<string | null>(null)
  const [placement, setPlacement] = useState<LogoPlacement | "">("")
  const [afterSrc, setAfterSrc] = useState<string | null>(null)
  const [proof, setProof] = useState(false)
  const [status, setStatus] = useState("")
  const [code, setCode] = useState("")
  const [busy, setBusy] = useState(false)

  async function submit() {
    if (businessName.trim().length < 2 || headline.trim().length < 2 || phone.trim().length < 7) {
      setStatus(WORD_CHANGE_NEED_DETAILS)
      setCode("invalid")
      return
    }
    if (logo && !placement) {
      setStatus(WORD_CHANGE_NEED_PLACE)
      setCode("invalid")
      return
    }
    setBusy(true)
    setStatus(PHOTO_EDITING)
    setCode("")
    setAfterSrc(null)
    try {
      const response = await fetch("/api/photo-edit/words", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          templateId,
          businessName,
          headline,
          phone,
          website,
          extra,
          placement: logo ? placement : undefined,
          logoBase64: logo ?? undefined,
        }),
      })
      const data = (await response.json()) as { ok?: boolean; message?: string; afterSrc?: string; proof?: boolean; code?: string }
      if (!data.ok || !data.afterSrc) {
        setCode(data.code ?? "")
        setStatus(known.has(data.message ?? "") ? (data.message as string) : PHOTO_EDIT_FAILED)
        return
      }
      setAfterSrc(data.afterSrc)
      setProof(Boolean(data.proof))
      setStatus(PHOTO_EDITED)
      setCode("")
    } catch {
      setStatus(PHOTO_EDIT_FAILED)
      setCode("failed")
    } finally {
      setBusy(false)
    }
  }

  async function accept() {
    if (!afterSrc) return
    setBusy(true)
    setStatus("Opening your proof.")
    try {
      const response = await fetch("/api/photo-edit/words/accept", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ imageBase64: afterSrc, businessName, headline, phone, website }),
      })
      const data = (await response.json()) as { ok?: boolean; message?: string; campaignId?: string }
      if (!data.ok || !data.campaignId) {
        setStatus(known.has(data.message ?? "") ? (data.message as string) : PHOTO_SAVE_FAILED)
        return
      }
      router.push(`/app/campaigns/${data.campaignId}`)
    } catch {
      setStatus(PHOTO_SAVE_FAILED)
    } finally {
      setBusy(false)
    }
  }

  async function onLogo(file: File | undefined) {
    if (!file) {
      setLogo(null)
      setLogoName(null)
      return
    }
    const data = await fileToDataUrl(file)
    setLogo(data)
    setLogoName(file.name)
  }

  return (
    <section className="space-y-4 text-white" aria-label="Change the words" data-change-words={templateId}>
      <div className="relative">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={afterSrc ?? imageSrc} alt="" className="mx-auto max-h-[42vh] w-full rounded-2xl object-contain" />
        {afterSrc && proof ? (
          <span className="pointer-events-none absolute inset-0 flex items-center justify-center text-4xl font-semibold tracking-[0.3em] text-white/45 sm:text-6xl" aria-hidden="true">
            PROOF
          </span>
        ) : null}
      </div>
      <form
        className="grid gap-3 sm:grid-cols-2"
        onSubmit={(event) => {
          event.preventDefault()
          void submit()
        }}
      >
        <Field label="Business name" value={businessName} onChange={setBusinessName} />
        <Field label="Headline or offer" value={headline} onChange={setHeadline} />
        <Field label="Phone" value={phone} onChange={setPhone} />
        <Field label="Website" value={website} onChange={setWebsite} hint="Optional" />
        <label className="block text-sm sm:col-span-2">
          Extra line
          <span className="mt-1 block font-normal text-white/60">Optional. A short line, if you want one more.</span>
          <input value={extra} onChange={(event) => setExtra(event.target.value)} className="mt-1 min-h-11 w-full rounded-xl border border-white/30 bg-transparent px-3" />
        </label>
        <div className="space-y-2 sm:col-span-2">
          <label className="block text-sm">
            Logo
            <span className="mt-1 block font-normal text-white/60">Optional. A PNG or JPEG. Then choose where it goes.</span>
            <input
              type="file"
              accept="image/png,image/jpeg,.png,.jpg,.jpeg"
              className="mt-2 block min-h-11 w-full text-sm"
              onChange={(event) => void onLogo(event.target.files?.[0])}
            />
          </label>
          {logoName ? <p className="text-sm text-white/70">{logoName}</p> : null}
          {logo ? (
            <fieldset className="space-y-2">
              <legend className="text-sm">Where should the logo go?</legend>
              <div className="grid gap-2 sm:grid-cols-2">
                {LOGO_PLACEMENTS.map((choice) => (
                  <label key={choice} className="flex min-h-11 items-center gap-2 rounded-xl border border-white/30 px-3 text-sm">
                    <input
                      type="radio"
                      name="logo-placement"
                      value={choice}
                      checked={placement === choice}
                      onChange={() => setPlacement(choice)}
                    />
                    {PLACEMENT_LABELS[choice]}
                  </label>
                ))}
              </div>
            </fieldset>
          ) : null}
        </div>
        <div className="flex flex-col gap-2 sm:col-span-2 sm:flex-row sm:flex-wrap">
          <button type="submit" disabled={busy} className="min-h-11 rounded-xl bg-[#5ce1ff] px-4 text-sm font-semibold text-[#041018] disabled:opacity-40">
            Change the words
          </button>
          {afterSrc ? (
            <>
              <button type="button" disabled={busy} className="min-h-11 rounded-xl bg-white px-4 text-sm font-semibold text-[#041018] disabled:opacity-40" onClick={() => void accept()}>
                Accept this proof
              </button>
              <button type="submit" disabled={busy} className="min-h-11 rounded-xl border border-white/30 px-4 text-sm disabled:opacity-40">
                Try again
              </button>
            </>
          ) : null}
          <button type="button" className="min-h-11 rounded-xl border border-white/30 px-4 text-sm" onClick={onBack}>
            Back
          </button>
        </div>
      </form>
      {status ? (
        <p className="text-sm" role="status">
          {status}{" "}
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
    </section>
  )
}

function Field({
  label,
  value,
  hint,
  onChange,
}: {
  label: string
  value: string
  hint?: string
  onChange: (value: string) => void
}) {
  return (
    <label className="block text-sm">
      {label}
      {hint ? <span className="mt-1 block font-normal text-white/60">{hint}</span> : null}
      <input value={value} onChange={(event) => onChange(event.target.value)} className="mt-1 min-h-11 w-full rounded-xl border border-white/30 bg-transparent px-3" />
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

"use client"

import { useState } from "react"

import { galleryPhotoSrc } from "@/lib/mail-templates/gallery-photo-src"
import { lockedHeroDesign, lockedHeroMissing, type LockedHeroInput } from "@/lib/mail-templates/locked-hero"
import type { MailTemplate } from "@/lib/mail-templates/types"

const EMPTY: LockedHeroInput = {
  campaignName: "",
  size: null,
  businessName: "",
  offer: "",
  callToAction: "",
  phone: "",
  website: "",
  logoName: null,
}

export function LockedHeroMailer({ template }: { template: MailTemplate }) {
  const [input, setInput] = useState<LockedHeroInput>(EMPTY)
  const [message, setMessage] = useState("")
  const [ready, setReady] = useState(false)
  const photo = galleryPhotoSrc(template.id)
  const design = ready && !lockedHeroMissing(input) ? lockedHeroDesign(template, input) : null

  function set<K extends keyof LockedHeroInput>(key: K, value: LockedHeroInput[K]) {
    setInput((current) => ({ ...current, [key]: value }))
    setMessage("")
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-6 py-10" data-locked-hero={template.id}>
      <div>
        <p className="text-xs tracking-wide text-muted-foreground">GALLERY</p>
        <h1 className="mt-2 text-2xl font-semibold">Design it for me</h1>
        <p className="mt-1 text-sm leading-6 text-muted-foreground">
          This picture stays the hero. Add the same details as a new mailer. This is a sample. Nothing is mailed.
        </p>
      </div>
      {photo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={photo} alt="" className="aspect-[8/5] w-full rounded-2xl object-cover" />
      ) : null}

      {design ? (
        <article className="space-y-3 rounded-2xl border p-4">
          <p className="text-sm text-muted-foreground">{design.note}</p>
          <h2 className="text-2xl font-semibold">{design.businessName}</h2>
          <p className="text-lg">{design.headline}</p>
          <p>{design.offer}</p>
          <p className="text-sm text-muted-foreground">{design.phone}{design.website ? ` · ${design.website}` : ""}</p>
          {design.logoName ? <p className="text-sm">Logo · {design.logoName}</p> : null}
          <p className="text-sm text-muted-foreground">{design.back}</p>
          <p className="text-sm">{design.campaignName} · {design.size === "6x9" ? "6×9" : "5×8"} · picture locked</p>
        </article>
      ) : (
        <form
          className="space-y-5"
          onSubmit={(event) => {
            event.preventDefault()
            const missing = lockedHeroMissing(input)
            if (missing) {
              setMessage(missing)
              return
            }
            setReady(true)
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
          <Field label="Phone" value={input.phone} placeholder="(619) 555-0148" onChange={(value) => set("phone", value)} />
          <Field label="Website" value={input.website} placeholder="harbor.example" hint="Optional. Add it if you want it on the card." onChange={(value) => set("website", value)} />
          <div className="space-y-2">
            <label className="block text-sm font-medium">
              Logo
              <span className="mt-1 block font-normal text-muted-foreground">Highly recommended. A logo makes the card yours. You can continue without one.</span>
              <input
                type="file"
                accept="image/png,image/jpeg,image/svg+xml,.png,.jpg,.jpeg,.svg"
                className="mt-2 block min-h-11 w-full text-sm"
                onChange={(event) => set("logoName", event.target.files?.[0]?.name ?? null)}
              />
            </label>
            {input.logoName ? <p className="text-sm text-muted-foreground">{input.logoName}</p> : null}
          </div>
          {message ? <p className="text-sm text-destructive" role="alert">{message}</p> : null}
          <button type="submit" className="min-h-11 rounded-xl bg-foreground px-4 text-sm font-semibold text-background">
            Continue
          </button>
        </form>
      )}
    </div>
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

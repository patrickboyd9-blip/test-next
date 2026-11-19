"use client"

import { useState } from "react"

import { galleryPhotoSrc } from "@/lib/mail-templates/gallery-photo-src"
import { lockedHeroDesign, lockedHeroReady, type LockedHeroSize } from "@/lib/mail-templates/locked-hero"
import type { MailTemplate } from "@/lib/mail-templates/types"

const SIZE_MESSAGE = "Choose a 5×8 or a 6×9 postcard."

export function LockedHeroMailer({ template }: { template: MailTemplate }) {
  const [name, setName] = useState("")
  const [named, setNamed] = useState(false)
  const [size, setSize] = useState<LockedHeroSize | null>(null)
  const [sizeMessage, setSizeMessage] = useState("")
  const [ready, setReady] = useState(false)
  const photo = galleryPhotoSrc(template.id)
  const design = ready && lockedHeroReady(name, size) ? lockedHeroDesign(template, name, size) : null

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-6 py-10" data-locked-hero={template.id}>
      <div>
        <p className="text-xs tracking-wide text-[#8aa0b4]">MAILER GALLERY</p>
        <h1 className="mt-2 text-2xl font-semibold">Design it for me</h1>
        <p className="mt-1 text-sm leading-6 text-[#b7c9d8]">
          This picture stays the hero. The words, offer, and address side are written around it. This is a sample. Nothing is mailed.
        </p>
      </div>
      {photo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={photo} alt="" className="aspect-[8/5] w-full rounded-2xl object-cover" />
      ) : null}

      {!named ? (
        <form
          className="space-y-3"
          onSubmit={(event) => {
            event.preventDefault()
            if (name.trim().length < 2) return
            setNamed(true)
          }}
        >
          <label className="block text-sm">
            Campaign name
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              className="mt-1 min-h-11 w-full rounded-xl border border-[#245068] bg-[#071018] px-3"
              placeholder="Spring tune-up"
            />
          </label>
          <p className="text-sm text-[#8aa0b4]">This is how it shows up in your list.</p>
          <button type="submit" disabled={name.trim().length < 2} className="min-h-11 rounded-xl bg-[#5ce1ff] px-4 text-sm font-semibold text-[#041018] disabled:opacity-40">
            Continue
          </button>
        </form>
      ) : null}

      {named && !design ? (
        <div className="space-y-3">
          <h2 className="text-xl font-semibold">Choose the postcard size</h2>
          <p className="text-sm text-[#b7c9d8]">Nothing is selected until you pick.</p>
          <div className="grid gap-3 sm:grid-cols-2">
            {(["5x8", "6x9"] as const).map((choice) => (
              <button
                key={choice}
                type="button"
                aria-pressed={size === choice}
                onClick={() => {
                  setSize(choice)
                  setSizeMessage("")
                }}
                className={`min-h-24 rounded-2xl border p-4 text-left ${size === choice ? "border-[#5ce1ff]" : "border-[#1c3d52]"}`}
              >
                {choice === "5x8" ? "5×8" : "6×9"}
              </button>
            ))}
          </div>
          {sizeMessage ? <p className="text-sm text-[#f0a202]" role="alert">{sizeMessage}</p> : null}
          <button
            type="button"
            onClick={() => {
              if (!lockedHeroReady(name, size)) {
                setSizeMessage(SIZE_MESSAGE)
                return
              }
              setReady(true)
            }}
            className={`min-h-11 rounded-xl bg-[#5ce1ff] px-4 text-sm font-semibold text-[#041018] ${size ? "" : "opacity-40"}`}
          >
            Continue
          </button>
        </div>
      ) : null}

      {design ? (
        <article className="space-y-3 rounded-2xl border border-[#1c3d52] p-4">
          <p className="text-sm text-[#8aa0b4]">{design.note}</p>
          <h2 className="text-2xl font-semibold">{design.headline}</h2>
          <p>{design.offer}</p>
          <p className="text-sm text-[#b7c9d8]">{design.back}</p>
          <p className="text-sm">{design.campaignName} · {design.size === "6x9" ? "6×9" : "5×8"} · picture locked</p>
        </article>
      ) : null}
    </div>
  )
}

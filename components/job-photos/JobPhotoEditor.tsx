"use client"

import { useState } from "react"

import type { JobCreative, JobKeepBox, JobPhotoRecord, JobProtect } from "@/lib/campaign-creator/types"
import { addJobPhotoAction, saveJobLayoutAction } from "@/lib/job-photos/actions"
import { LOW_DETAIL_MESSAGE, windowForKeep, FRONT_PHOTO_SLOT, backPhotoSlot } from "@/lib/job-photos/crop"

export function JobPhotoEditor({
  campaignId,
  initial,
  notice = "",
}: {
  campaignId: string
  initial: JobCreative
  notice?: string
}) {
  const [creative, setCreative] = useState(initial)
  const [rights, setRights] = useState(Boolean(initial.rightsConfirmedAt))
  const [message, setMessage] = useState(notice)
  const [busy, setBusy] = useState(false)

  async function onSave() {
    setBusy(true)
    setMessage("")
    const result = await saveJobLayoutAction(campaignId, {
      ...creative,
      rightsConfirmedAt: rights ? creative.rightsConfirmedAt ?? new Date().toISOString() : null,
    })
    setBusy(false)
    if (!result.ok) {
      setMessage(result.error)
      return
    }
    setCreative(result.creative)
    setMessage("Saved. The same frame is used on the proof.")
  }

  function moveKeep(id: string, keep: JobKeepBox) {
    setCreative((current) => ({
      ...current,
      photos: current.photos.map((photo) => (photo.id === id ? { ...photo, keep } : photo)),
    }))
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-8 p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Job photos</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Add pictures from the work, up to five. The logo and a finished postcard stay on their own uploads.
          Drag the box over what has to stay in the card. No pixel sizes.
        </p>
      </div>

      <label className="flex items-start gap-2 text-sm">
        <input type="checkbox" checked={rights} onChange={(event) => setRights(event.target.checked)} />
        <span>I have permission to mail these photos.</span>
      </label>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-sm">
          Trade
          <input
            className="mt-1 w-full rounded-md border px-3 py-2"
            value={creative.trade === "unknown" ? "" : creative.trade}
            placeholder="Unknown is fine"
            onChange={(event) => setCreative({ ...creative, trade: event.target.value || "unknown" })}
          />
        </label>
        <label className="text-sm">
          What the photo shows
          <input
            className="mt-1 w-full rounded-md border px-3 py-2"
            value={creative.serviceAction}
            placeholder="Repair, replacement, a slice"
            onChange={(event) => setCreative({ ...creative, serviceAction: event.target.value })}
          />
        </label>
      </div>

      <form action={addJobPhotoAction.bind(null, campaignId)} className="flex flex-wrap items-center gap-3">
        <input type="hidden" name="rights" value={rights ? "yes" : ""} />
        <input name="photo" type="file" accept="image/png,image/jpeg" disabled={!rights || busy} />
        <button type="submit" className="rounded-md border px-3 py-2 text-sm" disabled={!rights || busy}>
          Add job photo
        </button>
      </form>

      {creative.photos.map((photo) => (
        <PhotoFrame
          key={photo.id}
          campaignId={campaignId}
          photo={photo}
          front={creative.frontPhotoId === photo.id}
          onFront={() => setCreative({ ...creative, frontPhotoId: photo.id })}
          onKeep={(keep) => moveKeep(photo.id, keep)}
          onProtect={(protect) =>
            setCreative({
              ...creative,
              photos: creative.photos.map((item) => (item.id === photo.id ? { ...item, protect } : item)),
            })
          }
        />
      ))}

      <fieldset className="flex flex-col gap-2 text-sm">
        <legend className="font-medium">Back of the card</legend>
        <label className="flex gap-2">
          <input
            type="radio"
            name="back"
            checked={creative.back.treatment === "text"}
            onChange={() => setCreative({ ...creative, back: { treatment: "text", photoId: null } })}
          />
          Words only. Leaves the front photo where it is.
        </label>
        <label className="flex gap-2">
          <input
            type="radio"
            name="back"
            checked={creative.back.treatment === "photo"}
            onChange={() =>
              setCreative({
                ...creative,
                back: { treatment: "photo", photoId: creative.back.photoId ?? creative.frontPhotoId },
              })
            }
          />
          Use a job photo on the back too.
        </label>
      </fieldset>

      {message ? <p className="text-sm">{message}</p> : null}

      <div className="flex gap-3">
        <button type="button" className="rounded-md border px-3 py-2 text-sm" onClick={() => void onSave()} disabled={busy}>
          Save frame
        </button>
        <a className="rounded-md border px-3 py-2 text-sm" href={`/api/campaigns/${campaignId}/job-proof`}>
          Open print proof
        </a>
      </div>
    </div>
  )
}

function PhotoFrame({
  campaignId,
  photo,
  front,
  onFront,
  onKeep,
  onProtect,
}: {
  campaignId: string
  photo: JobPhotoRecord
  front: boolean
  onFront: () => void
  onKeep: (keep: JobKeepBox) => void
  onProtect: (protect: JobProtect) => void
}) {
  const frontFit = windowForKeep(photo, photo.keep, FRONT_PHOTO_SLOT)
  const backFit = windowForKeep(photo, photo.keep, backPhotoSlot())
  const warning = !frontFit.fits ? frontFit.reason : !backFit.fits ? backFit.reason : photo.detail === "low" ? LOW_DETAIL_MESSAGE : null

  function nudge(scale: number) {
    const w = clamp(photo.keep.w * scale, 0.12, 0.96)
    const h = clamp(photo.keep.h * scale, 0.12, 0.96)
    const x = clamp(photo.keep.x + (photo.keep.w - w) / 2, 0, 1 - w)
    const y = clamp(photo.keep.y + (photo.keep.h - h) / 2, 0, 1 - h)
    onKeep({ x, y, w, h })
  }

  return (
    <section className="flex flex-col gap-3 rounded-md border p-3">
      <div className="flex items-center justify-between text-sm">
        <span>{front ? "On the front" : "Not on the front"}</span>
        <button type="button" className="underline" onClick={onFront}>
          Use on the front
        </button>
      </div>
      <KeepBox campaignId={campaignId} photo={photo} onKeep={onKeep} />
      <div className="flex gap-2">
        <button type="button" className="rounded-md border px-2 py-1 text-sm" onClick={() => nudge(1.15)}>
          Show more around it
        </button>
        <button type="button" className="rounded-md border px-2 py-1 text-sm" onClick={() => nudge(0.85)}>
          Tighten around it
        </button>
      </div>
      <div className="flex flex-wrap gap-3 text-sm">
        {(
          [
            ["face", "A face"],
            ["service-object", "The work"],
            ["both", "Face and the work"],
          ] as const
        ).map(([value, label]) => (
          <label key={value} className="flex gap-1">
            <input type="radio" name={`protect-${photo.id}`} checked={photo.protect === value} onChange={() => onProtect(value)} />
            {label}
          </label>
        ))}
      </div>
      {warning ? <p className="text-sm">{warning}</p> : null}
      {!backFit.fits ? <p className="text-sm">The words-only back avoids cutting this.</p> : null}
    </section>
  )
}

function KeepBox({
  campaignId,
  photo,
  onKeep,
}: {
  campaignId: string
  photo: JobPhotoRecord
  onKeep: (keep: JobKeepBox) => void
}) {
  return (
    <div
      className="relative w-full overflow-hidden rounded-md bg-neutral-200"
      style={{ aspectRatio: `${photo.width} / ${photo.height}` }}
      onPointerDown={(event) => {
        const bounds = event.currentTarget.getBoundingClientRect()
        const startX = event.clientX
        const startY = event.clientY
        const origin = photo.keep
        function move(next: PointerEvent) {
          const dx = (next.clientX - startX) / bounds.width
          const dy = (next.clientY - startY) / bounds.height
          onKeep({
            ...origin,
            x: clamp(origin.x + dx, 0, 1 - origin.w),
            y: clamp(origin.y + dy, 0, 1 - origin.h),
          })
        }
        function up() {
          window.removeEventListener("pointermove", move)
          window.removeEventListener("pointerup", up)
        }
        window.addEventListener("pointermove", move)
        window.addEventListener("pointerup", up)
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        alt="Job photo"
        src={`/api/studio-image/${campaignId}/${photo.fileName}`}
        className="pointer-events-none h-full w-full"
      />
      <div
        className="absolute border-2 border-white shadow"
        style={{
          left: `${photo.keep.x * 100}%`,
          top: `${photo.keep.y * 100}%`,
          width: `${photo.keep.w * 100}%`,
          height: `${photo.keep.h * 100}%`,
        }}
      />
    </div>
  )
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

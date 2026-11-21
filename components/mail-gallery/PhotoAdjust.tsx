"use client"

import { useState } from "react"

import {
  CUSTOMER_PHOTO_MESSAGES,
  PHOTO_EDIT_FAILED,
  PHOTO_EDITING,
  PHOTO_EDITED,
  PHOTO_KEPT,
  PHOTO_ORIGINAL,
} from "@/lib/image-edit/messages"

const known = new Set<string>(CUSTOMER_PHOTO_MESSAGES)

export function PhotoAdjust({
  templateId,
  imageSrc,
  onKept,
  onOriginal,
}: {
  templateId?: string
  imageSrc: string
  onKept: (src: string) => void
  onOriginal: () => void
}) {
  const [instruction, setInstruction] = useState("")
  const [afterSrc, setAfterSrc] = useState<string | null>(null)
  const [status, setStatus] = useState("")
  const [busy, setBusy] = useState(false)

  async function apply() {
    setBusy(true)
    setStatus(PHOTO_EDITING)
    setAfterSrc(null)
    try {
      const body: { instruction: string; templateId?: string; imageBase64?: string } = {
        instruction,
      }
      if (templateId) body.templateId = templateId
      else body.imageBase64 = await imageToBase64(imageSrc)
      const response = await fetch("/api/photo-edit", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      })
      const data = (await response.json()) as { ok?: boolean; message?: string; afterSrc?: string }
      if (!data.ok || !data.afterSrc) {
        setStatus(known.has(data.message ?? "") ? (data.message as string) : PHOTO_EDIT_FAILED)
        return
      }
      setAfterSrc(data.afterSrc)
      setStatus(PHOTO_EDITED)
    } catch {
      setStatus(PHOTO_EDIT_FAILED)
    } finally {
      setBusy(false)
    }
  }

  function restore() {
    setAfterSrc(null)
    onOriginal()
    setStatus(PHOTO_ORIGINAL)
  }

  async function keep() {
    if (!afterSrc) return
    setBusy(true)
    try {
      const response = await fetch("/api/photo-edit/keep", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ imageBase64: afterSrc }),
      })
      const data = (await response.json()) as { ok?: boolean; message?: string }
      if (!data.ok) {
        setStatus(known.has(data.message ?? "") ? (data.message as string) : PHOTO_EDIT_FAILED)
        return
      }
      onKept(afterSrc)
      setStatus(PHOTO_KEPT)
    } catch {
      setStatus(PHOTO_EDIT_FAILED)
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="space-y-3" aria-label="Edit the photo">
      <form
        className="space-y-2"
        onSubmit={(event) => {
          event.preventDefault()
          void apply()
        }}
      >
        <label className="block text-sm">
          Edit the photo
          <textarea
            value={instruction}
            onChange={(event) => setInstruction(event.target.value)}
            rows={2}
            placeholder="Make the sky sunset"
            className="mt-1 w-full rounded-xl border border-[#245068] bg-[#071018] px-3 py-2 text-sm"
          />
        </label>
        <button
          type="submit"
          disabled={busy || instruction.trim().length < 2}
          className="min-h-11 rounded-xl bg-[#5ce1ff] px-4 text-sm font-semibold text-[#041018] disabled:opacity-40"
        >
          Apply edit
        </button>
      </form>
      {status ? <p className="text-sm">{status}</p> : null}
      {afterSrc ? (
        <div className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <figure>
              <figcaption className="mb-1 text-xs text-[#8aa0b4]">Before</figcaption>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={imageSrc} alt="" className="max-h-48 w-full rounded-xl object-cover" />
            </figure>
            <figure>
              <figcaption className="mb-1 text-xs text-[#8aa0b4]">After</figcaption>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={afterSrc} alt="" className="max-h-48 w-full rounded-xl object-cover" />
            </figure>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" className="min-h-11 rounded-xl border border-[#245068] px-3 text-sm" onClick={restore}>
              Undo
            </button>
            <button
              type="button"
              disabled={busy}
              className="min-h-11 rounded-xl bg-[#5ce1ff] px-3 text-sm font-semibold text-[#041018] disabled:opacity-40"
              onClick={() => void keep()}
            >
              Keep
            </button>
            <button type="button" className="min-h-11 rounded-xl border border-[#245068] px-3 text-sm" onClick={restore}>
              Discard
            </button>
          </div>
        </div>
      ) : null}
    </section>
  )
}

async function imageToBase64(src: string): Promise<string> {
  const response = await fetch(src)
  const bytes = new Uint8Array(await response.arrayBuffer())
  let binary = ""
  const chunk = 0x8000
  for (let index = 0; index < bytes.length; index += chunk) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunk))
  }
  return btoa(binary)
}

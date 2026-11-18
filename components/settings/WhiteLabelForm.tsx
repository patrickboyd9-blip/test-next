"use client"

import { useState } from "react"

import { saveWhiteLabel } from "@/lib/white-label/actions"
import type { WhiteLabelSettings } from "@/lib/white-label/brand"

export function WhiteLabelForm({ initial }: { initial: WhiteLabelSettings }) {
  const [message, setMessage] = useState("")
  const [error, setError] = useState("")
  const [pending, setPending] = useState(false)

  async function submit(formData: FormData) {
    setPending(true)
    setError("")
    setMessage("")
    const result = await saveWhiteLabel(formData)
    setPending(false)
    if (!result.ok) {
      setError(result.error)
      return
    }
    setMessage("Saved. The name, color, and support line update on the next screen.")
  }

  return (
    <form action={submit} className="flex flex-col gap-4" data-slot="white-label-form">
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="enabled" defaultChecked={initial.enabled} />
        White label is on for this account
      </label>
      <Field label="App name" name="appName" defaultValue={initial.appName} />
      <Field label="Accent color" name="accent" defaultValue={initial.accent} />
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="hidePoweredBy" defaultChecked={initial.hidePoweredBy} />
        Hide “Powered by Modern Mail”
      </label>
      <Field label="Support name" name="supportName" defaultValue={initial.supportName} />
      <Field label="Support email" name="supportEmail" defaultValue={initial.supportEmail} />
      <label className="text-sm">
        Logo
        <input name="logo" type="file" accept="image/png,image/jpeg,image/webp" className="mt-1 block text-sm" />
      </label>
      <label className="text-sm">
        Favicon
        <input name="favicon" type="file" accept="image/png,image/jpeg,image/webp" className="mt-1 block text-sm" />
      </label>
      <div className="rounded-xl border border-[#245068] px-3 py-3 text-sm text-[#b7c9d8]">
        Custom domain, coming soon. Sending from your own domain is not part of this version.
      </div>
      {error ? <p className="text-sm text-[#f6d48a]">{error}</p> : null}
      {message ? <p className="text-sm text-[#b7f7c8]">{message}</p> : null}
      <button type="submit" disabled={pending} className="min-h-11 w-fit rounded-xl bg-[#5ce1ff] px-4 text-sm font-semibold text-[#041018] disabled:opacity-40">
        {pending ? "Saving…" : "Save branding"}
      </button>
    </form>
  )
}

function Field({ label, name, defaultValue }: { label: string; name: string; defaultValue: string }) {
  return (
    <label className="text-sm">
      {label}
      <input name={name} defaultValue={defaultValue} className="mt-1 min-h-11 w-full rounded-lg border border-[#245068] bg-[#071018] px-3" />
    </label>
  )
}

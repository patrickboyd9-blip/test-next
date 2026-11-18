"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"

import { duplicateOwnedCampaign } from "@/lib/campaign-creator/actions"

export function DuplicateCampaignButton({ id, name }: { id: string; name: string }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [value, setValue] = useState(`${name} (copy)`)
  const [error, setError] = useState("")
  const [pending, setPending] = useState(false)

  async function save() {
    setPending(true)
    setError("")
    try {
      const copy = await duplicateOwnedCampaign(id, value)
      router.push(`/app/campaigns/${copy.id}#editor`)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "That copy could not be started.")
      setPending(false)
    }
  }

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="min-h-11 text-sm text-[#8ecfff] underline">
        Duplicate
      </button>
    )
  }

  return (
    <div className="flex flex-col gap-2">
      <label className="text-sm">
        Name this copy
        <input
          value={value}
          onChange={(event) => setValue(event.target.value)}
          className="mt-1 min-h-11 w-full rounded-lg border border-[#245068] bg-white px-3 text-[#041018]"
        />
      </label>
      {error ? <p className="text-sm text-[#f6d48a]">{error}</p> : null}
      <div className="flex gap-3">
        <button type="button" onClick={() => void save()} disabled={pending} className="min-h-11 rounded-lg bg-[#5ce1ff] px-3 text-sm font-semibold text-[#041018] disabled:opacity-40">
          {pending ? "Copying…" : "Open the design"}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="min-h-11 text-sm text-[#8ecfff]">
          Cancel
        </button>
      </div>
    </div>
  )
}

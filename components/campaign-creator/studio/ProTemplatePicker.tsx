"use client"

import { useState } from "react"

import { chooseRoofingProTemplate } from "@/lib/campaign-creator/actions"
import type { Campaign } from "@/lib/campaign-creator/types"
import { ROOFING_PRO_AVAILABLE_IDS, ROOFING_PRO_META, type RoofingProTemplateId } from "@/lib/roofing-pro/ids"
import { cn } from "@/lib/utils"

export function ProTemplatePicker({
  campaignId,
  current,
  onApplied,
}: {
  campaignId: string
  current?: string
  onApplied: (campaign: Campaign) => void
}) {
  const [pending, setPending] = useState<RoofingProTemplateId | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function choose(id: RoofingProTemplateId) {
    if (pending || id === current) return
    setPending(id)
    setError(null)
    try {
      onApplied(await chooseRoofingProTemplate(campaignId, id))
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "That layout could not be applied.")
    } finally {
      setPending(null)
    }
  }

  return (
    <div className="flex max-w-lg flex-col gap-2">
      <p className="text-sm font-medium">Pro templates</p>
      <p className="text-sm text-muted-foreground">
        The layout is already designed. Your headline, offer, and phone fill it in.
      </p>
      <div className="flex flex-wrap gap-2" role="group" aria-label="Pro templates">
        {ROOFING_PRO_AVAILABLE_IDS.map((id) => {
          const meta = ROOFING_PRO_META[id]
          const pressed = current === id
          return (
            <button
              key={id}
              type="button"
              aria-pressed={pressed}
              disabled={pending !== null}
              title={meta.summary}
              onClick={() => void choose(id)}
              className={cn(
                "rounded-full border px-3 py-1 text-sm transition-colors focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                pressed ? "border-foreground bg-foreground text-background" : "border-border hover:bg-muted/60"
              )}
            >
              {pending === id ? "Applying…" : meta.name}
            </button>
          )
        })}
      </div>
      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  )
}

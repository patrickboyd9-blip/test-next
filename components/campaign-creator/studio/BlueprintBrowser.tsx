"use client"

import { useState } from "react"

import { Button } from "@/components/ui/button"
import {
  applyCampaignBlueprint,
  browseBlueprints,
  type BlueprintBrowseCard,
} from "@/lib/campaign-creator/actions"
import type { Campaign } from "@/lib/campaign-creator/types"

import { BlueprintWireframe } from "./BlueprintWireframe"

const VERTICALS = ["roofing", "hvac", "plumbing", "real_estate", "medicare", "solar", "dental", "pest_control", "landscaping", "restaurant", "home_services", "general"]
const TONES = ["urgent", "professional", "fearful", "joyful", "luxury", "friendly", "scarcity", "calm"]

/**
 * Browse structure, then rebuild the selected concept from it.
 * Customers see a wireframe. An internal owner may also see the source photograph.
 */
export function BlueprintBrowser({
  campaignId,
  onApplied,
}: {
  campaignId: string
  onApplied: (campaign: Campaign) => void
}) {
  const [open, setOpen] = useState(false)
  const [vertical, setVertical] = useState("")
  const [tone, setTone] = useState("")
  const [cards, setCards] = useState<BlueprintBrowseCard[]>([])
  const [status, setStatus] = useState("")
  const [busy, setBusy] = useState(false)

  async function load(nextVertical = vertical, nextTone = tone) {
    setBusy(true)
    setStatus("")
    try {
      const next = await browseBlueprints({ campaignId, vertical: nextVertical, tone: nextTone })
      setCards(next)
      if (next.length === 0) setStatus("No blueprints match that filter yet.")
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "The library could not be opened.")
    } finally {
      setBusy(false)
    }
  }

  async function generateFromBlueprint(id: string) {
    setBusy(true)
    setStatus("")
    try {
      const updated = await applyCampaignBlueprint(campaignId, id)
      onApplied(updated)
      setStatus(`Blueprint: ${id}`)
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "That blueprint could not be applied.")
    } finally {
      setBusy(false)
    }
  }

  if (!open) {
    return (
      <Button
        variant="outline"
        onClick={() => {
          setOpen(true)
          void load()
        }}
      >
        Use a blueprint
      </Button>
    )
  }

  return (
    <section className="flex flex-col gap-3 rounded-xl border border-border p-4">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold">Use a blueprint</h3>
        <Button variant="link" className="h-auto p-0 text-sm" onClick={() => setOpen(false)}>
          Close
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        The structure of a real mailer, rebuilt with this campaign&apos;s words, colors, and a new photograph.
      </p>
      <div className="flex flex-wrap gap-2">
        <select
          className="rounded-md border border-border bg-background px-2 py-1 text-sm"
          value={vertical}
          onChange={(event) => {
            setVertical(event.target.value)
            void load(event.target.value, tone)
          }}
          aria-label="Vertical"
        >
          <option value="">Any vertical</option>
          {VERTICALS.map((item) => (
            <option key={item} value={item}>{item.replaceAll("_", " ")}</option>
          ))}
        </select>
        <select
          className="rounded-md border border-border bg-background px-2 py-1 text-sm"
          value={tone}
          onChange={(event) => {
            setTone(event.target.value)
            void load(vertical, event.target.value)
          }}
          aria-label="Tone"
        >
          <option value="">Any tone</option>
          {TONES.map((item) => (
            <option key={item} value={item}>{item}</option>
          ))}
        </select>
      </div>
      {status ? <p className="text-xs text-muted-foreground">{status}</p> : null}
      <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {cards.map((card) => (
          <li key={card.id} className="flex flex-col gap-2 rounded-lg border border-border p-3">
            {card.thumb ? (
              <img
                alt=""
                className="aspect-[8/5] w-full rounded-md object-cover"
                src={`data:${card.thumb.mediaType};base64,${card.thumb.base64}`}
              />
            ) : (
              <BlueprintWireframe boxes={card.boxes} />
            )}
            <p className="text-xs font-medium">Blueprint: {card.id}</p>
            <p className="text-xs text-muted-foreground">{card.tone} · {card.vertical.replaceAll("_", " ")} · {card.grade}</p>
            <Button size="sm" disabled={busy} onClick={() => void generateFromBlueprint(card.id)}>
              Generate from this
            </Button>
          </li>
        ))}
      </ul>
    </section>
  )
}

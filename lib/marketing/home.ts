import { galleryPhotoSrc } from "@/lib/mail-templates/gallery-photo-src"
import { getMailTemplate, listMailTemplates } from "@/lib/mail-templates/query"
import { buildQuote, readApprovedSchedule } from "@/lib/mail-journey/pricing"

export const HOME_SAMPLE_IDS = [
  "dental-first-visit",
  "restaurant-grand-opening",
  "auto-repair-brake-check",
  "hvac-scene-01",
  "realestate-home-value",
  "restaurant-scene-04",
] as const

export interface HomeSample {
  id: string
  name: string
  summary: string
  src: string
}

export type HomePrice =
  | { ready: true; amount: string; note: string }
  | { ready: false; amount: "See pricing at checkout"; note: string }

const FULL_PRICE_NOTE = "Full price per piece. Printing, postage, and the list. Not postage by itself."

/** A public per-piece price only when an approved schedule is in force. */
export function homePrice(env: NodeJS.ProcessEnv = process.env, nowIso = new Date().toISOString()): HomePrice {
  const quote = buildQuote(readApprovedSchedule(env), 1, nowIso)
  if (!quote.ok) {
    return { ready: false, amount: "See pricing at checkout", note: "A full price is shown at checkout. Nothing is mailed until you approve it." }
  }
  const amount = (quote.quote.perPieceCents / 100).toLocaleString("en-US", { style: "currency", currency: "USD" })
  return { ready: true, amount, note: FULL_PRICE_NOTE }
}

export function homeSamples(): HomeSample[] {
  const known = new Map(listMailTemplates().map((template) => [template.id, template]))
  const samples: HomeSample[] = []
  for (const id of HOME_SAMPLE_IDS) {
    const template = known.get(id) ?? getMailTemplate(id)
    const src = galleryPhotoSrc(id)
    if (!template || !src) continue
    samples.push({ id, name: template.name, summary: template.summary, src })
  }
  return samples
}

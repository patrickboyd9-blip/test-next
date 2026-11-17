import { buildOpenAIImagePrompt, servicePhotoPromptFailures } from "@/lib/campaign-creator/photography-shot-list"
import { IMAGEN_ESTIMATED_USD } from "@/lib/campaign-creator/replicate-image-generation"
import { toImageBrief, type ImageBrief } from "@/lib/campaign-creator/image-brief"
import type { CreativeSpec } from "@/lib/campaign-creator/types"

import { galleryV1 } from "./gallery-v1"
import type { MailTemplate } from "./types"

/** One photograph for every gallery template. */
export const GALLERY_PHOTO_COUNT = 24
/** Stop before the next photo once the running total would pass this. */
export const GALLERY_PHOTO_STOP_CENTS = 650
/** Do not start a photo that would put the running total over this. */
export const GALLERY_PHOTO_HARD_CAP_CENTS = 700
export const GALLERY_PHOTO_ESTIMATE_CENTS = Math.round(IMAGEN_ESTIMATED_USD * 100)

export type GallerySpendDecision = "ok" | "stop" | "ceiling"

export interface GalleryPhotoJob {
  templateId: string
  industry: string
  fileName: string
  publicPath: string
  prompt: string
  brief: ImageBrief
}

export interface GallerySpendEntry {
  templateId: string
  usd: string
  at: string
  status: "saved" | "failed"
}

export interface GallerySpendLog {
  currency: "USD"
  stopAtUsd: string
  hardCapUsd: string
  estimateUsd: string
  totalUsd: string
  entries: GallerySpendEntry[]
}

const TRADE_SCENE: Record<string, string> = {
  roofing: "A residential asphalt-shingle roof in late daylight, with flashing and a gutter. No people.",
  hvac: "An outdoor air-conditioner condenser beside a house wall. No people.",
  restaurant: "A pizza on a wooden table in a small dining room. No people and no readable menu.",
  dental: "A bright dental treatment room with a chair and a window. No people and no readable charts.",
  real_estate: "The front of a lived-in house, a walkway, and a tree. No sign and no people.",
  landscaping: "A mowed front lawn and a trimmed hedge beside a house. No people.",
  auto_repair: "A brake rotor on a lift in a clean service bay. No logo, no face, and no text.",
  cleaning: "A sunlit living room with a wood floor and a sofa after cleaning. No people and no labeled bottles.",
}

export function emptyGallerySpendLog(): GallerySpendLog {
  return {
    currency: "USD",
    stopAtUsd: usdFromCents(GALLERY_PHOTO_STOP_CENTS),
    hardCapUsd: usdFromCents(GALLERY_PHOTO_HARD_CAP_CENTS),
    estimateUsd: usdFromCents(GALLERY_PHOTO_ESTIMATE_CENTS),
    totalUsd: usdFromCents(0),
    entries: [],
  }
}

export function usdFromCents(cents: number): string {
  const abs = Math.abs(cents)
  return `${cents < 0 ? "-" : ""}${(abs / 100).toFixed(2)}`
}

export function centsFromUsd(usd: string): number {
  const value = Number(usd)
  if (!Number.isFinite(value)) return 0
  return Math.round(value * 100)
}

/** Whether another photo at `nextCents` may start. */
export function gallerySpendDecision(spentCents: number, nextCents: number): GallerySpendDecision {
  if (spentCents >= GALLERY_PHOTO_HARD_CAP_CENTS || spentCents + nextCents > GALLERY_PHOTO_HARD_CAP_CENTS) return "ceiling"
  if (spentCents >= GALLERY_PHOTO_STOP_CENTS || spentCents + nextCents > GALLERY_PHOTO_STOP_CENTS) return "stop"
  return "ok"
}

/** The charge is already counted. Stop when the total reaches the soft cap or passes the ceiling. */
export function gallerySpendAfter(spentCents: number, actualCents: number): { spentCents: number; decision: GallerySpendDecision } {
  const next = spentCents + actualCents
  if (next > GALLERY_PHOTO_HARD_CAP_CENTS) return { spentCents: next, decision: "ceiling" }
  if (next >= GALLERY_PHOTO_STOP_CENTS) return { spentCents: next, decision: "stop" }
  return { spentCents: next, decision: "ok" }
}

export function planGalleryPhotos(templates: readonly MailTemplate[] = galleryV1()): GalleryPhotoJob[] {
  if (templates.length !== GALLERY_PHOTO_COUNT) {
    throw new Error(`Expected ${GALLERY_PHOTO_COUNT} gallery templates. Found ${templates.length}.`)
  }
  return templates.map((template) => {
    const brief = galleryPhotoBrief(template)
    const prompt = buildOpenAIImagePrompt(brief)
    const failures = servicePhotoPromptFailures(prompt)
    if (failures.length > 0) {
      throw new Error(`${template.id} prompt is not ready: ${failures.join(", ")}`)
    }
    return {
      templateId: template.id,
      industry: template.industry,
      fileName: `${template.id}.png`,
      publicPath: `/gallery/${template.id}.png`,
      prompt,
      brief,
    }
  })
}

function galleryPhotoBrief(template: MailTemplate): ImageBrief {
  const role = template.spec.imageryRole
  const photographic = role === "consequence" || role === "neighborhood" || role === "crew"
  const scene = TRADE_SCENE[template.industry] ?? `${template.industry.replace(/_/g, " ")} work on an ordinary property. No people.`
  const spec: CreativeSpec = photographic
    ? template.spec
    : {
        ...template.spec,
        imageryRole: "neighborhood",
        layoutVariant: "image_grounded",
        visualDirection: scene,
      }
  const brief = toImageBrief(spec, { variationKey: template.id })
  if (!brief) {
    throw new Error(`No photograph brief for ${template.id}.`)
  }
  return {
    ...brief,
    artDirection: {
      ...brief.artDirection,
      refuse: `${brief.artDirection.refuse} Do not crop a face. No logos and no lettering.`,
    },
  }
}

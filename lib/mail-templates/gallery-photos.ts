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

const SCENE_LOCK = "Single photograph, one scene, not a collage, no split screen."

const TRADE_SCENE: Record<string, string> = {
  roofing: "A residential asphalt-shingle roof in late daylight, with metal flashing and a copper gutter, the roof empty, no people.",
  hvac: "An outdoor air-conditioner condenser sitting alone on its pad beside a house wall, no people.",
  restaurant: "A freshly baked pizza on a wooden table in a small empty restaurant dining room, no people and no readable menu.",
  dental: "A bright modern dental exam room with a dental chair, an overhead examination light, and a window, the room empty, no people and no readable charts.",
  real_estate: "The front of a well-kept lived-in house, a walkway, a front porch, and a shade tree, no sign and no people.",
  landscaping: "A freshly mowed front lawn and a neatly trimmed green hedge beside a well-kept house, no people.",
  auto_repair: "A brake rotor on a car raised on a lift in a clean empty service bay, the bay unoccupied, no people and no logos.",
  cleaning: "A sunlit living room with a clean wood floor and a sofa after cleaning, no people and no labeled bottles.",
}

/** Subject-first empty scenes for each gallery photograph. */
const TEMPLATE_SCENE: Record<string, string> = {
  "roofing-free-inspection":
    "A quiet residential street of asphalt-shingle rooftops after rain, wet dark shingles and gutters gleaming, the street empty, no people.",
  "roofing-after-the-storm":
    "A single residential asphalt-shingle roof after a rainstorm, wet shingles, a soaked blue tarp over one damaged patch, and a clear sky, the roof empty, no people.",
  "roofing-book-a-check":
    "A residential asphalt-shingle roof in late daylight, with metal flashing, a copper gutter, and a small stack of new shingles, the roof empty, no people.",
  "hvac-same-day-cooling":
    "An outdoor air-conditioner condenser sitting idle beside a shaded house wall in late afternoon, service valves capped, the yard empty, no people.",
  "hvac-before-the-heat":
    "An outdoor air-conditioner condenser in the shade beside a house in late spring light, the equipment pad unoccupied, no people.",
  "hvac-quiet-fix":
    "A close view of a residential outdoor air-conditioner condenser beside a vinyl house wall, the unit alone on its concrete pad, no people.",
  "restaurant-grand-opening":
    "A warmly lit small restaurant dining room with wooden tables set for dinner, plates and glasses ready, the room empty, no people.",
  "restaurant-weeknight":
    "A small restaurant dining room with a wooden table set for two in evening window light, plates and glasses, the room empty, no people.",
  "restaurant-catering":
    "A freshly baked pizza on a wooden table in a small empty restaurant dining room, no people and no readable menu.",
  "dental-first-visit":
    "A bright modern dental exam room with a dental chair and overhead examination light, a window, the room empty, no people.",
  "dental-whitening":
    "A sunlit dental office waiting room with a single upholstered chair and a potted plant by the window, the room empty, no people.",
  "dental-call-the-office":
    "A bright modern dental exam room with a dental chair, an instrument tray, and a window, the room empty, no people and no readable charts.",
  "realestate-home-value":
    "The finished front porch and tidy concrete walkway of a well-kept lived-in house in late afternoon light, a shade tree on a mowed lawn, the property complete and empty, no construction materials, no bags, no lettering, no signs, and no people.",
  "realestate-just-listed":
    "An attractive finished move-in-ready single-family house exterior on a quiet residential street in warm late afternoon light, a tidy front walkway, a freshly mowed lawn, and a shade tree, the property complete and ready to show, no ladders, no construction, no tools, no drop cloths, no building materials, no roof work, no signs, no lettering, and no people. Single photograph, one scene, not a collage.",
  "realestate-thinking-of-selling":
    "The finished front of an attractive move-in-ready lived-in house with a front porch, a tidy walkway, and a shade tree on a mowed lawn in late-day sun, the property complete and ready to show, no ladders, no roof work, no construction, no tools, no stacked shingles, no drop cloths, no signs, no lettering, and no people. Single photograph, one scene, not a collage.",
  "landscaping-spring-cleanup":
    "A tidy front yard with a mowed lawn, fresh dark mulch beds, and a wheelbarrow of mulch at rest in morning light, no people.",
  "landscaping-lawn-plan":
    "A freshly cut green front lawn along a concrete sidewalk in late-day sun, ordinary houses in the background, no people.",
  "landscaping-backyard-light":
    "A freshly mowed front lawn and a neatly trimmed green hedge beside a well-kept house, gardening tools at rest on the grass, no people.",
  "auto-repair-brake-check":
    "A close view of a rusty brake rotor and caliper on a car raised on a two-post lift in a clean empty service bay, no people and no logos.",
  "auto-repair-oil-service":
    "A close side view looking into an open engine compartment during an oil change in a bright empty auto service bay, an oil drain pan on the concrete floor under the engine, only the engine, the underside of the open hood, and nearby concrete visible, the front bumper, grille, headlights, and any manufacturer emblem or badge kept completely out of the frame, no license plate, no brand logos, no readable bottle labels, no lettering, the bay unoccupied, no people. Single photograph, one scene, not a collage.",
  "auto-repair-inspection":
    "A close view of a brake rotor and caliper on a car raised on a two-post lift in a clean empty auto service bay, an impact wrench resting unused on the floor, the bay unoccupied, no people, no hands, no arms, and no logos.",
  "cleaning-first-visit":
    "A sunlit kitchen with a spotless tile counter and a clean empty sink after a finished cleaning, no people and no labeled bottles.",
  "cleaning-move-out":
    "An empty sunlit room with freshly cleaned wood floors and a yellow mop bucket at the edge, no people.",
  "cleaning-weekly":
    "A sunlit living room with a clean wood floor and a sofa after cleaning, a coffee table with books, no people and no labeled bottles.",
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
      fileName: `${template.id}.jpg`,
      publicPath: `/gallery/${template.id}.jpg`,
      prompt,
      brief,
    }
  })
}

function galleryScene(template: MailTemplate): string {
  return (
    TEMPLATE_SCENE[template.id] ??
    TRADE_SCENE[template.industry] ??
    `${template.industry.replace(/_/g, " ")} work on an ordinary empty property. No people.`
  )
}

function galleryPhotoBrief(template: MailTemplate): ImageBrief {
  const role = template.spec.imageryRole
  const photographic = role === "consequence" || role === "neighborhood" || role === "crew"
  const scene = galleryScene(template)
  const spec: CreativeSpec = {
    ...(photographic ? template.spec : { ...template.spec, imageryRole: "neighborhood", layoutVariant: "image_grounded" }),
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
      refuse: `${brief.artDirection.refuse} Do not crop a face. No logos and no lettering. ${SCENE_LOCK} The scene is empty: no workers, no hands, no arms, no faces.`,
    },
  }
}

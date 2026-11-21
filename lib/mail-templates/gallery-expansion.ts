import { buildOpenAIImagePrompt, servicePhotoPromptFailures } from "@/lib/campaign-creator/photography-shot-list"
import { toImageBrief, type ImageBrief } from "@/lib/campaign-creator/image-brief"
import type { CreativeSpec } from "@/lib/campaign-creator/types"
import { RESEARCH_TASTE_PACK } from "@/lib/reference-corpus/taste-pack"
import type { ReferenceCard } from "@/lib/reference-corpus/reference-card"

import { EXPANSION_SCENES } from "./gallery-expansion-scenes"
import type { MailTemplate } from "./types"

/** Customer trades for the next gallery. Research names are mapped, not copied. */
export const GALLERY_VERTICALS = [
  "roofing",
  "hvac",
  "restaurant",
  "dental",
  "real_estate",
  "landscaping",
  "auto_repair",
  "cleaning",
] as const

export type GalleryVertical = (typeof GALLERY_VERTICALS)[number]

const RESEARCH_FOR: Record<GalleryVertical, readonly string[]> = {
  roofing: ["roofing"],
  hvac: ["hvac"],
  restaurant: ["restaurant", "pizza_qsr"],
  dental: ["dental"],
  real_estate: [],
  landscaping: ["landscaping"],
  auto_repair: [],
  cleaning: ["exterior_cleaning"],
}

export const FAVORITE_SOURCE_IDS = ["PM-066", "PM-067", "PM-068", "PM-069", "PM-070"] as const
export const ITEMS_PER_VERTICAL = 18
export const IMAGES_PER_ITEM = 1
export const CENTS_PER_IMAGE = 15
/** Hard ceiling. A request that would pass this amount must not start. */
export const EXPANSION_HARD_CAP_CENTS = 2200

const PALETTE: Record<GalleryVertical, string[]> = {
  roofing: ["#3d4a3a", "#d7c4a3", "#f4efe6"],
  hvac: ["#1f3a4d", "#8fb8c9", "#f7f4ee"],
  restaurant: ["#6b2d1a", "#e7c98a", "#f7f1e8"],
  dental: ["#d7ebe8", "#1e3a4c", "#f7fbfa"],
  real_estate: ["#5c6b4a", "#e6d7c3", "#f7f4ee"],
  landscaping: ["#1f4d32", "#c4d7a3", "#f4f7ef"],
  auto_repair: ["#3a3a3a", "#e36a2e", "#f4f1ea"],
  cleaning: ["#d9e4ea", "#3d5a66", "#f7fbfc"],
}

const SHOP: Record<GalleryVertical, string> = {
  roofing: "Local Roof Care",
  hvac: "Local Comfort",
  restaurant: "Local Table",
  dental: "Local Dental",
  real_estate: "Local Homes",
  landscaping: "Local Yard",
  auto_repair: "Local Garage",
  cleaning: "Local Clean",
}

export interface GalleryExpansionSlot {
  id: string
  vertical: GalleryVertical
  name: string
  headline: string
  scene: string
  prompt: string
  brief: ImageBrief
  sourceId: string | null
  tier: number
  images: 1
  fileName: string
  publicPath: string
}

export interface GalleryExpansionPlan {
  items: GalleryExpansionSlot[]
  images: number
  estimatedCents: number
  capCents: number
  status: "ready"
}

export function sourceTier(id: string): number {
  const index = FAVORITE_SOURCE_IDS.indexOf(id as (typeof FAVORITE_SOURCE_IDS)[number])
  return index === -1 ? FAVORITE_SOURCE_IDS.length : index
}

/** Whether another picture at `nextCents` may start. Equal to the cap is allowed. Past it is not. */
export function expansionSpendDecision(spentCents: number, nextCents = CENTS_PER_IMAGE): "ok" | "ceiling" {
  if (spentCents + nextCents > EXPANSION_HARD_CAP_CENTS) return "ceiling"
  return "ok"
}

export function planGalleryExpansion(cards: readonly ReferenceCard[] = RESEARCH_TASTE_PACK): GalleryExpansionPlan {
  const items: GalleryExpansionSlot[] = []
  for (const vertical of GALLERY_VERTICALS) {
    const scenes = EXPANSION_SCENES[vertical]
    if (scenes.length !== ITEMS_PER_VERTICAL) {
      throw new Error(`${vertical} needs ${ITEMS_PER_VERTICAL} scenes.`)
    }
    const sources = cards
      .filter((card) => RESEARCH_FOR[vertical].includes(card.vertical))
      .slice()
      .sort((a, b) => sourceTier(a.mmrId) - sourceTier(b.mmrId) || a.mmrId.localeCompare(b.mmrId))
    scenes.forEach(([headline, scene], index) => {
      const source = sources.length > 0 ? sources[index % sources.length] : undefined
      const id = `${vertical.replace(/_/g, "-")}-scene-${String(index + 1).padStart(2, "0")}`
      const picture = expansionPicture(id, headline, scene)
      items.push({
        id,
        vertical,
        name: headline,
        headline,
        scene,
        prompt: picture.prompt,
        brief: picture.brief,
        sourceId: source?.mmrId ?? null,
        tier: source ? sourceTier(source.mmrId) : sourceTier("none"),
        images: 1,
        fileName: `${id}.jpg`,
        publicPath: `/gallery/${id}.jpg`,
      })
    })
  }
  const images = items.length * IMAGES_PER_ITEM
  return {
    items,
    images,
    estimatedCents: images * CENTS_PER_IMAGE,
    capCents: EXPANSION_HARD_CAP_CENTS,
    status: "ready",
  }
}

export function favoriteIdsInOrder(): readonly string[] {
  return [...FAVORITE_SOURCE_IDS]
}

export function expansionTemplates(): MailTemplate[] {
  return planGalleryExpansion().items.map((item) => expansionTemplate(item))
}

function expansionTemplate(item: GalleryExpansionSlot): MailTemplate {
  const spec: CreativeSpec = {
    layoutVariant: "image_grounded",
    headline: item.headline,
    subheadline: "A plain offer for a neighbor.",
    body: "The words sit on their own layer. The picture has none.",
    callToAction: "Ask for a visit",
    offer: item.headline,
    phone: "(555) 010-0199",
    website: "https://local.example/visit",
    qrDestination: "https://local.example/visit",
    visualDirection: item.scene,
    tone: "Plain",
    palette: PALETTE[item.vertical],
    imagery: "stock_generic_local",
    leadJob: "offer",
    imageryRole: "neighborhood",
    backLayout: "standard_address",
  }
  return {
    id: item.id,
    industry: item.vertical,
    name: item.name,
    summary: "An original empty scene. The words are a separate layer.",
    sampleBusinessName: SHOP[item.vertical],
    size: "5x8",
    spec,
    sourcePatternId: item.sourceId ? `research/${item.sourceId}` : undefined,
    layoutRecipe: "split-photo",
  }
}

function expansionPicture(id: string, headline: string, scene: string): { prompt: string; brief: ImageBrief } {
  const spec: CreativeSpec = {
    layoutVariant: "image_grounded",
    headline,
    subheadline: "",
    body: "",
    callToAction: "Ask for a visit",
    offer: "A quiet visit",
    visualDirection: scene,
    imageryRole: "neighborhood",
    leadJob: "offer",
    backLayout: "standard_address",
  }
  const brief = toImageBrief(spec, { variationKey: id })
  if (!brief) throw new Error(`No picture brief for ${id}.`)
  brief.artDirection = {
    ...brief.artDirection,
    subject: scene,
    refuse: `${brief.artDirection.refuse} No logos and no lettering. No people, no hands, no faces. Single photograph, one scene, not a collage, no split screen.`,
  }
  brief.visualDirection = scene
  const prompt = buildOpenAIImagePrompt(brief)
  const failures = servicePhotoPromptFailures(prompt)
  if (failures.length > 0) throw new Error(`${id} prompt is not ready: ${failures.join(", ")}`)
  return { prompt, brief }
}

import type { CreativeSpec } from "@/lib/campaign-creator/types"

import finishedJson from "./gallery-finished.json"
import { isTemplateIndustry, TEMPLATE_INDUSTRY_LABELS, type MailTemplate, type TemplateIndustry } from "./types"

/** Every picture in gallery-finished.json is a finished postcard, words included. */
export const FINISHED_GALLERY_KIND = "finished" as const

/** A finished example mailer. Research ids and file paths are not stored here. */
export interface FinishedGalleryRecord {
  id: string
  /** Source slug, such as vet-pet. */
  industry: string
  fictional_brand_name: string
  name_risk: string | null
  /** Card title when this example has its own line. Otherwise the gallery numbers it. */
  name?: string
  /** One sentence when this example has its own line. */
  summary?: string
  url: string
  /** Address side, when this example includes one. */
  back_url?: string
  width: number
  height: number
}

/**
 * Readable labels for the finished set. Existing catalog industries keep the
 * label they already use. The four compound names follow the gallery brief.
 */
export const FINISHED_INDUSTRY_LABELS: Record<string, string> = {
  "auto-insurance": "Auto insurance",
  "auto-parts": "Auto parts",
  bakery: "Bakery",
  beauty: "Beauty",
  "churches-community": "Churches & Community",
  "consumer-products": "Consumer Products",
  "garage-doors": "Garage Doors",
  "gyms-fitness": "Gyms & Fitness",
  "hair-salon": "Hair Salon",
  handyman: "Handyman",
  "home-buying": "Home Buying",
  "home-insurance": "Home Insurance",
  "home-remodeling": "Home Remodeling",
  "home-security": "Home Security",
  "junk-removal": "Junk Removal",
  laundromat: "Laundromat",
  "life-insurance": "Life Insurance",
  "med-spa": "Med Spa",
  "med-spa-chiro": "Med Spa & Chiro",
  medicare: "Medicare",
  "mortgage-financial": "Mortgage & Financial",
  "moving-storage": "Moving & Storage",
  optometry: "Optometry",
  "outdoor-living": "Outdoor Living",
  "pest-control": "Pest Control",
  plumbing: "Plumbing",
  "precious-metals": "Precious Metals",
  "retail-grand-openings": "Retail & Grand Openings",
  sauna: "Sauna",
  skincare: "Skincare",
  "senior-living": "Senior Living",
  solar: "Solar",
  "tutoring-childcare": "Tutoring & Childcare",
  "vet-pet": "Vet & Pet",
  "windows-gutters-siding": "Windows, Gutters & Siding",
}

const finishedFile = finishedJson as { kind?: string; items: FinishedGalleryRecord[] }

if (finishedFile.kind !== FINISHED_GALLERY_KIND) {
  throw new Error("Finished gallery data must be marked kind finished.")
}

const records = finishedFile.items

export function finishedGalleryRecords(): FinishedGalleryRecord[] {
  return records
}

/** Gallery industry id. auto-insurance and plumbing match the catalog ids. */
export function finishedIndustryId(slug: string): string {
  return slug.replaceAll("-", "_")
}

/** Label for a gallery industry id or a finished-set slug. */
export function galleryIndustryLabel(industry: string): string {
  const id = industry.replaceAll("-", "_")
  if (isTemplateIndustry(id)) return TEMPLATE_INDUSTRY_LABELS[id]
  const slug = id.replaceAll("_", "-")
  const label = FINISHED_INDUSTRY_LABELS[slug]
  if (!label) throw new Error(`No gallery label for ${industry}.`)
  return label
}

export interface FinishedGalleryPhoto {
  id: string
  name: string
  summary: string
  src: string
  /** Address side. Omitted when the example has no separate back. */
  backSrc?: string
  /**
   * CSS aspect ratio when the picture is wider than the 8×5 card frame.
   * The gallery uses it so a wide card is not cropped.
   */
  aspect?: string
  industry: string
  /** Flat finished art. The words are already in the picture. */
  kind: typeof FINISHED_GALLERY_KIND
}

const SUMMARY = "A finished postcard in this industry."
/** Gallery thumbnails use an 8×5 frame. Wider art keeps its own ratio. */
const CARD_FRAME = 8 / 5

/**
 * Customer-facing photos. The brand stays on the record, the same way other
 * gallery photos keep the sample business off the card. name_risk stays off too.
 */
export function finishedGalleryPhotos(): FinishedGalleryPhoto[] {
  const seen = new Map<string, number>()
  return records.map((record) => {
    const industry = finishedIndustryId(record.industry)
    const number = (seen.get(industry) ?? 0) + 1
    seen.set(industry, number)
    const photo: FinishedGalleryPhoto = {
      id: record.id,
      name: record.name ?? `Postcard ${number}`,
      summary: record.summary ?? SUMMARY,
      src: record.url,
      industry,
      kind: FINISHED_GALLERY_KIND,
    }
    if (record.back_url) photo.backSrc = record.back_url
    if (record.width / record.height > CARD_FRAME) photo.aspect = `${record.width} / ${record.height}`
    return photo
  })
}

const photosById = new Map(finishedGalleryPhotos().map((photo) => [photo.id, photo]))

export function finishedGalleryPhoto(id: string): FinishedGalleryPhoto | null {
  return photosById.get(id) ?? null
}

const brandById = new Map(
  records.map((record) => [record.id, record.fictional_brand_name.replace(/\s+/g, " ").trim()] as const)
)

/** Printed brand on a finished gallery card. For the edit request only. Not shown in the gallery. */
export function finishedGalleryBrandName(id: string): string | null {
  const name = brandById.get(id) ?? ""
  return name.length >= 2 ? name : null
}

const spec: CreativeSpec = {
  layoutVariant: "image_grounded",
  headline: "Ready when you are",
  subheadline: "Add your own line.",
  body: "The picture stays the one you picked.",
  callToAction: "Call to book a visit",
  offer: "A local offer",
  phone: "(555) 010-0199",
  website: "https://local.example/visit",
  qrDestination: "https://local.example/visit",
  visualDirection: "The finished gallery photograph.",
  tone: "Plain",
  palette: ["#102033", "#c4922a", "#f7f4ee"],
  imagery: "stock_generic_local",
  leadJob: "offer",
  imageryRole: "neighborhood",
  backLayout: "standard_address",
}

/** A catalog-shaped mailer so the two gallery choices can open this picture. */
export function finishedMailTemplate(id: string): MailTemplate | null {
  const photo = photosById.get(id)
  if (!photo) return null
  return {
    id: photo.id,
    industry: photo.industry as TemplateIndustry,
    name: photo.name,
    summary: photo.summary,
    sampleBusinessName: "Local business",
    size: "5x8",
    spec: { ...spec, palette: spec.palette?.slice() },
    layoutRecipe: "split-photo",
  }
}

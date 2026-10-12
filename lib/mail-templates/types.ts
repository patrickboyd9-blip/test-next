import type { CreativeSpec } from "@/lib/campaign-creator/types"

/**
 * Industries a customer can browse. New industries are added here and as
 * records in the catalog. The gallery does not hardcode a card per mailer.
 */
export const TEMPLATE_INDUSTRIES = [
  "roofing",
  "hvac",
  "restaurant",
  "auto_insurance",
  "plumbing",
  "dental",
  "real_estate",
  "landscaping",
] as const

export type TemplateIndustry = (typeof TEMPLATE_INDUSTRIES)[number]

export const TEMPLATE_INDUSTRY_LABELS: Record<TemplateIndustry, string> = {
  roofing: "Roofing",
  hvac: "HVAC",
  restaurant: "Restaurant",
  auto_insurance: "Auto insurance",
  plumbing: "Plumbing",
  dental: "Dental",
  real_estate: "Real estate",
  landscaping: "Landscaping",
}

/**
 * Studio templates are composed for the locked 5×8 postcard.
 * Bleed, trim, and the address-side keep-out stay on POSTCARD_5X8_V1.
 * The 6×9 print spec is a separate geometry and is not rewritten here.
 */
export type TemplateSize = "5x8"

/** A mailer a customer can start from. One record, not a screen. */
export interface MailTemplate {
  id: string
  industry: TemplateIndustry
  name: string
  /** One sentence shown in the gallery. */
  summary: string
  /** Sample name on the card until the customer replaces it in the editor. */
  sampleBusinessName: string
  size: TemplateSize
  spec: CreativeSpec
}

export function isTemplateIndustry(value: string): value is TemplateIndustry {
  return (TEMPLATE_INDUSTRIES as readonly string[]).includes(value)
}

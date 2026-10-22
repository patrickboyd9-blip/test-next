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
 * Addressed templates stay on the locked 5×8 postcard.
 * EDDM templates use a 6.5×9 or 6.25×11 flat.
 */
export type TemplateSize = "5x8" | "6.5x9" | "6.25x11"

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

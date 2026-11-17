import { listMailTemplates } from "./query"
import type { MailTemplate } from "./query"
import type { TemplateIndustry } from "./types"

/** The eight industries in this gallery. Add a slug here when a later set is ready. */
export const GALLERY_V1_INDUSTRIES = [
  "roofing",
  "hvac",
  "restaurant",
  "dental",
  "real_estate",
  "landscaping",
  "auto_repair",
  "cleaning",
] as const satisfies readonly TemplateIndustry[]

/**
 * Structure borrowed from the gold research files. Words and pictures are not.
 * The id names the file and the layout, not a copied headline.
 */
const PATTERN: Record<string, { sourcePatternId: string; layoutRecipe: NonNullable<MailTemplate["layoutRecipe"]> }> = {
  "roofing-free-inspection": { sourcePatternId: "gold/roofing.json#offer-bar", layoutRecipe: "offer-bar" },
  "roofing-after-the-storm": { sourcePatternId: "gold/roofing.json#split-photo", layoutRecipe: "split-photo" },
  "roofing-book-a-check": { sourcePatternId: "gold/roofing.json#type-led", layoutRecipe: "type-led" },
  "hvac-same-day-cooling": { sourcePatternId: "gold/hvac.json#offer-bar", layoutRecipe: "offer-bar" },
  "hvac-before-the-heat": { sourcePatternId: "gold/hvac.json#split-photo", layoutRecipe: "split-photo" },
  "hvac-quiet-fix": { sourcePatternId: "gold/hvac.json#type-led", layoutRecipe: "type-led" },
  "restaurant-grand-opening": { sourcePatternId: "gold/restaurants-food.json#offer-bar", layoutRecipe: "offer-bar" },
  "restaurant-weeknight": { sourcePatternId: "gold/restaurants-food.json#split-photo", layoutRecipe: "split-photo" },
  "restaurant-catering": { sourcePatternId: "gold/restaurants-food.json#coupon-band", layoutRecipe: "coupon-band" },
  "dental-first-visit": { sourcePatternId: "gold/dental.json#split-photo", layoutRecipe: "split-photo" },
  "dental-whitening": { sourcePatternId: "gold/dental.json#offer-bar", layoutRecipe: "offer-bar" },
  "dental-call-the-office": { sourcePatternId: "gold/dental.json#type-led", layoutRecipe: "type-led" },
  "realestate-home-value": { sourcePatternId: "gold/real-estate-agents.json#split-photo", layoutRecipe: "split-photo" },
  "realestate-just-listed": { sourcePatternId: "gold/real-estate-agents.json#offer-bar", layoutRecipe: "offer-bar" },
  "realestate-thinking-of-selling": { sourcePatternId: "gold/real-estate-agents.json#type-led", layoutRecipe: "type-led" },
  "landscaping-spring-cleanup": { sourcePatternId: "gold/landscaping.json#offer-bar", layoutRecipe: "offer-bar" },
  "landscaping-lawn-plan": { sourcePatternId: "gold/landscaping.json#split-photo", layoutRecipe: "split-photo" },
  "landscaping-backyard-light": { sourcePatternId: "gold/landscaping.json#type-led", layoutRecipe: "type-led" },
}

export function galleryV1(): MailTemplate[] {
  return GALLERY_V1_INDUSTRIES.flatMap((industry) =>
    listMailTemplates(industry).map((template) => {
      const extra = PATTERN[template.id]
      return extra ? { ...template, ...extra } : template
    }),
  )
}

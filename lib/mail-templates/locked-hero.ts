import { HERO_NEED_CHANGES } from "@/lib/image-edit/messages"

import type { MailTemplate } from "./types"

export type LockedHeroSize = "5x8" | "6x9"

export interface LockedHeroInput {
  campaignName: string
  size: string | null
  businessName: string
  offer: string
  callToAction: string
  phone: string
  website: string
  /** What the customer wants changed on the locked picture. Required. */
  instructions: string
  logoName: string | null
}

function clean(value: string): string {
  return value.replace(/\s+/g, " ").trim()
}

/** The first missing detail, or null when the sample can be shown. A logo is never required. */
export function lockedHeroMissing(input: LockedHeroInput): string | null {
  if (clean(input.campaignName).length < 2) return "Add a campaign name."
  if (input.size !== "5x8" && input.size !== "6x9") return "Choose a 5×8 or a 6×9 postcard."
  if (clean(input.businessName).length < 2) return "Add the business name."
  if (clean(input.offer).length < 2) return "Add the offer."
  if (clean(input.callToAction).length < 2) return "Add the call to action."
  if (clean(input.phone).length < 7) return "Add a phone number."
  if (clean(input.instructions).length < 8) return HERO_NEED_CHANGES
  return null
}

/** A sample card around a locked gallery picture. No model is called. */
export function lockedHeroDesign(template: MailTemplate, input: LockedHeroInput) {
  const size: LockedHeroSize = input.size === "6x9" ? "6x9" : "5x8"
  return {
    photoId: template.id,
    photoLocked: true as const,
    campaignName: clean(input.campaignName),
    size,
    businessName: clean(input.businessName),
    headline: clean(input.callToAction),
    offer: clean(input.offer),
    phone: clean(input.phone),
    website: clean(input.website),
    logoName: input.logoName,
    back: "The address side stays clear for postage. This sample was not mailed.",
    note: "Sample design. The picture stays the one you picked. Nothing is mailed.",
  }
}

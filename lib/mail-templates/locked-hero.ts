import type { MailTemplate } from "./types"

export type LockedHeroSize = "5x8" | "6x9"

/** A sample card around a locked gallery picture. No model is called. */
export function lockedHeroDesign(template: MailTemplate, campaignName: string, size: LockedHeroSize) {
  const name = campaignName.replace(/\s+/g, " ").trim()
  return {
    photoId: template.id,
    photoLocked: true as const,
    campaignName: name,
    size,
    headline: template.spec.headline,
    offer: template.spec.offer ?? "",
    back: "The address side stays clear for postage. This sample was not mailed.",
    note: "Sample design. The picture stays the one you picked. Nothing is mailed.",
  }
}

export function lockedHeroReady(campaignName: string, size: string | null): size is LockedHeroSize {
  return campaignName.trim().length >= 2 && (size === "5x8" || size === "6x9")
}

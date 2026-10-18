/**
 * Mailers Patrick has named as personal favorites.
 * Retrieval keeps them in the set, and the critic uses them as calibration.
 * The lesson is the principle. The layout, the mark, and the pictures stay with the mailer.
 */

export const DEFAULT_OWNER_FAVORITE_IDS = ["PM-047", "PM-054", "PM-022", "PM-056", "PM-057"] as const

const SAFE_ID = /^[A-Za-z0-9_-]{1,80}$/

/**
 * Principles for favorites whose lesson is not already the open-canvas rule.
 * PM-056 is the Wondercide mosquito and tick postcard.
 * PM-057 is the Dairy Queen cake coupon.
 */
export const OWNER_FAVORITE_PRINCIPLES: Record<string, string> = {
  "PM-056":
    "From PM-056, learn a disciplined three-color palette (navy, one lime, and white), chunky condensed display type, a clean lifestyle photograph plus one product hero, a back with a 2×2 icon benefit grid, and one bold color-blocked offer panel with a pill-shaped code. These are principles. Do not copy that mailer's layout, mark, colors, product, or wording.",
  "PM-057":
    "From PM-057, learn a super simple food or retail coupon: one hero product photograph, a short playful headline, one big full-width offer strip, a barcode, and an expiry. These are principles. Do not copy that mailer's layout, mark, colors, product, or wording.",
}

export function ownerFavoriteIds(env: NodeJS.ProcessEnv = process.env): string[] {
  const configured = env.DESIGN_OWNER_FAVORITES?.split(",").map((id) => id.trim()).filter((id) => SAFE_ID.test(id)) ?? []
  if (configured.length === 0) return [...DEFAULT_OWNER_FAVORITE_IDS]
  return configured
}

export function isOwnerFavorite(id: string, env: NodeJS.ProcessEnv = process.env): boolean {
  return ownerFavoriteIds(env).includes(id)
}

export function calibrationSentence(env: NodeJS.ProcessEnv = process.env): string {
  const ids = ownerFavoriteIds(env)
  const lessons = ids.map((id) => OWNER_FAVORITE_PRINCIPLES[id]).filter((line): line is string => Boolean(line))
  return [
    `Calibrate against the owner's favorites: ${ids.join(", ")}, and the highest-graded vision-taste readings. Name the single biggest weakness.`,
    ...lessons,
  ].join(" ")
}

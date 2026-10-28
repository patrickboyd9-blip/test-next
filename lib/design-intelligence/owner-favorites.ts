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

/**
 * What Patrick's Round 5 roofing votes (round5/votes.json, Oct 27 2026) taught the critic.
 * Loved: b02 full-bleed real-house photo with a roofer on a ladder, dark overlay, bold white headline, one yellow offer bar.
 * Hated: split cards with a cut-out house on a blank panel, gray/cream text panels, type-first, and any senior angle.
 */
export const OWNER_VOTE_LESSONS =
  "From the owner's roofing votes: favor a full-bleed photograph of a real house with a roofer at work, a dark overlay, a bold white headline, and one bright offer bar. Penalize a cut-out house floating on a blank panel, muddy beige or gray palettes, type-only fronts, a pretty house with no visible job or problem, and any age or senior angle the brief did not ask for."

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
    OWNER_VOTE_LESSONS,
  ].join(" ")
}

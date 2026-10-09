import type { CampaignBrief } from "./types"

/**
 * One photographic look for a whole campaign.
 * Every direction copies this string unchanged so the set feels like one shoot.
 * It does not include a focal length: that stays on the shot, because a portrait
 * and a street picture do not share a lens.
 */
const LIGHTS = [
  "late-afternoon sun from camera left",
  "late-afternoon sun from camera right",
  "morning sun from camera left",
  "open shade with soft skylight from above",
] as const

const WARDROBE = [
  "plain unbranded faded navy shirts and khaki work pants",
  "plain unbranded gray shirts and dark canvas pants",
  "plain unbranded olive shirts and tan work pants",
] as const

export function buildCampaignLookBlock(campaign?: CampaignBrief): string {
  const key = campaignKey(campaign)
  const light = pick(LIGHTS, `${key}:light`)
  const wardrobe = pick(WARDROBE, `${key}:wardrobe`)
  return [
    `Light: ${light}.`,
    "Lens: full-frame, natural perspective.",
    "Grade: fine grain, true-to-life color, no HDR.",
    `Region: ${regionFor(campaign)}.`,
    `Wardrobe: ${wardrobe}.`,
  ].join(" ")
}

export function lightDirectionFromLook(lookBlock: string): string {
  const match = /^Light: ([^.]+)\./.exec(lookBlock.trim())
  return match?.[1] ?? LIGHTS[0]
}

function campaignKey(campaign: CampaignBrief | undefined): string {
  if (!campaign) return "default-look"
  const key = [
    campaign.businessInfo?.name,
    campaign.businessInfo?.address,
    campaign.audience?.description,
    campaign.goal,
  ]
    .map((value) => value?.trim())
    .filter((value): value is string => Boolean(value))
    .join("|")
  return key || "default-look"
}

function regionFor(campaign: CampaignBrief | undefined): string {
  const text = [
    campaign?.audience?.description,
    campaign?.businessInfo?.address,
    campaign?.goal,
    campaign?.otherRequirements,
  ]
    .filter((value): value is string => Boolean(value?.trim()))
    .join(" ")
  if (/\b(chula vista|san diego|coast|beach|california|pacific)\b/i.test(text)) {
    return "ordinary coastal houses and streets, with no readable signs, street names, or landmarks"
  }
  return "ordinary local houses and streets, with no readable signs or landmarks"
}

function pick<T>(variants: readonly T[], key: string): T {
  let hash = 2166136261
  for (let index = 0; index < key.length; index += 1) {
    hash ^= key.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return variants[(hash >>> 0) % variants.length] ?? variants[0]
}

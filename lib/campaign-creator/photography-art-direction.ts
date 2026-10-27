import { normalizeIndustry } from "@/lib/research-library/industry"

import { isHomeServicesBrief } from "./creative-intelligence"
import {
  isFinalExpenseBrief,
  isMedicareAgentBrief,
  uploadedAgentPortrait,
} from "./medicare-compliance"
import {
  referenceVerticalsForBrief,
  selectReferenceCards,
} from "../reference-corpus/select-reference-cards"
import {
  normalizeLayoutVariant,
  type CampaignBrief,
  type CreativeSpec,
  type ImageryRole,
  type LayoutVariant,
  type LeadJob,
} from "./types"

/**
 * Execution craft for a conceived photograph.
 * Not a CreativeSpec field. Not a specimen photo. Not persisted.
 * The Creative Engine still authors the situation. This layer turns a
 * thin label into a trade-specific photograph and keeps a specific
 * conception intact.
 */
export const PHOTOGRAPHY_ART_DIRECTION_REVISION = "2026-10-09.1"

export type PhotoRole = Exclude<ImageryRole, "none" | "logo">
export type PhotoOccupancy = "field" | "supporting" | "witness"

export interface ImageBriefArtDirection {
  revision: string
  trade: string
  subject: string
  lighting: string
  framing: string
  emotion: string
  refuse: string
  /** Calm region left for type, named for the chosen layout. */
  negativeSpace: string
  craft?: string
}

const PHOTO_ROLES: readonly PhotoRole[] = ["consequence", "crew", "neighborhood"]

const LABEL_START =
  /^(professional technician|neighborhood photography|warm neighborhood|bold seasonal|stock\b|close-up|shingle|asphalt shingle|generic\b|photo of|a photo|roof photo|sunny finished roof)/i

const REFUSE =
  "No text, headlines, prices, phone numbers, URLs, QR codes, logos, watermarks, badges, starbursts, or postcard chrome. Do not reduce the idea to a macro of roofing granules, a handshake, or a ruined room used as proof. Not this recipient's house, crew, or documented damage."

const LIGHT: Record<PhotoRole, string> = {
  consequence:
    "Soft interior daylight, specific and quiet. No disaster lighting and no on-camera flash.",
  crew: "Working daylight with a little sky. A real job, not a studio handshake.",
  neighborhood:
    "Open natural light, one time of day. Ordinary and considered. Not a sunset cliché as the idea.",
}

const EMOTION: Record<LeadJob, string> = {
  offer: "Calm confidence. The picture makes the offer feel concrete.",
  problem: "The cost of waiting, in the emotion the campaign chose.",
  trust: "Competence and care. Not a smile at the camera.",
  urgency: "A moment that should not wait, still short of spectacle.",
}

const FRAMING: Record<PhotoOccupancy, string> = {
  field: "Full-bleed-ready frame with one quiet, low-detail region left for type later. Do not fill every inch.",
  supporting: "One subject, composed to sit beside type. Not a collage and not a finished mailer.",
  witness: "A small, restrained detail. Secondary to the message. Not a hero frame.",
}

type SceneBank = Record<PhotoRole, readonly [string, string, string]>

const ROOFING: SceneBank = {
  consequence: [
    "A slow drip from a ceiling stain into a bucket in an ordinary living room. The rest of the room is intact. An illustrative category situation, not this recipient's house and not gore.",
    "A damp ring on a white ceiling beside a skylight well. Soft overcast light through the glass. The room is lived-in and otherwise fine. Not a disaster and not a specific address.",
    "Water beading along an interior window head after rain, a folded towel on the sill, calm documentary light. Not a flooded ruin and not this customer's documented damage.",
  ],
  crew: [
    "A figure on a ladder at a roof edge, seen from the yard, with tools and a coil of flashing. Morning light. The face is not the subject. No logo on the clothing. Not a posed greeting.",
    "Hands setting a course of shingles along a ridge. Only hands, materials, and raking sun. No text on the clothing. Not a posed crew portrait.",
    "A worker walking a low-slope roof with a roll of underlayment. Wide frame, open sky left quiet. Not a portrait and not a macro of granules.",
  ],
  neighborhood: [
    "A residential street of mixed roof ages in warm light. Ordinary houses, none of them treated as the recipient's address. Not a shingle macro.",
    "Rooflines along a hillside neighborhood after rain, wet pavement and clean light. No storm-damage spectacle and no readable signs.",
    "One ordinary gable in a row of homes, photographed from the sidewalk across the street. Not a close-up of granules and not a landmark.",
  ],
}

/**
 * Roofing heroes show the result the homeowner wants: an attractive house
 * with a clean new roof on a sunny day. People are optional and small.
 * Round 1 of the quality loop showed that worker-on-gray-sky scenes read as
 * stock and crop badly, so roofing always uses this bank.
 */
const ROOFING_HERO: readonly string[] = [
  "An attractive two-story suburban house with a clean, freshly installed dark charcoal architectural shingle roof, seen from across the street at a slight angle. Trimmed lawn, a tree at one side, deep blue sky with a few white clouds. Curb appeal. No people.",
  "A well-kept single-story ranch house with a crisp new shingle roof and clean gutters, shot from the sidewalk in warm late-morning sun under a clear blue sky. Green lawn and a tidy front walk. The whole roof is in frame.",
  "A handsome craftsman-style home with a brand-new roof, photographed from the street on a bright sunny day with blue sky. Flowers along the porch. One roofer, small in frame, waves from the driveway beside a ladder, face fully visible and not cropped.",
  "A bright, welcoming family home on a quiet tree-lined street, its new roof clean and even, blue sky and soft sun. Shot from the curb so the full house and roofline sit inside the frame with margin on every side. No people.",
]

const HVAC: SceneBank = {
  consequence: [
    "An unused thermostat and a closed window in a warm, still room. Summer light, no people mugging for the camera. Illustrative, not this home.",
    "A silent supply vent in a quiet bedroom, dust in a shaft of afternoon light. The room is fine. Not a breakdown spectacle.",
    "An outdoor condenser sitting idle beside a house wall, heat shimmer, no logo plate readable. Not a product shot with type.",
  ],
  crew: [
    "Hands and gauges at an outdoor condenser. Coils, copper, working daylight. No logo and no face as the subject.",
    "A technician kneeling beside an outdoor condenser with the service panel open, coils and copper visible, working daylight.",
    "A filter being slid from a return grille, only hands and the grille, interior daylight. Not a stock smile.",
  ],
  neighborhood: [
    "A row of ordinary houses with condensers along the side yards, late-day light. Not one address as the hero.",
    "Rooftop condensers on a low commercial strip, quiet and specific, no readable signage.",
    "A shaded side yard and the equipment that keeps the house comfortable, photographed with room around it.",
  ],
}

const PLUMBING: SceneBank = {
  consequence: [
    "A small drip under a kitchen sink, cabinet door open, a bowl catching water. The kitchen is otherwise intact. Not a flood.",
    "A faint water mark on a ceiling below a bathroom, ordinary hallway light. Not gore and not this house as fact.",
    "A slow bead at a shutoff valve, metal and a drop of water, tight and calm.",
  ],
  crew: [
    "Hands and a wrench at a supply line under a sink. Working light. No logo, no posed portrait.",
    "A figure with a coil of supply line at a water heater, seen from the doorway. Face secondary.",
    "Tools laid on a folded towel beside an open cleanout. The work, not a handshake.",
  ],
  neighborhood: [
    "Ordinary homes on a residential street, late light, no flooded curb and no readable signs.",
    "A quiet driveway and the side of a house where a hose bib lives. Not the recipient's address.",
    "Street trees and mixed houses after a dry day. Environmental, not proof of a job.",
  ],
}

const ELECTRICAL: SceneBank = {
  consequence: [
    "A single dark room in an otherwise lit house, seen from the hall. Quiet, not a fire.",
    "An outlet cover set aside on a work cloth, wires not sensationalized, interior daylight.",
    "A porch light out at dusk while the neighboring houses are lit. No readable house numbers.",
  ],
  crew: [
    "Hands at an open panel with the cover leaned aside, careful light, no logo on the shirt.",
    "A figure on a ladder at an exterior fixture, seen from the yard, sky quiet. Not a portrait.",
    "A coil of cable and a tester on a wood floor, only the work in frame.",
  ],
  neighborhood: [
    "A residential street at the blue edge of evening, porch lights coming on. No signs.",
    "Ordinary houses and service masts along a sidewalk, daylight, not one address.",
    "A shaded eave and the line of a roof against sky. Place, not a product.",
  ],
}

const PEST: SceneBank = {
  consequence: [
    "A few ants along a kitchen baseboard in an otherwise clean room. Category reminder, not this recipient's infestation and not gore.",
    "A single mud tube on a foundation wall in raking light. Tight, calm, not a horror still.",
    "Leaves and a little frass on a windowsill, soft daylight, the room intact.",
  ],
  crew: [
    "A technician at a front walk with a professional sprayer, seen from the yard, face not the subject, no logo.",
    "Hands inspecting a foundation joint with a flashlight. Only hands and the wall.",
    "Boots and equipment at a gate, early light, the person secondary.",
  ],
  neighborhood: [
    "A well-kept residential block, gardens and foundations in ordinary light. Not an address-level photo.",
    "Side yards and fences along a street after morning. No readable signs.",
    "A porch and foundation in open shade. The place, not a specimen.",
  ],
}

const LANDSCAPING: SceneBank = {
  consequence: [
    "A tired lawn edge beside a cared-for walk, honest and unsentimental. Not a before-and-after collage.",
    "Overgrown beds against a tidy porch, one corner of a yard, daylight.",
    "A dry planter by a front step. Small, specific, not this recipient's yard as fact.",
  ],
  crew: [
    "Hands in soil at a bed edge, tools in the grass, morning light. No logo.",
    "A figure with a rake on a lawn, seen from the street, wide and quiet.",
    "A wheelbarrow and clipped greens, the worker's hands only.",
  ],
  neighborhood: [
    "Front yards along a residential street, varied and ordinary, no signs.",
    "A tree lawn and sidewalk in late light. Place, not a postcard of a landmark.",
    "Houses and hedges in a row, one quiet roofline, not one mailbox as the hero.",
  ],
}

const RESTAURANT: SceneBank = {
  consequence: [
    "An empty chair at a set table, late afternoon, one plate, no menu type and no logo.",
    "A pass window with one finished plate and warm kitchen light. Not a collage of every dish.",
    "Steam over a single bowl, tight and appetizing, no readable type.",
  ],
  crew: [
    "Hands plating one dish, only hands and the plate, warm practical light. No logo.",
    "A cook at a quiet pass, seen from the dining room, face secondary.",
    "A towel, a pan, and a finished plate on steel. The work of the kitchen.",
  ],
  neighborhood: [
    "A neighborhood storefront at dusk, warm interior light, no readable sign and no logo.",
    "A sidewalk table and a chair, ordinary street, one time of day.",
    "The door of a small dining room from across the street, inviting, no type.",
  ],
}

const DENTAL: SceneBank = {
  consequence: [
    "A calm treatment chair in soft daylight, empty, no people, no brand, no clinical gore.",
    "A window and a waiting chair, quiet and specific. Not a stock smile.",
    "Folded linen and a rinsing cup, tight and clean. No type.",
  ],
  crew: [
    "Hands in gloves at a tray, only hands and instruments, calm light. No logo and no patient face.",
    "A clinician seen from the shoulder at a window, face not the subject.",
    "A hallway of a small practice, one figure walking away, quiet.",
  ],
  neighborhood: [
    "A small practice storefront on a local street, daylight, no readable sign.",
    "A shaded entry and a bench. Recognition of a kind of place, not a fake office.",
    "Street trees and a modest commercial front. No logo.",
  ],
}

const MEDICARE: SceneBank = {
  consequence: [
    "An active, capable older couple gardening together in daylight, standing and well, contemporary color, with open space around them. Not frail, not a hospital, and not this recipient's medical record.",
    "An active older couple cooking together in a bright kitchen, both well and independent, natural color, calm counter space left quiet for type. Not sepia and not a stock-model pose.",
    "An active couple in their sixties on a neighborhood porch in open shade, capable and at ease, contemporary color. Not a cane as the subject and not a clinical room.",
  ],
  crew: [
    "An active, capable older couple talking at a sunny outdoor table, natural color, at ease, with calm space beside them for type. Not a handshake and not a posed catalog smile.",
    "A friendly headshot of a local advisor only when that photograph was uploaded. Otherwise an active older couple, eyes alive, natural skin, daylight, looking engaged with each other.",
    "An active couple walking and talking, seen from a few paces, faces natural and well, contemporary clothes, no logo and no government emblem.",
  ],
  neighborhood: [
    "An active, capable older couple walking a sunny residential sidewalk, contemporary color, healthy and independent, with quiet sky left open for type. Not a construction site.",
    "A tree-lined block in ordinary daylight with an active older couple crossing toward a cafe, no readable signs and no landmark treated as proof.",
    "A shaded residential street and an active couple out for a walk, one time of day, contemporary color, not sepia.",
  ],
}

const FINAL_EXPENSE: SceneBank = {
  consequence: [
    "A living family at a kitchen table in daylight, multi-generation and well, contemporary color. Not grief, not a funeral, and not a casket.",
    "Two generations on a front porch, alive and at ease, open shade. Not a cemetery and not a hospital.",
    "A family walking a quiet block together, capable and connected, natural color. Not a coffin and not an official emblem.",
  ],
  crew: [
    "A living family photographed together, faces natural, contemporary color, no one in mourning. Not a casket and not a funeral.",
    "Hands of two generations around a table, only the people and the table, daylight. Not grief and not a government seal.",
    "A parent and an adult child in a bright kitchen, well and ordinary. Not a cemetery.",
  ],
  neighborhood: [
    "An ordinary home with a family on the walk, living and well, daylight, no readable signs. Not a funeral home.",
    "A residential street and a family out together, contemporary color. Not a capitol and not a casket.",
    "A front yard in open light, people alive and capable. Not sepia and not a cemetery.",
  ],
}

const AUTO_INSURANCE: SceneBank = {
  consequence: [
    "A parked family car in a residential driveway, daylight, intact, no collision. No person on a ladder and no work crew.",
    "A quiet house front and one car in the drive, ordinary daylight, no damage and no tools.",
    "The side of a family car and an empty driveway, calm sky, no crash and no one climbing.",
  ],
  crew: [
    "The same parked family car, quiet daylight, no driver posed at the camera, no tools and no ladder.",
    "A local advisor only when that photograph was uploaded. Otherwise the parked car and the house, no hard hat and no roof work.",
    "Hands are out of frame. The subject is the car in the driveway, daylight, no collision.",
  ],
  neighborhood: [
    "A quiet residential street with ordinary cars in driveways, daylight, no crash and no work crew.",
    "Houses and parked cars along a sidewalk, one time of day, no readable signs and no ladders.",
    "A shaded driveway and a family car, the house intact, no repair and no Medicare card.",
  ],
}

const LIFE_INSURANCE: SceneBank = {
  consequence: [
    "A living family at a kitchen table in daylight, well and connected, contemporary color. Not grief and not a work site.",
    "Two generations on a front porch, alive and at ease. Not a ladder, not a cemetery, and not a hospital.",
    "A family walking a quiet block, capable and ordinary. Not a crash and not a construction crew.",
  ],
  crew: [
    "A living family photographed together, faces natural, contemporary color. Not a casket and not a hard hat.",
    "Hands of two generations around a table, only the people and the table, daylight.",
    "A parent and an adult child in a bright kitchen, well and ordinary. Not a job site.",
  ],
  neighborhood: [
    "An ordinary home with a family on the walk, living and well, daylight, no readable signs.",
    "A residential street and a family out together, contemporary color. Not a capitol and not a ladder.",
    "A front yard in open light, people alive and capable. Not a roof repair.",
  ],
}

const LOCAL_SERVICE: SceneBank = {
  consequence: [
    "The visible cost of waiting, in an ordinary home, shown as a category situation: one small problem in a calm room. Not gore and not a ruined kitchen used as stock proof.",
    "A detail of wear that a homeowner would recognize, intact surroundings, soft daylight. Not this recipient's property.",
    "One honest consequence, framed tight, the rest of the room left alone.",
  ],
  crew: [
    "Hands and tools at the work itself. The person is secondary. Documentary daylight, no logo, not a handshake, not a posed portrait.",
    "A figure at the job, seen from a little distance, sky or a wall left quiet for type later.",
    "Materials of the trade in use, only the work in frame, no text on clothing.",
  ],
  neighborhood: [
    "An ordinary residential street that could be this kind of town, photographed with care. Not one mailbox treated as the recipient's address.",
    "Houses and a sidewalk in open light, no readable signs and no landmark.",
    "A quiet block after weather, wet or dry, specific light, not generic stock of identical tract homes as proof.",
  ],
}

const BANKS: Record<string, SceneBank> = {
  medicare: MEDICARE,
  final_expense: FINAL_EXPENSE,
  roofing: ROOFING,
  hvac: HVAC,
  plumbing: PLUMBING,
  electrical: ELECTRICAL,
  pest: PEST,
  landscaping: LANDSCAPING,
  exterior_cleaning: LANDSCAPING,
  restaurant: RESTAURANT,
  pizza_qsr: RESTAURANT,
  dental: DENTAL,
  med_spa: DENTAL,
  auto_insurance: AUTO_INSURANCE,
  home_insurance: AUTO_INSURANCE,
  life_insurance: LIFE_INSURANCE,
  "local-service": LOCAL_SERVICE,
}

const TRADE_PREFERENCE = [
  "final_expense",
  "medicare_agent",
  "medicare_seminar",
  "medicare_plan",
  "life_insurance",
  "auto_insurance",
  "roofing",
  "hvac",
  "plumbing",
  "electrical",
  "pest",
  "landscaping",
  "exterior_cleaning",
  "restaurant",
  "pizza_qsr",
  "dental",
  "med_spa",
] as const

export function isLocalServiceBrief(brief: CampaignBrief): boolean {
  if (isHomeServicesBrief(brief)) return true
  return selectReferenceCards(brief).match === "vertical"
}

export function isWeakVisualDirection(value: string): boolean {
  const text = value.trim()
  if (!text) return true
  const words = text.split(/\s+/).filter(Boolean)
  if (LABEL_START.test(text) && words.length < 18) return true
  return words.length < 12
}

export function isPhotographicSpec(spec: CreativeSpec): boolean {
  const layout = normalizeLayoutVariant(spec.layoutVariant)
  if (!layout || layout === "type_only") return false
  return (
    spec.imageryRole === "consequence" ||
    spec.imageryRole === "neighborhood" ||
    spec.imageryRole === "crew"
  )
}

/**
 * A text-only recommendation is weak when the decline is a label.
 * A full reason tied to the brief is a real strategy and stays.
 */
export function isWeakTextOnlyRecommendation(spec: CreativeSpec): boolean {
  const layout = normalizeLayoutVariant(spec.layoutVariant)
  const textLed =
    layout === "type_only" ||
    spec.imageryRole === "none" ||
    spec.imageryRole === "logo"
  if (!textLed) return false
  const reason = spec.visualDirection?.trim() ?? ""
  if (isWeakVisualDirection(reason)) return true
  return /^(no photograph|type carries|typography only|text only|navy)\b/i.test(
    reason
  )
}

export function negativeSpaceForLayout(
  layout: LayoutVariant | undefined,
  occupancy: PhotoOccupancy
): string {
  if (occupancy === "witness") {
    return "Keep the frame quiet and secondary, with no faces or tools crowding the edges. Type leads the card, so this stays a small witness rather than a hero picture."
  }
  if (layout === "image_grounded" || occupancy === "field") {
    return "Leave the upper-left third of the frame, or the right third when the work needs the left, as calm sky, siding, or an empty wall. Keep faces, hands, ladders, and tools out of that calm third. A real lived-in house, shot slightly off-axis in ordinary daylight, not a centered stock portrait. The type will sit in that quiet third."
  }
  if (layout === "banded_split") {
    return "Keep a calm horizontal band across the top of the frame, low-detail sky or wall, empty of faces and tools. Type will sit in that band."
  }
  if (layout === "peer_split") {
    return "Keep the left third of the frame calm and low-detail, empty of faces and tools. Type will share that side of the card."
  }
  return "Keep the right half of the frame calm and low-detail, empty of faces and tools. Type will sit beside the photograph on that side."
}

export function buildPhotographyArtDirection(input: {
  imageryRole: PhotoRole
  leadJob: LeadJob
  occupancy: PhotoOccupancy
  visualDirection: string
  campaign?: CampaignBrief
  variationKey?: string
  layoutVariant?: LayoutVariant
}): ImageBriefArtDirection {
  const trade = tradeForCampaign(input.campaign)
  const bank = BANKS[bankKey(trade)] ?? LOCAL_SERVICE
  const conceived = input.visualDirection.trim()
  const weak = isWeakVisualDirection(conceived)
  const genericJob = /finished result of the job|the problem itself|from this business|one local person/i.test(conceived)
  const portrait = trade.startsWith("medicare") ? uploadedAgentPortrait(input.campaign) : undefined
  const replace =
    weak ||
    badSubject(conceived, trade) ||
    offIndustry(conceived, trade) ||
    genericJob ||
    (trade === "hvac" && !hvacDepiction(conceived))
  const subject =
    portrait && input.imageryRole === "crew"
      ? `The uploaded agent photograph: ${portrait}. A friendly headshot, eyes to the camera, natural color, capable and local. Not a stock model and not a government portrait.`
      : replace
        ? pick(bank[input.imageryRole], `${input.variationKey ?? "direction"}:${input.leadJob}`)
        : conceived

  const roofing = trade === "roofing"
  const art: ImageBriefArtDirection = {
    revision: PHOTOGRAPHY_ART_DIRECTION_REVISION,
    trade,
    subject: roofing ? pick(ROOFING_HERO, `${input.variationKey ?? "direction"}:${input.leadJob}`) : subject,
    lighting: roofing
      ? "Bright sunny daylight, deep blue sky with a few white clouds, warm and inviting. Never overcast and never a flat gray sky."
      : lightingFor(input.imageryRole, input.campaign, trade),
    framing: FRAMING[input.occupancy],
    emotion: EMOTION[input.leadJob],
    refuse: refuseFor(trade),
    negativeSpace: roofing
      ? "Keep the whole house, the whole roof, and any face well inside the central two-thirds of the frame, with generous sky above and lawn below, so any crop to a wide or tall panel keeps them. Leave some calm blue sky in the upper third for type."
      : negativeSpaceForLayout(input.layoutVariant, input.occupancy),
  }

  const craft = craftNote(input.campaign, trade)
  if (craft) art.craft = craft
  if (trade === "auto_insurance" || trade === "home_insurance" || trade === "life_insurance") {
    art.negativeSpace = "Leave a calm third of the frame as open sky, driveway, or a plain wall. No ladders, tools, work crews, roofs being repaired, or people climbing."
    art.refuse = `${art.refuse} No ladders, handymen, roofers, hard hats, crashes, collisions, or Medicare cards.`
  }
  if (trade === "hvac") {
    art.refuse = `${art.refuse} No gutters, window trim, siding, termite treatment, or someone painting a window. The photograph is heating and air equipment.`
  }
  return art
}

function tradeForCampaign(campaign: CampaignBrief | undefined): string {
  if (!campaign) return "local-service"
  const matched = referenceVerticalsForBrief(campaign)
  const preferred = TRADE_PREFERENCE.find((trade) => matched.includes(trade))
  if (preferred && preferred !== "roofing" && STORM_ROOF_INSURANCE.has(preferred)) return preferred
  // A storm-restoration or hail company is a roofer for the photo: route it
  // through the sunny-house roofing brief, never a storm-damage or studio shot.
  if (preferred === "roofing" || STORM_ROOF.test(campaignText(campaign))) return "roofing"
  if (preferred) return preferred
  if (isFinalExpenseBrief(campaign)) return "final_expense"
  if (isMedicareAgentBrief(campaign)) return "medicare_agent"
  return "local-service"
}

const STORM_ROOF = /\b(?:roof(?:s|ing|er|ers)?|shingles?|storm|hail|wind damage)\b/i
const STORM_ROOF_INSURANCE = new Set(["final_expense", "medicare_agent", "medicare_seminar", "medicare_plan", "life_insurance", "auto_insurance"])

function campaignText(campaign: CampaignBrief): string {
  return [campaign.goal, campaign.offer, campaign.audience?.description, campaign.businessInfo?.name, campaign.otherRequirements]
    .filter((value): value is string => Boolean(value?.trim()))
    .join(" ")
}

function bankKey(trade: string): string {
  if (trade.startsWith("medicare")) return "medicare"
  return trade
}

function refuseFor(trade: string): string {
  if (trade.startsWith("medicare")) {
    return "No text, headlines, prices, phone numbers, URLs, QR codes, logos, watermarks, or postcard chrome. No Capitol, eagle, seal, flag, Medicare card, or official-notice styling. No construction site, hard hat, hospital, frail or isolated person, sepia tone, casket, funeral, or obvious stock-model pose. Not this recipient's medical record."
  }
  if (trade === "final_expense") {
    return "No text, logos, QR codes, or watermarks. No casket, coffin, funeral, cemetery, or grief scene. No Capitol, eagle, seal, flag, or official-notice styling."
  }
  return REFUSE
}

const TRADE_GOLD: Record<string, string> = {
  hvac: "hvac",
  plumbing: "plumbing",
  roofing: "roofing",
  pest: "pest-control",
  landscaping: "landscaping",
  restaurant: "restaurants-food",
  pizza_qsr: "restaurants-food",
  dental: "dental",
  auto_insurance: "auto-insurance",
  home_insurance: "home-insurance",
  life_insurance: "life-insurance",
}

function offIndustry(value: string, trade: string): boolean {
  const expected = TRADE_GOLD[trade]
  if (!expected) return false
  const found = normalizeIndustry(value)
  return found !== "none" && found !== expected
}

function hvacDepiction(value: string): boolean {
  return /\b(hvac|condensers?|furnaces?|thermostats?|air condition|ducts?|vents?|filters?|coils?|\bac\b)\b/i.test(value)
}

function badSubject(value: string, trade: string): boolean {
  if (trade === "auto_insurance" || trade === "home_insurance" || trade === "life_insurance") {
    return /\b(ladders?|handymen|handyman|roofers?|shingles?|hard hats?|condensers?|technicians?|construction|job sites?|medicare|crashes?|collisions?|caskets?|funerals?)\b/i.test(value)
  }
  if (!trade.startsWith("medicare") && trade !== "final_expense" && trade !== "life_insurance") {
    return false
  }
  return /\b(construction|hard hats?|job sites?|scaffolding|capitol|eagles?|medicare cards?|hospitals?|frail|sepia|caskets?|funerals?|cemeter(?:y|ies)|coffins?)\b/i.test(
    value
  )
}

function lightingFor(role: PhotoRole, campaign: CampaignBrief | undefined, trade = ""): string {
  if (trade.startsWith("medicare") || trade === "final_expense") {
    return "Open natural daylight, contemporary color, not sepia and not clinical fluorescent."
  }
  const base = LIGHT[role]
  if (role !== "neighborhood" || !campaign) return base
  const text = [
    campaign.audience?.description,
    campaign.businessInfo?.address,
    campaign.goal,
    campaign.otherRequirements,
  ]
    .filter((value): value is string => Boolean(value?.trim()))
    .join(" ")
  if (/\b(chula vista|san diego|coast|beach|california|pacific)\b/i.test(text)) {
    return `${base} Clear coastal daylight on ordinary houses. No readable signs, street names, or landmarks.`
  }
  return base
}

function craftNote(
  campaign: CampaignBrief | undefined,
  trade: string
): string | undefined {
  if (!campaign || trade === "local-service") return undefined
  const selection = selectReferenceCards(campaign)
  if (selection.match !== "vertical") return undefined
  const card = selection.cards.find(
    (item) => item.vertical === trade && item.packGroup !== "craft_exemplar"
  )
  const notes = card?.imageryNotes.trim()
  return notes || undefined
}

function pick(variants: readonly string[], key: string): string {
  let hash = 2166136261
  for (let index = 0; index < key.length; index += 1) {
    hash ^= key.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return variants[(hash >>> 0) % variants.length] ?? variants[0]
}

export function isPhotoRole(value: ImageryRole | undefined): value is PhotoRole {
  return value !== undefined && (PHOTO_ROLES as readonly string[]).includes(value)
}

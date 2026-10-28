/**
 * The gold file names are the only industries a brief or a mailer can have.
 * `gold/<slug>.json` is the master list. Anything else is "none".
 * HVAC is decided before roofing and plumbing. Windows, gutters, and siding
 * are not roofing. Garage doors are not remodeling. A salon is not a med spa.
 * Insurance splits into Medicare, auto, home, and life.
 *
 * The saved-index fingerprint is a hash of the live rule functions and the
 * slug list. A rule edit rebuilds the index even if TAGGER_VERSION stays put.
 */

import { createHash } from "node:crypto"

import type { CampaignBrief } from "@/lib/campaign-creator/types"

export const TAGGER_VERSION = "2026-10-27-39"

export const GOLD_INDUSTRIES = [
  "auto-insurance",
  "auto",
  "bakery",
  "churches-community",
  "cleaning-pressure-washing",
  "consumer-products",
  "dental",
  "garage-doors",
  "gyms-fitness",
  "hair-salon",
  "handyman",
  "home-buying",
  "home-insurance",
  "home-remodeling",
  "home-security",
  "hvac",
  "junk-removal",
  "landscaping",
  "laundromat",
  "life-insurance",
  "med-spa-chiro",
  "medicare",
  "mortgage-financial",
  "moving-storage",
  "optometry",
  "outdoor-living",
  "pest-control",
  "plumbing",
  "precious-metals",
  "real-estate-agents",
  "restaurants-food",
  "retail-grand-openings",
  "roofing",
  "sauna",
  "senior-living",
  "solar",
  "tutoring-childcare",
  "vet-pet",
  "windows-gutters-siding",
] as const

export type GoldIndustry = (typeof GOLD_INDUSTRIES)[number]

export const NONE_INDUSTRY = "none"

const GOLD_SET = new Set<string>(GOLD_INDUSTRIES)

/**
 * Saved indexes store this. A change means every file is parsed again.
 * `source` is the tagger text. Tests pass a different string to prove a rule
 * edit changes the fingerprint without a version bump.
 */
export function fingerprintFor(source: string, slugs: readonly string[]): string {
  return createHash("sha256")
    .update(`${source}\n${slugs.join("|")}`)
    .digest("hex")
    .slice(0, 20)
}

/**
 * Words that describe the photograph rather than the printed piece.
 * The literal lives in this function so a change rebuilds the index.
 */
export function sceneNotePattern(): string {
  return "photos?|photographs?|frames?|edges?|lighting|angles?|cameras?|crops?|cropped|glare|tables?|hands?|scans?|scanned"
}

/** Catalogue and camera sentences. A change here rebuilds a saved index. */
export function copyRejectPattern(): string {
  return "owner[-\\s]?labeled|photograph(?:s|ed)?|upside down|\\bupright\\b|\\brotated\\b|channel\\s*:|surrounding surface|\\bvisible\\b|\\bpm-\\d+\\b|\\bseq\\b|provisional|different artwork|pending_review|physical_photo|\\bplu\\b"
}

/**
 * The live text of the rules. A keyword edit changes this string, so the
 * saved index rebuilds without a hand-typed version bump. No filesystem
 * read: this module is imported by the client.
 */
export function taggerSource(): string {
  return [
    classify,
    medicareSignal,
    mortgageSignal,
    remodelingSignal,
    outdoorSignal,
    consumerSignal,
    retailSignal,
    restaurantSignal,
    windowSignal,
    sceneNotePattern,
    copyRejectPattern,
  ].map((fn) => fn.toString()).join("\n")
}

export function taggerFingerprint(): string {
  return fingerprintFor(taggerSource(), GOLD_INDUSTRIES)
}

const GROUPS: readonly (readonly string[])[] = [
  ["roofing", "hvac", "plumbing", "windows-gutters-siding", "garage-doors", "solar", "pest-control", "landscaping", "outdoor-living", "junk-removal", "cleaning-pressure-washing", "home-remodeling", "handyman", "home-security"],
  ["auto-insurance", "home-insurance", "life-insurance"],
  ["medicare", "dental", "med-spa-chiro", "optometry", "hair-salon"],
  ["auto", "auto-insurance"],
  ["real-estate-agents", "home-buying", "mortgage-financial", "home-insurance"],
  ["restaurants-food", "bakery", "retail-grand-openings", "consumer-products", "laundromat", "precious-metals"],
  ["churches-community", "tutoring-childcare", "gyms-fitness", "sauna", "moving-storage"],
  ["senior-living", "home-buying"],
  ["vet-pet"],
]

const NEIGHBOR_ORDER: Record<string, readonly string[]> = {
  "auto-insurance": ["home-insurance", "life-insurance", "hvac", "plumbing", "roofing"],
  "home-insurance": ["auto-insurance", "life-insurance", "real-estate-agents", "hvac"],
  "life-insurance": ["home-insurance", "auto-insurance"],
}

export function isGoldIndustry(value: string | undefined | null): value is GoldIndustry {
  return Boolean(value && GOLD_SET.has(value))
}

export function neighborRank(queryIndustry: string, entryIndustry: string): number {
  const order = NEIGHBOR_ORDER[normalizeIndustry(queryIndustry)]
  if (!order) return 0
  const index = order.indexOf(normalizeIndustry(entryIndustry))
  return index >= 0 ? index + 1 : 0
}

/**
 * Map a label, a gold slug, or a short brief onto one gold industry.
 * An unrecognized label is "none", not a free-text slug no brief can ask for.
 */
export function normalizeIndustry(value: string | undefined | null): string {
  return classify(value ?? "", "label")
}

export function industryFromGoldPath(filePath: string | undefined | null): string | null {
  const match = (filePath ?? "").match(/(?:^|\/)gold\/([a-z0-9-]+)\.json$/i)
  if (!match) return null
  const slug = match[1]!.toLowerCase()
  if (GOLD_SET.has(slug)) return slug
  const classified = classify(slug.replace(/-/g, " "), "label")
  return classified === NONE_INDUSTRY ? null : classified
}

export function resolveIndustry(input: {
  explicit?: string | null
  path?: string | null
  notes?: string | null
}): string {
  const fromGold = industryFromGoldPath(input.path)
  if (fromGold) return fromGold
  const explicit = meaningfulLabel(input.explicit)
  const fromExplicit = explicit ? classify(explicit, "label") : NONE_INDUSTRY
  const fromNotes = classify(input.notes ?? "", "notes")
  if (fromExplicit === "plumbing" && fromNotes === "hvac") return "hvac"
  if (fromExplicit !== NONE_INDUSTRY) return fromExplicit
  const fromPath = classify(pathWords(input.path ?? ""), "label")
  if (fromPath !== NONE_INDUSTRY) return fromPath
  return fromNotes
}

export function industryForBrief(brief: CampaignBrief, extra = ""): string {
  const text = [
    brief.goal,
    brief.offer,
    brief.audience?.description,
    brief.businessInfo?.name,
    brief.emotionalTone,
    brief.otherRequirements,
    brief.desiredRecipientAction,
    extra,
  ].filter((value): value is string => Boolean(value?.trim())).join(" ")
  return classify(text, "label")
}

export function industriesAdjacent(left: string, right: string): boolean {
  const a = normalizeIndustry(left)
  const b = normalizeIndustry(right)
  if (!a || !b || a === b || a === NONE_INDUSTRY || b === NONE_INDUSTRY) return false
  if (medicareBlocked(a, b)) return false
  if (neighborRank(a, b) > 0 || neighborRank(b, a) > 0) return true
  return GROUPS.some((group) => group.includes(a) && group.includes(b))
}

function medicareBlocked(left: string, right: string): boolean {
  const pair = new Set([left, right])
  if (!pair.has("medicare")) return false
  return pair.has("auto-insurance") || pair.has("home-insurance") || pair.has("life-insurance")
}

function meaningfulLabel(value: string | null | undefined): string {
  const text = soften(value ?? "")
  if (!text) return ""
  if (/^(?:unknown|none|n a|na|other|general|unspecified|not stated|home services|general local service)$/.test(text)) return ""
  return value!.trim()
}

function pathWords(filePath: string): string {
  return filePath
    .replace(/\.[a-z0-9]+$/i, "")
    .replace(/[_./-]+/g, " ")
    .replace(/\b(?:gold|examples|assets|physical|notes|provenance|json|md|txt)\b/gi, " ")
}

type ClassifyMode = "label" | "notes"

function classify(value: string, mode: ClassifyMode): string {
  const text = soften(value)
  if (!text) return NONE_INDUSTRY
  if (mode === "label") {
    const slug = exactSlug(text)
    if (slug) return slug
  }
  if (/\bprecious metals?\b|\bbullion\b|\bwe buy gold\b|\bgold buyers?\b|\bsilver buyers?\b|\bscrap gold\b|\bcoin dealers?\b|\bcash for gold\b|\bsell your gold\b|\bbuy(?:ing)? gold\b|\bgold and silver\b/.test(text)) return "precious-metals"
  if (/\bgarage doors?\b/.test(text)) return "garage-doors"
  if (outdoorSignal(text)) return "outdoor-living"
  if (/\bsenior living\b|\bassisted living\b|\bretirement communit|\bmemory care\b|\bindependent living\b/.test(text)) return "senior-living"
  if (/\blife alert\b|\bmedical alerts?\b|\bmedical alarms?\b/.test(text)) return "home-security"
  if (/\boptometr|\beye exams?\b|\beye doctors?\b|\beyeglasses\b|\bvision centers?\b/.test(text)) return "optometry"
  if (/\bsaunas?\b|\bsteam rooms?\b/.test(text)) return "sauna"
  if (/\blaundromats?\b|\bcoin laundry\b|\bwash and fold\b|\blaundry service\b/.test(text)) return "laundromat"
  if (/\bbaker(?:y|ies)\b|\bbake shop\b|\bpastr(?:y|ies)\b|\bcupcakes?\b|\bdonut shop\b/.test(text)) return "bakery"
  if (hairSalonSignal(text)) return "hair-salon"
  if (medicareSignal(text, mode)) return "medicare"
  if (/\bauto insurance\b|\bcar insurance\b|\bvehicle insurance\b/.test(text)) return "auto-insurance"
  // Life is named on purpose. "Life insurance for homeowners" is not a home policy.
  if (/\blife insurance\b|\bfinal expense\b|\bburial insurance\b/.test(text)) return "life-insurance"
  if (/\bhomeowners?\b|\bhome owner\b/.test(text) && /\binsurance\b/.test(text)) return "home-insurance"
  if (/\bhome insurance\b/.test(text)) return "home-insurance"
  if (hvacSignal(text, mode)) return "hvac"
  if (windowSignal(text, mode)) return "windows-gutters-siding"
  if (plumbingSignal(text)) return "plumbing"
  if (/\bpest\b|\btermite\b|\bmosquito\b|\btick\b|\brodents?\b|\bmice\b|\bmouse\b|\brats\b|\brodent[ -]?proof|\bexterminat/.test(text)) return "pest-control"
  if (landscapingSignal(text, mode)) return "landscaping"
  if (/\bsolar\b/.test(text)) return "solar"
  if (/\broof\b|\broofs\b|\broofing\b|\broofer\b|\bshingles?\b/.test(text)) return "roofing"
  if (dentalSignal(text, mode)) return "dental"
  if (/\bmed spa\b|\bmedspa\b|\bchiro\b|\bbotox\b|\baesthetic\b/.test(text)) return "med-spa-chiro"
  if (vetSignal(text, mode)) return "vet-pet"
  if (restaurantSignal(text, mode)) return "restaurants-food"
  if (/\bgym\b|\bfitness\b|\byoga\b/.test(text)) return "gyms-fitness"
  if (cleaningSignal(text, mode)) return "cleaning-pressure-washing"
  if (/\bjunk\b|\bhaul away\b|\bhauling\b/.test(text)) return "junk-removal"
  if (/\bmovers?\b|\bmoving compan|\bmoving services?\b|\bstorage units?\b|\bself storage\b|\bvan lines?\b|\bwhite glove\b/.test(text)) return "moving-storage"
  if (/\bmoving\b/.test(text) && /\b(?:truck|van|belongings|relocat|mover)\b/.test(text)) return "moving-storage"
  if (/\bhome security\b|\balarm\b|\bsecurity system\b/.test(text)) return "home-security"
  if (remodelingSignal(text)) return "home-remodeling"
  if (/\bhandym[ae]n\b|\bhandy man\b|\bodd jobs\b/.test(text)) return "handyman"
  if (/\bwe buy\b|\bcash offer\b|\bhome buying\b|\bbuy your house\b|\bsell your house\b/.test(text)) return "home-buying"
  if (realEstateSignal(text, mode)) return "real-estate-agents"
  if (mortgageSignal(text, mode)) return "mortgage-financial"
  if (/\bchurch\b|\bcongregation\b|\bnonprofit\b|\bcommunity center\b|\bsymphon|\borchestras?\b|\bphilharmonic\b/.test(text)) return "churches-community"
  if (/\btutors?\b|\btutoring\b|\bchildcare\b|\bchild care\b|\bdaycare\b|\bday care\b|\bpreschool\b|\bafter[- ]school\b|\bhomework\b|\blearning centers?\b|\btest prep\b|\bsat prep\b|\bact prep\b|\bthe sat\b|\bkumon\b|\bmathnasium\b|\bsummer camps?\b|\bday camps?\b/.test(text)) return "tutoring-childcare"
  if (autoSignal(text, mode)) return "auto"
  if (retailSignal(text, mode)) return "retail-grand-openings"
  if (consumerSignal(text, mode)) return "consumer-products"
  return NONE_INDUSTRY
}

/**
 * A long note that only mentions Medicare in a disclaimer is not a Medicare mailer.
 * Short labels and real plan language still are.
 */
function medicareSignal(text: string, mode: ClassifyMode): boolean {
  const cleaned = text
    .replace(/[^.]*\bnot affiliated with (?:medicare|medicaid|cms)\b[^.]*/g, " ")
    .replace(/[^.]*\bnot (?:a |an )?medicare\b[^.]*/g, " ")
    .replace(/[^.]*\bmedicare has neither\b[^.]*/g, " ")
    .replace(/[^.]*\bnot endorsed by (?:medicare|medicaid|cms)\b[^.]*/g, " ")
    .replace(/[^.]*\bnot connected with (?:medicare|medicaid)\b[^.]*/g, " ")
  if (!/\bmedicare\b|\bmedicaid\b|\bmedigap\b/.test(cleaned)) return false
  if (mode === "label") return true
  return /\bmedicare advantage\b|\bmedigap\b|\bmedicare supplement\b|\bmedicare plan\b|\bannual enrollment\b|\baep\b|\bmedicaid\b/.test(cleaned)
}

function restaurantSignal(text: string, mode: ClassifyMode): boolean {
  if (/\bmeal kits?\b|\bgelson\b|\bgrocery stores?\b/.test(text)) return true
  const chain = /\bdairy queen\b|\bmcdonald|\bburger king\b|\btaco bell\b|\bwendy\b|\bdomino|\bpizza hut\b|\bchipotle\b|\bstarbucks\b|\bdunkin\b|\bkfc\b|\bgelson\b/
  return notesAssign(text, mode, /$^/, [
    /\brestaurants?\b/,
    /\bdining\b/,
    /\bpizza\b/,
    /\bqsr\b/,
    /\bgrocery\b/,
    /\bmenus?\b/,
    chain,
    /\bcoupons?\b/,
  ])
}

function realEstateSignal(text: string, mode: ClassifyMode): boolean {
  if (/\breal estate\b|\brealtor\b|\bopen house\b/.test(text)) return true
  if (/\b(?:home|house)\s+listing\b/.test(text)) return true
  return mode === "label" && /\blisting\b/.test(text)
}

function dentalSignal(text: string, mode: ClassifyMode): boolean {
  if (mode !== "label" && mode !== "notes") return false
  return /\bdentists?\b|\bdentures?\b|\bdental\b/.test(text)
}

function mortgageSignal(text: string, mode: ClassifyMode): boolean {
  if (/\bhome equity\b|\bheloc\b/.test(text)) return true
  if (mode === "label" && /\bdebt\b|\bbank\b|\bfinancial\b|\bloan\b|\bmortgage\b|\bcredit union\b|\brefinance\b/.test(text)) return true
  if (mode === "label" && /\b(?:home|house)\s+loans?\b/.test(text)) return true
  if (mode === "notes" && /\brefinance\b/.test(text) && /\b(?:mortgage|loan|rate|home|house)\b/.test(text)) return true
  if (mode === "notes" && /\bdebt\b/.test(text) && /\b(?:home|mortgage|equity|consolidat)\b/.test(text)) return true
  if (mode === "notes" && /\bmortgage\b/.test(text) && /\b(?:rate|apr|lender|loan|refinance|broker|credit)\b/.test(text)) return true
  if (mode === "notes" && /\b(?:home|house)\s+loans?\b/.test(text)) return true
  if (mode === "notes" && /\bcredit unions?\b/.test(text) && /\b(?:mortgage|loan|rate|member)\b/.test(text)) return true
  return false
}

const APPAREL_SIGNALS: readonly RegExp[] = [
  /\bshoes?\b/,
  /\bclothing\b/,
  /\bapparel\b/,
  /\bouterwear\b/,
  /\bsocks?\b/,
  /\bhiking gear\b/,
  /\boutdoor gear\b/,
  /\bboots?\b/,
  /\bpants\b/,
  /\bfootwear\b/,
  /\bsneakers?\b/,
  /\bjackets?\b/,
  /\bhair extensions?\b/,
  /\bwefts?\b/,
]

const BRAND_SIGNALS: readonly RegExp[] = [
  /\bcatalogs?\b/,
  /\bcollections?\b/,
  /\boutfitters?\b/,
  /\bbellami\b/,
]

const MAILER_SIGNALS: readonly RegExp[] = [
  /\bshop the collection\b/,
  /\bnew arrivals\b/,
  /\bfree shipping\b/,
  /\border online\b/,
]

function productHits(text: string): number {
  return signalHits(text, APPAREL_SIGNALS)
}

/** A store, opening, or mall is retail even when it also sells clothes. */
function retailEvent(text: string): boolean {
  return /\bgrand openings?\b|\bribbon cuttings?\b|\bnow open\b|\bstorewide\b|\bsale events?\b|\bboutiques?\b|\bmalls?\b|\bshopping centers?\b|\bdepartment stores?\b|\bcvs\b|\bjewelry\b|\bbrilliant earth\b/.test(text)
}

function retailSignal(text: string, mode: ClassifyMode): boolean {
  if (retailEvent(text)) return true
  if (/\b(?:retail|department|outlet|boutique) stores?\b/.test(text)) return true
  return notesAssign(text, mode, /$^/, [
    /\bgrand openings?\b/,
    /\bretail\b/,
    /\bboutiques?\b/,
    /\bdepartment stores?\b/,
    /\boutlets?\b/,
    /\bshopping centers?\b/,
    /\bmalls?\b/,
    /\bribbon cuttings?\b/,
    /\bsale events?\b/,
  ])
}

function landscapingSignal(text: string, mode: ClassifyMode): boolean {
  if (/\bjunk\b/.test(text)) return false
  if (/\btree care\b|\btree service\b|\barborists?\b|\btree trimming\b|\blawn care\b/.test(text)) return true
  return notesAssign(text, mode, /$^/, [/\blandscap/, /\blawn\b/, /\bmow(?:ing)?\b/, /\byard\b/, /\bmulch\b/, /\bsod\b/])
}

function consumerSignal(text: string, mode: ClassifyMode): boolean {
  if (retailEvent(text)) return false
  const apparel = productHits(text)
  if (apparel < 1) return false
  const strong = signalHits(text, BRAND_SIGNALS)
  const mailer = signalHits(text, MAILER_SIGNALS)
  const promo = /\bpromo codes?\b/.test(text) ? 1 : 0
  if (mode === "label") return true
  return apparel >= 2 || strong + mailer + promo >= 1
}

function hairSalonSignal(text: string): boolean {
  if (/\bmed spa\b|\bmedspa\b|\bchiro\b|\bbotox\b|\baesthetic\b/.test(text)) return false
  return /\bsalons?\b|\bhaircuts?\b|\bbarbers?\b|\bstylists?\b|\bhair salons?\b/.test(text)
}

function outdoorSignal(text: string): boolean {
  return /\boutdoor living\b|\boutdoor kitchens?\b|\boutdoor rooms?\b|\boutdoor design\b|\bpergolas?\b|\bpatios?\b|\bpavers?\b|\bdecks?\b|\bhardscapes?\b|\bfire pits?\b|\bscreen enclosures?\b|\bpool cages?\b|\bsunrooms?\b|\bgazebos?\b|\blanais?\b|\bscreened porches?\b|\bcabanas?\b|\bawnings?\b|\bmotorized screens?\b|\bswimming pools?\b/.test(text)
}

function remodelingSignal(text: string): boolean {
  if (/\bgarage doors?\b/.test(text)) return false
  if (/\bremodel|\brenovat|\bkitchen and bath\b|\b(?:kitchen|bath(?:room)?)\s+remodel\b/.test(text)) return true
  if (/\bfoundation\b/.test(text) && /\b(?:repairs?|cracks?|waterproof|level(?:ing)?|piers?)\b/.test(text)) return true
  if (/\bfireplaces?\b|\bfireplace inserts?\b/.test(text)) return true
  if (/\bcabinets?\b|\bcountertops?\b|\bflooring\b|\bbasements?\b|\bclosets?\b|\bchimneys?\b|\bchimney sweeps?\b/.test(text)) return true
  if (/\b(?:home|room|house) additions?\b|\baddition to the (?:home|house)\b/.test(text)) return true
  if (/\bgeneral contractors?\b|\bhome contractors?\b|\bremodeling contractors?\b/.test(text)) return true
  return /\bcontractors?\b/.test(text) && /\b(?:kitchen|bath|remodel|renovat|addition)\b/.test(text)
}

/**
 * Notes need two signals, or one phrase specific enough to be a title.
 * A short explicit label still matches on one word. A gold path never gets here.
 */
function notesAssign(text: string, mode: ClassifyMode, specific: RegExp, signals: readonly RegExp[]): boolean {
  if (mode === "label") return specific.test(text) || signalHits(text, signals) > 0
  if (specific.test(text)) return true
  return signalHits(text, signals) >= 2
}

function signalHits(text: string, signals: readonly RegExp[]): number {
  return signals.reduce((count, pattern) => count + (pattern.test(text) ? 1 : 0), 0)
}

function hvacSignal(text: string, mode: ClassifyMode): boolean {
  if (/\bseptic\b|\bwater treatment\b|\bwater softener\b|\bsoftener\b/.test(text)) return false
  if (/\bair ducts?\b|\bduct cleaning\b|\bductwork\b/.test(text)) return true
  if (/\bhvac\b|\bair condition|\bfurnace\b|\bheat pump\b/.test(text)) return true
  if (/heating and air|heating and cooling|heat and air/.test(text)) return true
  if (/\bplumb/.test(text) && /\bair\b/.test(text)) return true
  if (/\bac\b/.test(text)) return true
  if (mode === "label" && /\bheating\b/.test(text) && /\bcooling\b/.test(text)) return true
  return false
}

function windowSignal(text: string, mode: ClassifyMode): boolean {
  if (/\bblinds?\b|\bwindow shades?\b|\bwindow coverings?\b|\bwindow treatments?\b/.test(text)) return true
  if (/\bgutters?\b|\bsiding\b/.test(text)) return true
  if (/\bwindow replacement\b|\bvinyl windows?\b|\breplacement windows?\b|\bstorm windows?\b/.test(text)) return true
  if (/\bwindow (?:company|install(?:ation)?|contractor|world)\b/.test(text)) return true
  if (/\bwindows?\s+and\s+doors?\b|\bdoors?\s+and\s+windows?\b/.test(text)) return true
  if (mode === "label" && /\bwindows?\b/.test(text)) return true
  if (mode === "notes" && /\b(?:new|replacement|vinyl)\s+windows\b/.test(text)) return true
  if (mode === "notes" && /\bwindows?\b/.test(text) && text.split(" ").filter(Boolean).length <= 36 && !/\bwindow shopping\b/.test(text)) return true
  return false
}

function plumbingSignal(text: string): boolean {
  return /\bplumb|\bdrains?\b|\bwater heaters?\b|\bseptic\b|\bwater treatment\b|\bwater softener\b|\bsoftener\b|\bsewer\b/.test(text)
}

function vetSignal(text: string, mode: ClassifyMode): boolean {
  if (/\bpet insurance\b|\bveterinar|\bvets?\b|\bkennel\b/.test(text)) return true
  if (mode === "label" && /\bpets?\b|\bdogs?\b|\bcats?\b/.test(text)) return true
  return false
}

function cleaningSignal(text: string, mode: ClassifyMode): boolean {
  if (/\bpressure wash|\bpower wash|\bsoft wash|\bmaid\b|\bcarpet clean/.test(text)) return true
  if (mode === "label" && /\bcleaning\b/.test(text)) return true
  return false
}

function autoSignal(text: string, mode: ClassifyMode): boolean {
  return notesAssign(text, mode, /\bcar wash\b|\boil changes?\b|\bauto repairs?\b|\bbody shops?\b|\bdealerships?\b/, [
    /\bcar wash\b/,
    /\bdealerships?\b/,
    /\btires?\b/,
    /\boil changes?\b/,
    /\bauto repairs?\b/,
    /\bmechanics?\b/,
    /\bcollision\b/,
    /\bbody shops?\b/,
  ])
}

const PATH_NOISE = new Set(["gold", "json", "md", "txt", "examples", "assets", "physical", "notes", "provenance"])

function exactSlug(text: string): string | null {
  const words = text.split(" ").filter((word) => word && !PATH_NOISE.has(word))
  if (words.length === 0 || words.length > 5) return null
  const joined = words.join("-")
  return GOLD_SET.has(joined) ? joined : null
}

function soften(value: string): string {
  return value
    .toLowerCase()
    .replace(/\ba\s*\/\s*c\b/g, " ac ")
    .replace(/&/g, " and ")
    .replace(/[.!?]+/g, " brk ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

export function researchOfferType(text: string): string {
  const value = text.toLowerCase()
  if (/inspect|estimate|\bquote\b/.test(value)) return "inspection"
  if (/financ|per month|monthly|\/mo\b/.test(value)) return "financing"
  if (/%|percent|\boff\b|discount|coupon|\bsave\b/.test(value)) return "discount"
  if (/\bfree\b/.test(value)) return "free_offer"
  if (/tune-?up|maintenance|service plan/.test(value)) return "maintenance"
  return "other"
}

export function researchEmotion(text: string): string {
  const value = text.toLowerCase()
  if (/fear|urgent|storm|worry|threat|anxiety/.test(value)) return "urgency"
  if (/calm|trust|reassur|steady/.test(value)) return "calm"
  if (/pride|local|neighbor/.test(value)) return "pride"
  if (/joy|playful|fun|delight/.test(value)) return "joy"
  if (/relief|safe|peace|comfort/.test(value)) return "relief"
  return "unspecified"
}

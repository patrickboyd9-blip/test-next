import assert from "node:assert/strict"
import test from "node:test"

import type { CampaignBrief } from "@/lib/campaign-creator/types"
import { publicDirectionLine } from "@/lib/campaign-creator/customer-direction-line"
import { selectReferences } from "@/lib/design-intelligence/select"
import type { LibraryRecord } from "@/lib/design-intelligence/library"
import { verticalForBrief } from "@/lib/design-intelligence/vertical"

import { industryCounts } from "./coverage"
import { GOLD_INDUSTRIES, industryForBrief, normalizeIndustry, resolveIndustry, type GoldIndustry } from "./industry"
import { dedupeResearchEntries, indexSourceFiles, type SourceFile } from "./parse"
import { queryFromBrief, retrieveResearch } from "./retrieve"

const SAMPLE_BRIEFS: Record<GoldIndustry, CampaignBrief> = {
  "auto-insurance": { goal: "Ask for an auto insurance quote", offer: "A written car insurance quote" },
  auto: { goal: "Book a car wash", offer: "A free oil change at the dealership" },
  "churches-community": { goal: "Invite the church congregation", offer: "Sunday at the church" },
  "cleaning-pressure-washing": { goal: "Book pressure washing", offer: "Free pressure wash estimate" },
  dental: { goal: "Book a dental cleaning", offer: "Free dental exam" },
  "gyms-fitness": { goal: "Join the gym", offer: "A free fitness week" },
  "home-buying": { goal: "We buy houses for cash", offer: "A cash offer this week" },
  "home-insurance": { goal: "Review homeowners insurance", offer: "A home insurance quote" },
  "home-remodeling": { goal: "Remodel the kitchen", offer: "Free remodeling estimate" },
  "home-security": { goal: "Install a home security system", offer: "Free alarm consult" },
  hvac: { goal: "Cool the house", offer: "Free inspection for broken AC units" },
  "junk-removal": { goal: "Haul the junk away", offer: "Free junk removal estimate" },
  landscaping: { goal: "Mow and landscape the lawn", offer: "Free lawn estimate" },
  "life-insurance": { goal: "Review life insurance", offer: "A life insurance quote" },
  "med-spa-chiro": { goal: "Book a chiropractic visit", offer: "Free chiro consult" },
  medicare: { goal: "Review Medicare coverage", offer: "A Medicare plan review" },
  "mortgage-financial": { goal: "Refinance the mortgage", offer: "A credit union check" },
  "moving-storage": { goal: "Book movers and a storage unit", offer: "Free moving estimate" },
  "pest-control": { goal: "Treat the house for termites", offer: "Free pest inspection" },
  plumbing: { goal: "Clear a drain and check the water heater", offer: "Free plumbing check" },
  "real-estate-agents": { goal: "List the house with a realtor", offer: "A free listing consult" },
  "restaurants-food": { goal: "Fill the restaurant on Tuesday", offer: "A pizza night special" },
  "retail-grand-openings": { goal: "Announce a grand opening", offer: "Store opening week" },
  roofing: { goal: "Replace the roof shingles", offer: "Free roof inspection" },
  solar: { goal: "Install solar panels", offer: "Free solar quote" },
  "tutoring-childcare": { goal: "Enroll in childcare and tutoring", offer: "A daycare visit" },
  "vet-pet": { goal: "Book a vet visit for the dog", offer: "Free pet exam" },
  "windows-gutters-siding": { goal: "Replace the gutters and siding", offer: "Free window estimate" },
}

function legacyIndustry(value: string): string {
  const text = value.toLowerCase().replace(/&/g, " and ").replace(/[^a-z0-9]+/g, " ").trim()
  if (!text) return "unknown"
  const aliases: readonly [RegExp, string][] = [
    [/\broof|shingle|gutter/, "roofing"],
    [/\bhvac|air condition|furnace|heating and cooling/, "hvac"],
    [/\bplumb|drain|water heater/, "plumbing"],
    [/\belectric/, "electrical"],
    [/\bsolar/, "solar"],
    [/\bpest|termite/, "pest_control"],
    [/\blandscap|lawn/, "landscaping"],
    [/\bjunk/, "junk_removal"],
    [/\bauto insurance|\bcar insurance|\bvehicle insurance/, "auto_insurance"],
    [/\bhomeowners insurance\b|\bhome insurance\b/, "home_insurance"],
    [/\blife insurance/, "life_insurance"],
    [/\bmedicare|\bmedicaid/, "medicare"],
    [/\breal estate|\brealtor|\blisting/, "real_estate"],
    [/\bdental|\bdentist/, "dental"],
    [/\brestaurant|\bdining/, "restaurant"],
    [/\bfitness|\bgym/, "fitness"],
    [/\binsurance/, "insurance"],
  ]
  for (const [pattern, id] of aliases) {
    if (pattern.test(text)) return id
  }
  return text.replace(/\s+/g, "_").slice(0, 48)
}

const CORPUS: { label: string; file: SourceFile }[] = [
  {
    label: "Anderson Plumbing, Heating and Air $99 service",
    file: {
      path: "assets/physical/PM-015/provenance.json",
      ref: "c3po",
      json: {
        id: "PM-015",
        advertiser: "Anderson Plumbing, Heating and Air",
        offer: "$99 service",
        headline: "One service call",
        notes: "Provenance: Anderson Plumbing, Heating and Air. The offer is a $99 service call.",
      },
    },
  },
  {
    label: "AirMaxx heating-and-air",
    file: {
      path: "assets/physical/PM-025/notes.md",
      ref: "c3po",
      text: "# PM-025\nCompany: AirMaxx\nHeadline: Heating and air, one phone\nOffer: Free estimate\nNotes: heating-and-air postcard.\n",
    },
  },
  {
    label: "Anderson water softener",
    file: {
      path: "assets/physical/PM-034/provenance.json",
      ref: "c3po",
      json: {
        id: "PM-034",
        advertiser: "Anderson",
        offer: "Water softener offer",
        headline: "Softer water",
        notes: "Water softener offer. Water treatment, not a furnace.",
      },
    },
  },
  {
    label: "We Care plumbing",
    file: {
      path: "assets/physical/PM-008/provenance.json",
      ref: "c3po",
      json: {
        id: "PM-008",
        advertiser: "We Care Plumbing",
        offer: "Drain check",
        headline: "The drain",
        notes: "We Care plumbing. A drain check.",
      },
    },
  },
  {
    label: "gold hvac without an industry field",
    file: {
      path: "gold/hvac.json",
      ref: "mando",
      json: [
        { id: "GOLD-hvac-011", headline_text: "A quieter tune-up", offer_text: "$89 tune-up" },
        { id: "GOLD-hvac-012", headline_text: "Before the heat", offer_text: "Free AC inspection" },
      ],
    },
  },
  {
    label: "gold windows gutters siding",
    file: {
      path: "gold/windows-gutters-siding.json",
      ref: "mando",
      json: { id: "GOLD-windows-gutters-siding-001", headline_text: "New gutters", offer_text: "Free gutter estimate" },
    },
  },
  {
    label: "MMR furnace with no industry field",
    file: {
      path: "examples/MMR-585.md",
      ref: "mando",
      text: "# MMR-585\n\n## OBSERVED\n- Headline: \"The furnace before winter\"\n- Offer: tune-up\n\n## INFERRED\nOne machine.\n\n## INTERPRETATION\nWhy it works: the furnace is the subject.\n",
    },
  },
  {
    label: "MMR vertical car wash shared mail",
    file: {
      path: "examples/MMR-340.md",
      ref: "mando",
      text: "# MMR-340\n\n## OBSERVED\n- Vertical: car_wash_shared_mail\n- Headline: \"The Saturday wash\"\n- Offer: free wash\n\n## INFERRED\nOne offer.\n\n## INTERPRETATION\nWhy it works: one wash.\n",
    },
  },
  {
    label: "MMR gutter tagged by the word gutter",
    file: {
      path: "examples/MMR-101.md",
      ref: "mando",
      text: "# MMR-101\n\n## OBSERVED\n- Vertical: gutters\n- Headline: \"The gutter after the storm\"\n- Offer: free estimate\n\n## INFERRED\nOne gutter.\n\n## INTERPRETATION\nWhy it works: the gutter is the subject.\n",
    },
  },
]

test("every gold industry is reachable from a sample brief", () => {
  const reached = new Set<string>()
  for (const industry of GOLD_INDUSTRIES) {
    const resolved = industryForBrief(SAMPLE_BRIEFS[industry])
    assert.equal(resolved, industry, `${industry} resolved to ${resolved}`)
    reached.add(resolved)
  }
  assert.equal(reached.size, GOLD_INDUSTRIES.length)
})

test("Patrick's broken AC offer resolves to HVAC and beats roofing and plumbing", () => {
  const offer = "Free inspection for broken AC units"
  assert.equal(industryForBrief({ offer }), "hvac")
  assert.equal(verticalForBrief({ offer }), "hvac")
  assert.equal(industryForBrief({ goal: "Service the roof-top AC", offer }), "hvac")
  assert.equal(industryForBrief({ businessInfo: { name: "Heating & Air" }, offer: "Free estimate" }), "hvac")
  assert.equal(industryForBrief({ businessInfo: { name: "Plumbing & Air" }, offer: "Free estimate" }), "hvac")
  assert.equal(industryForBrief({ offer: "A/C tune-up" }), "hvac")
  assert.equal(normalizeIndustry("heating-and-air"), "hvac")
  assert.equal(normalizeIndustry("gutters"), "windows-gutters-siding")
  assert.equal(normalizeIndustry("car_wash_shared_mail"), "auto")
  assert.equal(industryForBrief({ goal: "We Care plumbing", offer: "Drain check" }), "plumbing")
  assert.equal(industryForBrief({ goal: "Ask for an auto insurance quote", offer: "A written quote" }), "auto-insurance")
  assert.notEqual(verticalForBrief({ goal: "Ask for an auto insurance quote", offer: "A written quote" }), "medicare_insurance")
  assert.equal(verticalForBrief({ goal: "Book a Medicare plan review", offer: "Free plan review" }), "medicare_insurance")
})

test("provenance notes give C-3PO pieces an industry, a headline, and an offer", () => {
  const indexed = indexSourceFiles(CORPUS.map((item) => item.file))
  const byId = new Map(indexed.entries.map((entry) => [entry.id, entry]))
  assert.equal(byId.get("PM-015")?.industry, "hvac")
  assert.match(byId.get("PM-015")?.offers.join(" ") ?? "", /\$99/)
  assert.ok((byId.get("PM-015")?.headlines.length ?? 0) > 0)
  assert.equal(byId.get("PM-025")?.industry, "hvac")
  assert.match(byId.get("PM-025")?.offers.join(" ") ?? "", /estimate/i)
  assert.equal(byId.get("PM-034")?.industry, "plumbing")
  assert.equal(byId.get("PM-008")?.industry, "plumbing")
  assert.equal(byId.get("GOLD-hvac-011")?.industry, "hvac")
  assert.equal(byId.get("GOLD-hvac-012")?.industry, "hvac")
  assert.equal(byId.get("GOLD-windows-gutters-siding-001")?.industry, "windows-gutters-siding")
  assert.equal(byId.get("MMR-585")?.industry, "hvac")
  assert.equal(byId.get("MMR-340")?.industry, "auto")
  assert.equal(byId.get("MMR-101")?.industry, "windows-gutters-siding")

  const hvacBrief: CampaignBrief = { goal: "Cool the house", offer: "Free inspection for broken AC units" }
  const hits = retrieveResearch(indexed.entries, queryFromBrief(hvacBrief), 6)
  assert.equal(hits.hits[0]?.entry.industry, "hvac")
  assert.ok(hits.hits.some((hit) => hit.entry.id === "PM-015" || hit.entry.id.startsWith("GOLD-hvac")))
  assert.equal(hits.hits.some((hit) => hit.entry.industry === "roofing" && hit.band === "same"), false)
  assert.equal(hits.hits.some((hit) => hit.entry.industry === "real-estate-agents" && hit.band === "same"), false)
})

test("the sample corpus maps more HVAC records than the old alias list", () => {
  const indexed = indexSourceFiles(CORPUS.map((item) => item.file))
  const after = industryCounts(indexed.entries)
  const before: Record<string, number> = {}
  for (const item of CORPUS) {
    const legacy = legacyIndustry(item.label)
    before[legacy] = (before[legacy] ?? 0) + 1
  }
  const beforeHvac = before.hvac ?? 0
  const afterHvac = after.hvac ?? 0
  assert.ok(afterHvac > beforeHvac, `HVAC before ${beforeHvac}, after ${afterHvac}`)
  assert.ok((before.roofing ?? 0) >= 1)
  assert.equal(after.roofing ?? 0, 0)
  assert.ok((after["windows-gutters-siding"] ?? 0) >= 2)
  assert.equal(after.plumbing, 2)
})

test("pest control and restaurants are not dropped, and insurance is not all Medicare", () => {
  const pest: LibraryRecord = {
    id: "PM-056",
    source: "seed",
    vertical: "pest_control",
    grade: "A-",
    needsAnalysis: false,
    images: [],
    analysis: { id: "PM-056", vertical: "pest_control", grade: "A-", summary: "Wondercide pest control postcard." },
  }
  const restaurant: LibraryRecord = {
    id: "PM-057",
    source: "seed",
    vertical: "restaurant",
    grade: "A-",
    needsAnalysis: false,
    images: [],
    analysis: { id: "PM-057", vertical: "restaurant", grade: "A-", summary: "Dairy Queen restaurant coupon." },
  }
  const heating: LibraryRecord = {
    id: "PM-015",
    source: "seed",
    vertical: "plumbing",
    grade: "C+",
    needsAnalysis: false,
    images: [],
    analysis: { id: "PM-015", vertical: "plumbing", grade: "C+", summary: "Mailbox plumbing and air card." },
  }
  const env = { DESIGN_OWNER_FAVORITES: "PM-999" } as NodeJS.ProcessEnv
  const pestPick = selectReferences([pest, restaurant], { goal: "Treat for termites", offer: "Free pest inspection" }, env)
  assert.ok(pestPick.peers.some((pick) => pick.id === "PM-056"))
  const foodPick = selectReferences([pest, restaurant], { goal: "Fill the restaurant", offer: "A pizza special" }, env)
  assert.ok(foodPick.peers.some((pick) => pick.id === "PM-057"))
  const hvacPick = selectReferences([heating], { offer: "Free inspection for broken AC units" }, env)
  assert.ok(hvacPick.peers.some((pick) => pick.id === "PM-015"))
  assert.equal(verticalForBrief({ goal: "Review homeowners insurance", offer: "A home insurance quote" }), "general_local_service")
})

test("a photo-folder copy keeps the provenance industry, headline, and offer", () => {
  const note = indexSourceFiles([
    {
      path: "assets/physical/PM-015/provenance.json",
      ref: "c3po",
      json: {
        id: "PM-015",
        notes: "Anderson Plumbing, Heating and Air.\nPrinted headline: One service call\nPrinted offer: $99 service",
      },
    },
    {
      path: "assets/physical/PM-039/notes.md",
      ref: "c3po",
      text: "PM-039\nHeating and air.\nPrinted headline: Cool air by evening\nPrinted offer: $410 off a new system\n",
    },
    {
      path: "assets/physical/PM-047/notes.md",
      ref: "c3po",
      text: "PM-047\nA window and door mailer.\nPrinted headline: The new opening\nPrinted offer: Free window estimate\n",
    },
    {
      path: "assets/physical/PM-057/notes.md",
      ref: "c3po",
      text: "PM-057\nDairy Queen coupon.\nPrinted headline: Tuesday night\nPrinted offer: A free cone\n",
    },
  ])
  const folder = indexSourceFiles([
    {
      path: "assets/physical/PM-015/",
      ref: "c3po",
      json: { id: "PM-015", images: ["assets/physical/PM-015/front.jpg"] },
    },
  ])
  const byId = new Map(note.entries.map((entry) => [entry.id, entry]))
  assert.equal(byId.get("PM-039")?.industry, "hvac")
  assert.match(byId.get("PM-039")?.headlines.join(" ") ?? "", /Cool air/)
  assert.match(byId.get("PM-039")?.offers.join(" ") ?? "", /\$410/)
  assert.equal(resolveIndustry({ notes: "window and door mailer" }), "windows-gutters-siding")
  assert.equal(byId.get("PM-047")?.industry, "windows-gutters-siding")
  assert.equal(resolveIndustry({ notes: "Dairy Queen coupon" }), "restaurants-food")
  assert.equal(byId.get("PM-057")?.industry, "restaurants-food")
  assert.match(byId.get("PM-057")?.offers.join(" ") ?? "", /cone/i)

  for (const order of [
    [folder.entries[0]!, note.entries.find((entry) => entry.id === "PM-015")!],
    [note.entries.find((entry) => entry.id === "PM-015")!, folder.entries[0]!],
  ]) {
    const merged = dedupeResearchEntries(order)
    assert.equal(merged.length, 1)
    assert.equal(merged[0]?.industry, "hvac")
    assert.match(merged[0]?.headlines.join(" ") ?? "", /service call/i)
    assert.match(merged[0]?.offers.join(" ") ?? "", /\$99/)
    assert.ok(merged[0]?.imageRefs.some((ref) => ref.endsWith("front.jpg")))
  }
})

test("life insurance and tutoring briefs reach their own industries", () => {
  assert.equal(
    industryForBrief({ goal: "Life insurance for homeowners", offer: "A family policy" }),
    "life-insurance"
  )
  assert.equal(industryForBrief({ goal: "Book tutoring", offer: "Homework help after school" }), "tutoring-childcare")
  assert.equal(industryForBrief({ goal: "Review homeowners insurance", offer: "A home insurance quote" }), "home-insurance")
  assert.equal(industryForBrief({ goal: "Ask the bank for a home loan", offer: "A written quote" }), "mortgage-financial")
})

test("a record outside the 28 industries stays none and is not a same-industry example", () => {
  const filler = "conference brochure ".repeat(20)
  const notes = `${filler} hotel gift shop and a bank financial webinar job listing. Not affiliated with Medicare.`
  assert.equal(resolveIndustry({ notes }), "none")
  assert.equal(normalizeIndustry("b2b travel"), "none")

  const indexed = indexSourceFiles([
    {
      path: "examples/MMR-900.md",
      ref: "mando",
      text: `# MMR-900\n\n## OBSERVED\n- Headline: "A long trip"\n\n## INFERRED\nOne brochure.\n\n## INTERPRETATION\n${notes}\n`,
    },
  ])
  const outsider = indexed.entries.find((entry) => entry.id === "MMR-900")
  assert.equal(outsider?.industry, "none")
  const hits = retrieveResearch(indexed.entries, queryFromBrief({ offer: "Free inspection for broken AC units" }), 6)
  assert.equal(hits.hits.some((hit) => hit.entry.id === "MMR-900" && hit.band === "same"), false)
  assert.equal(hits.hits.some((hit) => hit.entry.id === "MMR-900"), false)

  const heating: LibraryRecord = {
    id: "PM-015",
    source: "seed",
    vertical: "hvac",
    grade: "B",
    needsAnalysis: false,
    images: [],
    analysis: { id: "PM-015", vertical: "hvac", grade: "B", summary: "Heating and air service call." },
  }
  const travel: LibraryRecord = {
    id: "MMR-900",
    source: "seed",
    vertical: "b2b",
    grade: "A-",
    needsAnalysis: false,
    images: [],
    analysis: { id: "MMR-900", vertical: "b2b", grade: "A-", summary: notes },
  }
  const picked = selectReferences(
    [travel, heating],
    { offer: "Free inspection for broken AC units", businessInfo: { name: "Coastal Comfort Heating & Air" } },
    { DESIGN_OWNER_FAVORITES: "PM-999" } as NodeJS.ProcessEnv
  )
  assert.equal(picked.peers.some((peer) => peer.id === "MMR-900"), false)
  assert.ok(picked.peers.some((peer) => peer.id === "PM-015"))
})

test("customer lines hide blueprint ids and internal notes", () => {
  const hidden = publicDirectionLine("Blueprint: MMR-585 · urgent · Free inspection · Direct offer. Blueprint: MMR-585 · urgent · Free inspection · Direct offer.")
  assert.equal(hidden, null)
  const mixed = publicDirectionLine("The tune-up is the next step. Uses: sell the outcome. Learn the discipline. Do not copy the layout.")
  assert.equal(mixed, "The tune-up is the next step.")
})

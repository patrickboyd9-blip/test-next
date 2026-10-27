import type { CampaignBrief, CreativeDirection } from "../lib/campaign-creator/types"
import { rankCandidates } from "../lib/design-intelligence/candidate-board"
import { fixtureResearchIndex } from "../lib/research-library/fixtures"
import { clearResearchIndexMemory, loadResearchIndex } from "../lib/research-library"
import { queryFromBrief, retrieveResearch } from "../lib/research-library/retrieve"
import type { RetrievalHit } from "../lib/research-library/types"

/**
 * Shows what the real candidate board does for three businesses with the
 * research library on and off. The layout is the one the board paints.
 * Does not call an image API and does not print tokens.
 */

const businesses: { name: string; brief: CampaignBrief }[] = [
  {
    name: "Summit Roof Co (roofing)",
    brief: {
      goal: "Book roof inspections",
      offer: "Free roof inspection",
      audience: { description: "Homeowners in a storm belt" },
      businessInfo: { name: "Summit Roof Co" },
      emotionalTone: "urgent",
    },
  },
  {
    name: "Northwind Comfort (HVAC)",
    brief: {
      goal: "Book an HVAC tune-up",
      offer: "$89 tune-up",
      audience: { description: "Homeowners before summer" },
      businessInfo: { name: "Northwind Comfort" },
    },
  },
  {
    name: "Harbor Auto Cover (auto insurance)",
    brief: {
      goal: "Ask for an auto insurance quote",
      offer: "A written quote",
      audience: { description: "Drivers who own one family car" },
      businessInfo: { name: "Harbor Auto Cover" },
      emotionalTone: "calm",
    },
  },
]

const rulesEnv = {
  DESIGN_DIRECTOR: "rules",
  DESIGN_CRITIC: "machine",
  DESIGN_CANDIDATE_RENDERS: "off",
  DESIGN_CANDIDATE_COUNT: "3",
} as unknown as NodeJS.ProcessEnv

async function main(): Promise<void> {
  clearResearchIndexMemory()
  const live = await loadResearchIndex()
  const liveReady = live.entries.length > 0 && live.entries.some((entry) => !entry.id.startsWith("MMR-9") && !entry.id.startsWith("GOLD-") && !entry.id.startsWith("PM-9"))
  const index = liveReady ? live : fixtureResearchIndex()
  console.log(liveReady
    ? `Using the cached private-library index (${index.entries.length} records).`
    : "No live research index is cached in this environment. Showing the fixture library, which uses the same parser and ranker. Image renders were not produced: ANTHROPIC_API_KEY and OPENAI_API_KEY are not set here, and the private image files were not downloaded.")

  for (const business of businesses) {
    const retrieved = retrieveResearch(index.entries, queryFromBrief(business.brief), 5)
    const off = await leadFor(business.brief, [])
    const on = await leadFor(business.brief, retrieved.hits)
    console.log(`\n${business.name}`)
    console.log(`Retrieved: ${retrieved.hits.map((hit) => `${hit.entry.id} (${hit.band}, ${hit.entry.evidence}${hit.entry.gold ? ", gold" : ""})`).join("; ") || "none"}`)
    console.log(`Fallback: ${retrieved.fallback}`)
    console.log(`Headline: ${off.headline} -> ${on.headline}`)
    console.log(`Offer: ${off.offer} -> ${on.offer}`)
    console.log(`Layout: ${off.layout} -> ${on.layout}`)
    console.log(`Evidence: ${on.trace || "none"}`)
  }
}

async function leadFor(brief: CampaignBrief, hits: RetrievalHit[]) {
  const directions = directionsFor(brief)
  const board = await rankCandidates({
    brief,
    directions,
    trim: "5x8",
    env: rulesEnv,
    records: [],
    tastes: [],
    blueprints: [],
    researchHits: hits,
  })
  const lead = board.surfaced.find((candidate) => candidate.directionIndex === 0) ?? board.surfaced[0]
  const offerText = lead?.card.front.texts
    .filter((text) => text.role === "offer" || text.role === "body")
    .map((text) => text.text)
    .join(" ")
  const trace = lead?.evidenceTrace
  const traceLine = trace
    ? [
        trace.headlineId ? `headline ${trace.headlineId}` : "",
        trace.offerId ? `offer ${trace.offerId}` : "",
        trace.layoutId ? `layout ${trace.layoutId}` : "",
        trace.photoId ? `photo ${trace.photoId}` : "",
      ].filter(Boolean).join(", ")
    : ""
  return {
    headline: lead?.spec.headline ?? "",
    offer: offerText || lead?.spec.offer || "",
    layout: `${lead?.rationale.grid.intentional_break ?? "unset"} / ${lead?.spec.layoutHints?.templateId ?? "no template"} / hero ${lead?.rationale.scale_ratios.hero ?? "unset"}`,
    trace: traceLine,
  }
}

function directionsFor(brief: CampaignBrief): CreativeDirection[] {
  const headlines = ["Free inspection", "Wind on the ridge?", "One local visit."]
  return headlines.map((headline, index) => ({
    id: `d-${index}`,
    name: `Direction ${index}`,
    rationale: "One next step.",
    designedToDrive: brief.goal ?? "A response",
    tags: ["local"],
    recommended: index === 0,
    createdAt: "2026-10-27T00:00:00.000Z",
    spec: {
      headline,
      offer: brief.offer,
      palette: ["#111111", "#222222", "#333333"],
      layoutVariant: "image_grounded",
    },
  }))
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})

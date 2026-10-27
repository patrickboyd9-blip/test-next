import type { CampaignBrief } from "../lib/campaign-creator/types"
import { formatArtDirectorEvidence, formatCopyEvidence, layoutTuneFromHits, photoNoteFromHits, stampLibraryResearch } from "../lib/research-library/evidence"
import { fixtureResearchIndex } from "../lib/research-library/fixtures"
import { clearResearchIndexMemory, loadResearchIndex } from "../lib/research-library"
import { queryFromBrief, retrieveResearch } from "../lib/research-library/retrieve"

/**
 * Shows which research ids three sample businesses retrieve, and what that
 * changes in the prompt, the layout, and the photograph description.
 * Does not call an image API and does not print tokens.
 */

const businesses: { name: string; brief: CampaignBrief; beforeTemplate: string }[] = [
  {
    name: "Summit Roof Co (roofing)",
    beforeTemplate: "roof_split",
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
    beforeTemplate: "service_band",
    brief: {
      goal: "Book an HVAC tune-up",
      offer: "$89 tune-up",
      audience: { description: "Homeowners before summer" },
      businessInfo: { name: "Northwind Comfort" },
    },
  },
  {
    name: "Harbor Auto Cover (auto insurance)",
    beforeTemplate: "medicare_calm",
    brief: {
      goal: "Ask for an auto insurance quote",
      offer: "A written quote",
      audience: { description: "Drivers who own one family car" },
      businessInfo: { name: "Harbor Auto Cover" },
      emotionalTone: "calm",
    },
  },
]

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
    const tune = layoutTuneFromHits(retrieved.hits)
    const stamped = stampLibraryResearch({
      directions: [{
        id: "proof",
        name: "Lead",
        rationale: "The offer is the reason to respond.",
        designedToDrive: business.brief.goal ?? "A response",
        tags: ["local"],
        recommended: true,
        createdAt: "2026-10-27T00:00:00.000Z",
        spec: {
          headline: "A short headline",
          offer: business.brief.offer,
          palette: ["#111111", "#222222", "#333333"],
          layoutVariant: "peer_split",
          layoutHints: { templateId: business.beforeTemplate as "roof_split" },
        },
      }],
    }, retrieved.hits, business.brief)
    const after = stamped.directions[0]
    console.log(`\n${business.name}`)
    console.log(`Retrieved: ${retrieved.hits.map((hit) => `${hit.entry.id} (${hit.band}, ${hit.entry.evidence}${hit.entry.gold ? ", gold" : ""})`).join("; ") || "none"}`)
    console.log(`Fallback: ${retrieved.fallback}`)
    console.log(`Copy evidence includes: ${firstLine(formatCopyEvidence(retrieved.hits))}`)
    console.log(`Layout: template ${business.beforeTemplate} -> ${after?.spec.layoutHints?.templateId ?? business.beforeTemplate}; photo share ${tune?.photoShare ?? "unchanged"}; offer prominent ${tune?.offerProminent ?? false}`)
    console.log(`Photo brief adds: ${photoNoteFromHits(retrieved.hits) ?? "no photograph description on the retrieved records"}`)
    console.log(`Art direction note: ${firstLine(formatArtDirectorEvidence(retrieved.hits))}`)
  }
}

function firstLine(value: string): string {
  const line = value.split("\n").map((item) => item.trim()).filter((item) => item.startsWith("- "))[0]
  return line ?? "(no retrieved line)"
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})

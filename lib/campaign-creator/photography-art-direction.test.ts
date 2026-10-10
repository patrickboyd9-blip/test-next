import assert from "node:assert/strict"
import { test } from "node:test"

import { normalizeGenerationResult } from "./creative-engine-guards"
import { toImageBrief } from "./image-brief"
import { buildOpenAIImagePrompt } from "./openai-image-generation"
import {
  buildPhotographyArtDirection,
  isWeakTextOnlyRecommendation,
  isWeakVisualDirection,
} from "./photography-art-direction"
import type { CampaignBrief, CreativeDirection, CreativeSpec } from "./types"

const roofingBrief: CampaignBrief = {
  goal: "Book roof inspections",
  audience: { description: "Homeowners in Chula Vista" },
  businessInfo: {
    name: "ABC Roofers",
    phone: "(619) 555-0148",
    address: "Chula Vista, CA",
  },
  offer: "Free roof inspection",
  phone: "(619) 555-0148",
  website: "https://abcroofers.example/inspect",
  qrDestination: "https://abcroofers.example/inspect",
  primarySuccessMetric: {
    type: "appointment",
    description: "Inspection bookings",
  },
}

function spec(overrides: Partial<CreativeSpec> = {}): CreativeSpec {
  return {
    layoutVariant: "image_grounded",
    headline: "Don't Wait",
    body: "Water inside means the roof is already talking.",
    callToAction: "Call for an inspection",
    visualDirection: "Close-up of asphalt shingles",
    tone: "Urgent, plain, local",
    palette: ["#1c1917", "#c4552a", "#f4f1ea"],
    imagery: "stock_generic_local",
    leadJob: "problem",
    imageryRole: "consequence",
    phone: "(619) 555-0148",
    website: "https://abcroofers.example/inspect",
    qrDestination: "https://abcroofers.example/inspect",
    ...overrides,
  }
}

test("a weak roofing label becomes three different trade scenes", () => {
  const roles = ["consequence", "crew", "neighborhood"] as const
  const subjects = roles.map((imageryRole, index) => {
    const art = buildPhotographyArtDirection({
      imageryRole,
      leadJob: index === 1 ? "trust" : index === 2 ? "offer" : "problem",
      occupancy: index === 2 ? "field" : "supporting",
      visualDirection: "Close-up of asphalt shingles",
      campaign: roofingBrief,
      variationKey: `dir-${imageryRole}`,
    })
    return art
  })

  assert.deepEqual(
    subjects.map((art) => art.trade),
    ["roofing", "roofing", "roofing"]
  )
  const unique = new Set(subjects.map((art) => art.subject))
  assert.equal(unique.size, 3)
  assert.match(subjects[0]!.subject, /ceiling|drip|window|stain|bucket|towel/i)
  assert.match(subjects[1]!.subject, /ladder|hands|underlayment|roof edge/i)
  assert.match(subjects[2]!.subject, /street|roofline|gable|houses/i)
  for (const art of subjects) {
    assert.doesNotMatch(art.subject, /handshake/i)
    assert.doesNotMatch(art.subject, /ABC Roofers/)
    assert.doesNotMatch(art.subject, /619/)
    assert.match(art.lighting, /.+/)
    assert.match(art.framing, /.+/)
    assert.match(art.emotion, /.+/)
    assert.match(art.refuse, /QR codes/)
    assert.match(art.refuse, /logos/)
  }
  assert.match(subjects[2]!.lighting, /coastal/i)
  assert.doesNotMatch(subjects[2]!.lighting, /Chula Vista/)
  assert.match(subjects[0]!.craft ?? "", /interior leak|not a crew portrait/i)
})

test("a before/after concept is prompted as one cohesive photograph", () => {
  const visualDirection =
    "Before and after of a worn roof on the left half and a new roof on the right half, two photos stitched together."
  const brief = toImageBrief(
    spec({
      visualDirection,
      layoutVariant: "peer_split",
      headline: "See The Transformation",
      imageryRole: "neighborhood",
      leadJob: "trust",
    }),
    { campaign: roofingBrief, variationKey: "dir-transform" }
  )
  assert.ok(brief)
  const prompt = buildOpenAIImagePrompt(brief)
  assert.match(prompt, /One cohesive photograph of a single moment/)
  assert.match(prompt, /do not stitch two photos together/i)
  assert.match(prompt, /No before-and-after diptych/)
  assert.doesNotMatch(prompt, /left half/)
  assert.doesNotMatch(prompt, /right half/)
  assert.doesNotMatch(prompt, /stitched together/)
})

test("a specific conceived scene is kept and still art-directed", () => {
  const visualDirection =
    "A slow drip from a ceiling stain into a bucket in an ordinary living room, illustrative and not this house."
  assert.equal(isWeakVisualDirection(visualDirection), false)
  const brief = toImageBrief(
    spec({ visualDirection, layoutVariant: "image_grounded" }),
    { campaign: roofingBrief, variationKey: "dir-leak" }
  )
  assert.ok(brief)
  assert.equal(brief.visualDirection, visualDirection)
  assert.equal(brief.artDirection.subject, visualDirection)

  const prompt = buildOpenAIImagePrompt(brief)
  assert.match(prompt, /Subject and action:/)
  assert.match(prompt, /Light:/)
  assert.match(prompt, /Camera and lens:/)
  assert.match(prompt, /Negative space:/)
  assert.match(prompt, /ceiling stain/)
  assert.equal(prompt.includes(brief.lookBlock), true)
  assert.doesNotMatch(prompt, /Don't Wait/)
  assert.doesNotMatch(prompt, /619/)
  assert.doesNotMatch(prompt, /abcroofers/i)
})

test("the same role still varies across direction keys", () => {
  const subjects = ["dir-a", "dir-b", "dir-c", "dir-d", "dir-e", "dir-f"].map(
    (variationKey) =>
      buildPhotographyArtDirection({
        imageryRole: "crew",
        leadJob: "trust",
        occupancy: "supporting",
        visualDirection: "Professional technician at work",
        campaign: roofingBrief,
        variationKey,
      }).subject
  )
  assert.ok(new Set(subjects).size >= 2)
})

function direction(
  index: number,
  overrides: Partial<CreativeDirection> = {}
): CreativeDirection {
  const headlines = ["Navy Type Only", "Leak In The Ceiling", "Crew On The Roof"]
  const rationales = [
    "Lets the offer stand alone in type.",
    "Shows water where it should not be.",
    "Shows the work without inventing a named crew.",
  ]
  return {
    id: `dir-${index}`,
    name: headlines[index] ?? "Direction Name",
    rationale: rationales[index] ?? "A distinct strategic frame.",
    designedToDrive: "Inspection bookings",
    tags: ["Local", "Roof", "Offer"],
    recommended: index === 0,
    oneLineDifference: index === 0 ? undefined : `Different frame ${index}`,
    createdAt: "2026-10-07T00:00:00.000Z",
    spec: spec({
      headline: headlines[index],
      layoutVariant: index === 0 ? "type_only" : index === 1 ? "image_grounded" : "peer_split",
      imageryRole: index === 0 ? "none" : index === 1 ? "consequence" : "crew",
      leadJob: index === 1 ? "problem" : "trust",
      visualDirection:
        index === 0
          ? "No photograph. The headline is the interrupt."
          : "A slow drip from a ceiling stain into a bucket in an ordinary living room, illustrative and not this house.",
    }),
    ...overrides,
  }
}

test("a weak text-only recommendation yields to a photographic direction for a local service", () => {
  assert.equal(isWeakTextOnlyRecommendation(direction(0).spec), true)
  const result = normalizeGenerationResult(
    roofingBrief,
    [direction(0), direction(1), direction(2)],
    { stripInventedFacts: false }
  )
  const lead = result.directions.find((item) => item.recommended)
  assert.ok(lead)
  assert.notEqual(lead.spec.layoutVariant, "type_only")
  assert.notEqual(lead.spec.imageryRole, "none")
  const demoted = result.directions.find((item) => item.spec.layoutVariant === "type_only")
  assert.equal(demoted?.recommended, false)
  assert.match(demoted?.oneLineDifference ?? "", /Type leads/)
})

test("a deliberate type-led strategy can stay recommended", () => {
  const reason =
    "The price is the picture here, because the brief's only interrupt is the dollar amount and a roof photo would invent proof we do not have."
  assert.equal(
    isWeakTextOnlyRecommendation(
      spec({
        layoutVariant: "type_only",
        imageryRole: "none",
        visualDirection: reason,
      })
    ),
    false
  )
  const result = normalizeGenerationResult(
    roofingBrief,
    [
      direction(0, {
        spec: spec({
          headline: "Navy Type Only",
          layoutVariant: "type_only",
          imageryRole: "none",
          visualDirection: reason,
        }),
      }),
      direction(1),
      direction(2),
    ],
    { stripInventedFacts: false }
  )
  const lead = result.directions.find((item) => item.recommended)
  assert.equal(lead?.spec.layoutVariant, "type_only")
})

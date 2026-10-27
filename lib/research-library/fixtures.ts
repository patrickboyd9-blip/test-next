import { indexSourceFiles, type SourceFile } from "./parse"
import { coverageStats } from "./coverage"
import type { ResearchIndex } from "./types"

/**
 * Original stand-ins for the private library. They match the shapes we parse.
 * They are not copies of anyone's mailer.
 */

const ROOFING_MD = `# MMR-9001

## OBSERVED
- Industry: roofing
- Format: 6×9 postcard
- Offer type: free inspection
- Emotion: urgency
- Headline: "Your roof after the wind"
- Photo style: daylight exterior of a finished roof, three-quarter view, ordinary house
- Colors: #0B1F33, #F4C430
- Layout: the photograph covers 65% of the card. The offer sits in a bottom band and is the largest type.
- Phone: bottom lockup
- QR: beside the phone
- Image: images/MMR-9001.jpg

## INFERRED
One roof photograph carries the card. The offer does not compete with a second headline.

## INTERPRETATION
Why it works: one photograph and one inspection offer.
Response: the notes cite a 2.1% reply on a similar inspection postcard.
Similar to PM-047: 4
`

const HVAC_MD = `# MMR-9002

## OBSERVED
- Industry: HVAC
- Format: 6×9 postcard
- Offer: tune-up
- Emotion: relief
- Headline: "Cool the house before August"
- Photo style: outdoor condenser beside a lived-in house, daylight, no people
- Colors: #16324F, #F7F4EE
- Layout: photograph covers 58% of the card
- Image: images/MMR-9002.jpg

## INFERRED
The machine is the subject. The offer is one line under it.

## INTERPRETATION
Why it works: the homeowner sees the equipment, then one maintenance offer.
`

const AUTO_MD = `# MMR-9003

## OBSERVED
- Industry: auto insurance
- Format: 6×11 letter postcard
- Offer: quote
- Emotion: calm
- Headline: "A clearer car insurance quote"
- Photo style: a parked family car in a driveway, daylight, no collision

## INFERRED
The piece is type-led. There is no crash photograph.

## INTERPRETATION
Why it works: a calm quote, not a scare headline.
Response: no measured rate in the file.
`

const PLUMBING_MD = `# MMR-9004

## OBSERVED
- Industry: plumbing
- Format: 6×9 postcard
- Offer: leak check
- Emotion: urgency
- Headline: "The leak under the sink"
- Photo style: a chrome faucet over a basin, daylight

## INFERRED
A close photograph of the fixture, then one check.

## INTERPRETATION
Why it works: the problem is visible and the next step is one check.
`

const SYNTHESIS = `# Roofing patterns

## OBSERVED
Roofing mailers in this set use one exterior photograph.

## INFERRED
Storm pieces and inspection pieces should not share the same shout.

## INTERPRETATION
Keep one offer. Do not invent a claim that insurance will pay.
`

export const ROOFING_GOLD = {
  id: "GOLD-roofing-001",
  industry: "roofing",
  slug: "roofing",
  size: "6x9",
  photoShare: 0.7,
  headline: { size: "large", wordCount: 4, text: "See the roof" },
  offer: { position: "bottom band", size: "dominant", text: "Free inspection" },
  colors: ["#0B1F33", "#F4F1EA", "#E24A1B"],
  photoStyle: "daylight exterior roof, lived-in house, no people",
  whitespace: "a quiet third of sky for the headline",
  phone: "bottom lockup",
  qr: "beside the phone",
  similarity: [
    { id: "PM-047", score: 5 },
    { id: "PM-054", score: 4 },
  ],
  whyItWorks: "One hero photograph and one offer band.",
  response: { note: "Owner file: inspection postcards in this shape held attention in the mailbox." },
  images: ["images/gold/roofing/front.jpg"],
}

export const HVAC_GOLD = {
  gold_id: "GOLD-hvac-001",
  vertical: "HVAC",
  format: "postcard",
  photo_share: "55%",
  headline_word_count: 5,
  headline_size: "medium",
  headline_text: "A quieter summer tune-up",
  offer_position: "top right",
  offer_size: "secondary",
  palette: ["navy", "white"],
  photo_style: "technician-free outdoor condenser, daylight",
  white_space: "open left side",
  phone_placement: "footer",
  qr_placement: "footer",
  favorite_similarity: 3,
  favorite_of: "PM-022",
  why: "The condenser is the product.",
  response_data: "No measured rate in the file.",
  image: "images/gold/hvac/front.png",
}

export const AUTO_GOLD = {
  id: "GOLD-auto-insurance-001",
  industry: "auto insurance",
  size: "6x11",
  photoShare: 0.4,
  headlineWords: 6,
  headlineText: "What the car actually costs to cover",
  offer: { position: "beside the headline", size: "secondary", text: "A written quote" },
  whyItWorks: "A calm quote, not a scare headline.",
  photoStyle: "a parked family car on a driveway, daylight, no crash",
}

export function fixtureSourceFiles(): SourceFile[] {
  return [
    { path: "examples/2026-10-27-MMR-9001.md", ref: "mando", text: ROOFING_MD },
    { path: "examples/2026-10-27-MMR-9002.md", ref: "mando", text: HVAC_MD },
    { path: "examples/2026-10-27-MMR-9003.md", ref: "mando", text: AUTO_MD },
    { path: "examples/2026-10-27-MMR-9004.md", ref: "mando", text: PLUMBING_MD },
    { path: "syntheses/roofing-patterns.md", ref: "mando", text: SYNTHESIS },
    { path: "gold/roofing.json", ref: "mando", json: ROOFING_GOLD },
    { path: "gold/hvac.json", ref: "mando", json: HVAC_GOLD },
    { path: "gold/auto-insurance.json", ref: "mando", json: AUTO_GOLD },
    { path: "indexes/gold/manifest.json", ref: "mando", json: { slugs: ["roofing", "hvac", "auto-insurance"] } },
    { path: "images/index.json", ref: "mando", json: [
      { mmr_id: "MMR-9001", path: "images/MMR-9001.jpg", side: "front", vertical: "roofing" },
      { mmr_id: "MMR-9002", path: "images/MMR-9002.jpg", vertical: "hvac" },
      { mmr_id: "MMR-9099", path: "private/MMR-9099.jpg" },
    ] },
    { path: "assets/physical/PM-901/notes.md", ref: "c3po", text: "# PM-901\n\n## OBSERVED\n- Industry: hvac\n- Headline: \"The unit by the side of the house\"\n- Photo style: condenser on a pad, daylight\n\n## INFERRED\nOne machine, one offer.\n\n## INTERPRETATION\nWhy it works: the equipment is recognizable.\n" },
    { path: "assets/physical/PM-902/", ref: "c3po", json: { id: "PM-902", images: ["assets/physical/PM-902/front.jpg"], industry: "roofing" } },
    { path: "private/secret.md", ref: "mando", text: "do not read" },
    { path: "examples/empty-MMR-9008.md", ref: "mando", text: "   " },
    { path: "README.md", ref: "mando", text: "This repository holds research notes." },
  ]
}

export function fixtureResearchIndex(): ResearchIndex {
  const { entries, coverage } = indexSourceFiles(fixtureSourceFiles())
  return {
    version: 1,
    builtAt: "2026-10-27T00:00:00.000Z",
    entries,
    coverage,
    pending: [],
    stats: coverageStats(entries, coverage, 0),
  }
}

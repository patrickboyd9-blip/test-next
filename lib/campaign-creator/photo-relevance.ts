import type { CampaignBrief } from "./types"
import { isFinalExpenseBrief, isMedicareAgentBrief } from "./medicare-compliance"
import { referenceVerticalsForBrief } from "../reference-corpus/select-reference-cards"

/**
 * Whether a photograph belongs on this campaign.
 * Tag match is enough when the asset is labeled. A vision check decides
 * when the pixels can be seen and the labels are not conclusive.
 * A mismatch is withheld. It is not explained on the card.
 */
export interface PhotoExpectation {
  industry: string
  audience: string
  accept: readonly string[]
  refuse: readonly string[]
}

export interface PhotoCandidate {
  src?: string
  tags?: readonly string[]
  describedSubject?: string
}

export type PhotoTagVerdict = "match" | "mismatch" | "unknown"

const SIGNATURES: Record<string, RegExp> = {
  construction: /\b(construction|hard hats?|scaffolding|excavators?|job sites?)\b/i,
  roofing: /\b(shingles?|roofers?|flashing|roof edge|ceiling stains?)\b/i,
  hvac: /\b(condensers?|furnaces?|thermostats?|hvac)\b/i,
  plumbing: /\b(water heaters?|pipe wrenches?|plumbing)\b/i,
  electrical: /\b(electrical panels?|circuit breakers?)\b/i,
  restaurant: /\b(pizzas?|plating|dining rooms?)\b/i,
  dental: /\b(dental chairs?|dentists?)\b/i,
  medicare: /\b(older couples?|headshots?|plan reviews?|advisors?|gardening)\b/i,
  final_expense: /\b(famil(?:y|ies)|generations?)\b/i,
  auto_insurance: /\b(parked cars?|bumpers?|auto insurance)\b/i,
  life_insurance: /\b(famil(?:y|ies)|generations?)\b/i,
}

export function photoExpectationForBrief(brief: CampaignBrief | undefined): PhotoExpectation {
  if (isFinalExpenseBrief(brief)) {
    return {
      industry: "final_expense",
      audience: "family",
      accept: ["family", "generation", "home"],
      refuse: ["casket", "coffin", "funeral", "cemetery", "grief", "construction", "capitol"],
    }
  }
  if (isMedicareAgentBrief(brief)) {
    return {
      industry: "medicare",
      audience: "capable older adults",
      accept: ["older couple", "headshot", "advisor", "portrait", "garden", "walking"],
      refuse: [
        "construction",
        "hard hat",
        "job site",
        "capitol",
        "eagle",
        "seal",
        "flag",
        "medicare card",
        "hospital",
        "frail",
        "sepia",
        "casket",
        "funeral",
      ],
    }
  }

  const industry = referenceVerticalsForBrief(brief ?? {}).find((vertical) => vertical) ?? "local-service"
  return {
    industry,
    audience: "local",
    accept: acceptFor(industry),
    refuse: industry === "restaurant" ? ["construction", "hard hat"] : ["casket", "capitol"],
  }
}

/**
 * Labels and the conceived subject. Does not look at pixels.
 * Unknown means nothing confirmed the subject and nothing contradicted it.
 */
export function matchPhotoTags(
  candidate: PhotoCandidate,
  expectation: PhotoExpectation
): PhotoTagVerdict {
  const blob = [candidate.describedSubject ?? "", ...(candidate.tags ?? [])].join(" ")
  if (!blob.trim()) return "unknown"

  if (expectation.refuse.some((term) => includesTerm(blob, term))) return "mismatch"

  const expectedSignature = SIGNATURES[expectation.industry]
  if (expectedSignature?.test(blob)) return "match"
  if (candidate.tags?.some((tag) => tag.toLowerCase() === expectation.industry)) return "match"
  if (expectation.accept.some((term) => includesTerm(blob, term))) return "match"

  for (const [industry, pattern] of Object.entries(SIGNATURES)) {
    if (industry === expectation.industry) continue
    if (compatibleIndustries(expectation.industry).includes(industry)) continue
    if (pattern.test(blob)) return "mismatch"
  }
  return "unknown"
}

/** Trades that share a job-site photograph. A Medicare piece is not one of them. */
function compatibleIndustries(industry: string): readonly string[] {
  const trades = [
    "hvac",
    "plumbing",
    "electrical",
    "roofing",
    "pest",
    "landscaping",
    "exterior_cleaning",
    "foundation",
    "chimney",
    "remodeling",
  ]
  if (trades.includes(industry)) return ["construction"]
  if (industry === "final_expense") return ["life_insurance"]
  if (industry === "life_insurance") return ["final_expense"]
  if (industry === "pizza_qsr") return ["restaurant"]
  if (industry === "restaurant") return ["pizza_qsr"]
  return []
}

export type VisionPhotoCheck = (input: {
  src: string
  expectation: PhotoExpectation
}) => Promise<boolean | null>

/**
 * True when the photograph may be shown.
 * An explicit tag mismatch loses. Vision, when it can see the file, decides
 * next. Otherwise a positive tag match is enough, and an unlabeled
 * non-contradictory subject is allowed so a trade photograph is not dropped
 * just because no model is configured.
 */
export async function photoMatchesCampaign(
  candidate: PhotoCandidate,
  expectation: PhotoExpectation,
  vision?: VisionPhotoCheck
): Promise<boolean> {
  const tagged = matchPhotoTags(candidate, expectation)
  if (tagged === "mismatch") return false
  if (candidate.src && vision) {
    try {
      const seen = await vision({ src: candidate.src, expectation })
      if (seen === false) return false
      if (seen === true) return true
    } catch {
      // A vision outage falls through to the tags. It does not show an error.
    }
  }
  return tagged === "match" || tagged === "unknown"
}

export async function openAIVisionPhotoCheck(input: {
  src: string
  expectation: PhotoExpectation
  apiKey?: string
  fetchImpl?: typeof fetch
  model?: string
}): Promise<boolean | null> {
  const apiKey = input.apiKey?.trim()
  if (!apiKey || !input.src.trim()) return null
  const fetchImpl = input.fetchImpl ?? fetch
  const response = await fetchImpl("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: input.model ?? "gpt-4o-mini",
      temperature: 0,
      max_tokens: 8,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: [
                "Does this photograph match the campaign?",
                `Industry: ${input.expectation.industry}.`,
                `Audience: ${input.expectation.audience}.`,
                `It must not show: ${input.expectation.refuse.join(", ")}.`,
                "Answer with one word, MATCH or MISMATCH.",
              ].join(" "),
            },
            { type: "image_url", image_url: { url: input.src } },
          ],
        },
      ],
    }),
  })
  if (!response.ok) return null
  const payload = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>
  }
  const word = payload.choices?.[0]?.message?.content?.trim().toUpperCase() ?? ""
  if (word.startsWith("MATCH")) return true
  if (word.startsWith("MISMATCH")) return false
  return null
}

function acceptFor(industry: string): readonly string[] {
  switch (industry) {
    case "roofing":
      return ["roof", "shingle", "ceiling", "drip"]
    case "hvac":
      return ["hvac", "condenser", "furnace", "thermostat"]
    case "plumbing":
      return ["plumbing", "sink", "water heater"]
    case "electrical":
      return ["electrical", "panel", "outlet"]
    case "restaurant":
    case "pizza_qsr":
      return ["food", "table", "kitchen", "pizza"]
    case "dental":
      return ["dental", "clinic"]
    case "auto_insurance":
      return ["car", "home", "driveway"]
    case "life_insurance":
      return ["family"]
    default:
      return []
  }
}

function includesTerm(blob: string, term: string): boolean {
  const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "\\s+")
  return new RegExp(`\\b${escaped}\\b`, "i").test(blob)
}

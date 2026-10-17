import type { CampaignBrief } from "@/lib/campaign-creator/types"

import { readSeedText } from "./library"
import type { TrimSize } from "./rationale"
import type { ReferenceSelection } from "./select"

/**
 * Vision-model calls for the art director and the critic.
 * Tests never import a live call. A missing key or a bad response returns null
 * and the rules path continues.
 */

export interface ModelUsage {
  model: string
  inputTokens: number
  outputTokens: number
}

export interface ModelRationaleResult {
  rationale: unknown
  usage: ModelUsage | null
}

const MODEL = "claude-sonnet-5"

export async function requestModelRationale(input: {
  brief: CampaignBrief
  selection: ReferenceSelection
  trim: TrimSize
  env: NodeJS.ProcessEnv
}): Promise<ModelRationaleResult> {
  const apiKey = input.env.ANTHROPIC_API_KEY?.trim()
  if (!apiKey) return { rationale: null, usage: null }
  try {
    const Anthropic = (await import("@anthropic-ai/sdk")).default
    const client = new Anthropic({ apiKey })
    const images = await imageBlocks(input.selection, input.env)
    const response = await client.messages.create({
      model: input.env.DESIGN_MODEL?.trim() || MODEL,
      max_tokens: 1800,
      system: directorSystem(),
      messages: [
        {
          role: "user",
          content: [
            ...images,
            {
              type: "text",
              text: directorUser(input.brief, input.selection, input.trim),
            },
          ],
        },
      ],
    })
    const text = response.content
      .filter((block) => block.type === "text")
      .map((block) => block.text)
      .join("\n")
    return {
      rationale: parseJson(text),
      usage: {
        model: response.model,
        inputTokens: response.usage?.input_tokens ?? 0,
        outputTokens: response.usage?.output_tokens ?? 0,
      },
    }
  } catch (error) {
    console.info(
      `[design-intelligence] ${JSON.stringify({ step: "art-director", error: error instanceof Error ? error.message : "model failed" })}`
    )
    return { rationale: null, usage: null }
  }
}

export async function requestVisionCritique(input: {
  png: Buffer
  env: NodeJS.ProcessEnv
  vertical: string
}): Promise<{ score: number; edit: string; usage: ModelUsage } | null> {
  const apiKey = input.env.ANTHROPIC_API_KEY?.trim()
  if (!apiKey || input.env.DESIGN_CRITIC === "machine") return null
  try {
    const Anthropic = (await import("@anthropic-ai/sdk")).default
    const client = new Anthropic({ apiKey })
    const response = await client.messages.create({
      model: input.env.DESIGN_MODEL?.trim() || MODEL,
      max_tokens: 400,
      system:
        "You score a postcard render against an A+ direct-mail rubric. Return JSON only: {\"score\": number 0-100, \"edit\": \"one structural edit\"}. Do not suggest copying any reference brand, photo, or wording. Medicare must stay calm: no seal, no eagle, no fake deadline.",
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: { type: "base64", media_type: "image/png", data: input.png.toString("base64") },
            },
            {
              type: "text",
              text: `Vertical: ${input.vertical}. Score focal dominance, type scale, one response lockup, calm field, and whether this could be mistaken for a government notice. Anchors are a finished-house card with one numeral (A), a product card with one discount (A-), and a photo with one percent on a white field (A-). Anti-examples wear an official-notice costume.`,
            },
          ],
        },
      ],
    })
    const parsed = parseJson(
      response.content.filter((block) => block.type === "text").map((block) => block.text).join("\n")
    ) as { score?: unknown; edit?: unknown } | null
    const score = typeof parsed?.score === "number" ? Math.max(0, Math.min(100, parsed.score)) : null
    if (score === null) return null
    return {
      score,
      edit: typeof parsed?.edit === "string" ? parsed.edit : "One structural edit.",
      usage: {
        model: response.model,
        inputTokens: response.usage?.input_tokens ?? 0,
        outputTokens: response.usage?.output_tokens ?? 0,
      },
    }
  } catch (error) {
    console.info(
      `[design-intelligence] ${JSON.stringify({ step: "critic", error: error instanceof Error ? error.message : "critic failed" })}`
    )
    return null
  }
}

function directorSystem(): string {
  let rules = ""
  try {
    rules = readSeedText("SUMMARY.md")
  } catch {
    rules = "One focal element. Offer larger than the headline when the offer is the hero. Three type sizes. One response. No government costume."
  }
  return [
    "You are the art director for a local-service postcard. Return one Design Rationale as JSON.",
    "Use transferable principles only. Never reproduce a reference layout, artwork, logo, phone number, or wording.",
    "Medicare and insurance stay compliance-calm: no eagle, no official notice, no fake deadline.",
    "The front has a phone, a website, and a QR labeled Scan to book.",
    rules.slice(0, 4000),
  ].join("\n\n")
}

function directorUser(brief: CampaignBrief, selection: ReferenceSelection, trim: TrimSize): string {
  const lines = [
    `Trim: ${trim} landscape.`,
    `Vertical: ${selection.vertical}.`,
    `Business: ${brief.businessInfo?.name ?? "the business"}.`,
    `Offer: ${brief.offer ?? "none stated"}.`,
    `Goal: ${brief.goal ?? ""}.`,
    `Audience: ${brief.audience?.description ?? ""}.`,
    "Quality anchors:",
    ...selection.anchors.map((item) => `- ${item.id} (${item.grade ?? "anchor"}): ${item.principle} Do not copy: ${item.doNotCopy}`),
    "Peers:",
    ...selection.peers.map((item) => `- ${item.id} (${item.grade ?? "peer"}): ${item.principle}`),
    "Do not:",
    ...selection.donts.slice(0, 4).map((item) => `- ${item.id}: ${item.doNotCopy}`),
    "Return JSON matching the Design Rationale schema version 1.0.0.",
  ]
  return lines.join("\n")
}

async function imageBlocks(selection: ReferenceSelection, env: NodeJS.ProcessEnv) {
  const blocks: Array<{ type: "image"; source: { type: "base64"; media_type: "image/jpeg" | "image/png" | "image/webp"; data: string } }> = []
  if (env.DESIGN_DIRECTOR_IMAGES === "off") return blocks
  const { loadLibraryImage } = await import("./images")
  for (const id of selection.imageIds.slice(0, 4)) {
    const image = await loadLibraryImage(id, env)
    if (!image) continue
    blocks.push({
      type: "image",
      source: { type: "base64", media_type: image.mediaType, data: image.bytes.toString("base64") },
    })
  }
  if (blocks.length > 0) return blocks
  return blocks
}

export async function analyzeNewMailer(input: {
  id: string
  bytes: Buffer
  mediaType: "image/jpeg" | "image/png" | "image/webp"
  env: NodeJS.ProcessEnv
}): Promise<import("./library").MailerAnalysis | null> {
  const apiKey = input.env.ANTHROPIC_API_KEY?.trim()
  if (!apiKey) return null
  try {
    const Anthropic = (await import("@anthropic-ai/sdk")).default
    const client = new Anthropic({ apiKey })
    const response = await client.messages.create({
      model: input.env.DESIGN_MODEL?.trim() || MODEL,
      max_tokens: 700,
      system:
        "You grade a reference mailer for Modern Mail. Return JSON only with keys id, vertical, grade, summary, emulate (array of one principle), do_not_copy (array), use_class. use_class is anti_example when the piece dresses up as a government notice or uses a fake deadline. Never transcribe phone numbers, urls, prices, or slogans.",
      messages: [
        {
          role: "user",
          content: [
            { type: "image", source: { type: "base64", media_type: input.mediaType, data: input.bytes.toString("base64") } },
            { type: "text", text: `Id: ${input.id}. Vertical must be one of roofing, plumbing, hvac, medicare_insurance, real_estate, general_local_service.` },
          ],
        },
      ],
    })
    const parsed = parseJson(response.content.filter((block) => block.type === "text").map((block) => block.text).join("\n"))
    if (!parsed || typeof parsed !== "object") return null
    const row = parsed as Record<string, unknown>
    const summary = scrub(typeof row.summary === "string" ? row.summary : "")
    if (!summary) return null
    return {
      id: input.id,
      vertical: typeof row.vertical === "string" ? row.vertical : "general_local_service",
      grade: typeof row.grade === "string" ? row.grade : undefined,
      summary,
      emulate: Array.isArray(row.emulate) ? row.emulate.filter((item): item is string => typeof item === "string").map(scrub) : [],
      do_not_copy: ["Do not copy the mark, the amounts, the phone, the photos, or the wording."],
      use_class: row.use_class === "anti_example" ? "anti_example" : "research_reference",
    }
  } catch (error) {
    console.info(`[design-intelligence] ${JSON.stringify({ step: "analyze", error: error instanceof Error ? error.message : "analyze failed" })}`)
    return null
  }
}

function scrub(value: string): string {
  return value
    .replace(/\b\d{3}[-.\s]?\d{3}[-.\s]?\d{4}\b/g, "")
    .replace(/https?:\/\/\S+/gi, "")
    .replace(/\s+/g, " ")
    .trim()
}

function parseJson(text: string): unknown {
  const start = text.indexOf("{")
  const end = text.lastIndexOf("}")
  if (start < 0 || end <= start) return null
  try {
    return JSON.parse(text.slice(start, end + 1)) as unknown
  } catch {
    return null
  }
}

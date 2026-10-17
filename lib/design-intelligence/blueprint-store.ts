import { createHash } from "node:crypto"

import { createAppDocumentStore, type DocumentStore } from "@/lib/storage/document-store"

import {
  BLUEPRINT_VERSION,
  parseVisionBlueprint,
  structuralBlueprint,
  structuralBlueprints,
  type MailerBlueprint,
} from "./blueprint"
import { BLUEPRINT_TAG_CONFIG } from "./blueprint-tags"
import { averageHashImage } from "./blueprint-guard"
import { estimateUsd, logTokenCost } from "./cost"
import { isForbiddenResearchPath } from "./images"
import { loadLibrary, type LibraryRecord } from "./library"

/**
 * Blueprints live in Neon when DATABASE_URL or POSTGRES_URL is set,
 * and in .data/blueprints otherwise. That folder is not committed.
 * A vision reading replaces the structural estimate for the same source id.
 */

const MODEL = "claude-sonnet-5"

export function blueprintStore(): DocumentStore {
  return createAppDocumentStore("blueprints")
}

export async function loadStoredBlueprints(store: DocumentStore = blueprintStore()): Promise<MailerBlueprint[]> {
  const index = await store.get("index")
  const ids = indexIds(index)
  const blueprints: MailerBlueprint[] = []
  for (const id of ids) {
    if (id === "index") continue
    const parsed = parseStoredBlueprint(await store.get(id))
    if (parsed) blueprints.push(parsed)
  }
  return blueprints
}

export async function loadBlueprintCorpus(input?: {
  records?: readonly LibraryRecord[]
  store?: DocumentStore
  env?: NodeJS.ProcessEnv
}): Promise<MailerBlueprint[]> {
  const records = input?.records ?? await loadLibrary()
  const merged = new Map<string, MailerBlueprint>()
  for (const blueprint of structuralBlueprints(records)) merged.set(blueprint.id, blueprint)
  try {
    const store = input?.store ?? blueprintStore()
    for (const blueprint of await loadStoredBlueprints(store)) {
      if (!merged.has(blueprint.id) && input?.records) continue
      merged.set(blueprint.id, blueprint)
    }
  } catch {
    return [...merged.values()]
  }
  return [...merged.values()]
}

export interface BlueprintBackfillReport {
  status: "ok"
  structural: string[]
  vision: string[]
  pendingVision: number
  errors: string[]
}

export async function backfillBlueprints(input?: {
  env?: NodeJS.ProcessEnv
  store?: DocumentStore
  records?: LibraryRecord[]
  limit?: number
  now?: string
  readImage?: (record: LibraryRecord) => Promise<{ bytes: Buffer; mediaType: "image/jpeg" | "image/png" | "image/webp" } | null>
  analyze?: (record: LibraryRecord, bytes: Buffer, mediaType: "image/jpeg" | "image/png" | "image/webp") => Promise<MailerBlueprint | null>
}): Promise<BlueprintBackfillReport> {
  const env = input?.env ?? process.env
  const store = input?.store ?? blueprintStore()
  const records = (input?.records ?? await loadLibrary()).filter((record) => structuralBlueprint(record))
  const existing = await loadStoredBlueprints(store).catch(() => [] as MailerBlueprint[])
  const byId = new Map(existing.map((blueprint) => [blueprint.id, blueprint]))
  const report: BlueprintBackfillReport = { status: "ok", structural: [], vision: [], pendingVision: 0, errors: [] }
  const now = input?.now ?? new Date().toISOString()
  for (const record of records) {
    if (byId.has(record.id)) continue
    const blueprint = structuralBlueprint(record, now)
    if (!blueprint) continue
    await store.put(record.id, blueprint)
    byId.set(record.id, blueprint)
    report.structural.push(record.id)
  }
  const limit = batchLimit(input?.limit ?? env.BLUEPRINT_BATCH, env)
  const analyze = input?.analyze ?? ((record, bytes, mediaType) => analyzeBlueprintImage({ id: record.id, bytes, mediaType, env, structural: byId.get(record.id) }))
  let done = 0
  for (const record of records) {
    const image = record.images.find((item) => !isForbiddenResearchPath(item.path))
    if (!image) continue
    const prior = byId.get(record.id)
    if (prior?.origin === "vision" && prior.guard.imageHash) continue
    if (!input?.analyze && !env.ANTHROPIC_API_KEY?.trim()) continue
    if (done >= limit) continue
    try {
      const loaded = input?.readImage ? await input.readImage(record) : await readImage(record, env)
      if (!loaded) continue
      const vision = await analyze(record, loaded.bytes, loaded.mediaType)
      if (!vision) {
        report.errors.push(`${record.id} returned no blueprint`)
        continue
      }
      const hash = averageHashImage(loaded.bytes)
      const stored: MailerBlueprint = {
        ...vision,
        id: record.id,
        sourceId: record.id,
        origin: "vision",
        guard: { ...vision.guard, imageHash: hash ?? vision.guard.imageHash },
        extractedAt: now,
      }
      await store.put(record.id, stored)
      byId.set(record.id, stored)
      done += 1
      report.vision.push(record.id)
    } catch (error) {
      report.errors.push(error instanceof Error ? error.message : `${record.id} failed`)
    }
  }
  await store.put("index", { ids: [...byId.keys()].sort() })
  report.pendingVision = records.filter((record) => record.images.some((image) => !isForbiddenResearchPath(image.path)) && byId.get(record.id)?.origin !== "vision").length
  return report
}

export async function analyzeBlueprintImage(input: {
  id: string
  bytes: Buffer
  mediaType: "image/jpeg" | "image/png" | "image/webp"
  env: NodeJS.ProcessEnv
  structural?: MailerBlueprint
}): Promise<MailerBlueprint | null> {
  const apiKey = input.env.ANTHROPIC_API_KEY?.trim()
  if (!apiKey) return null
  try {
    const Anthropic = (await import("@anthropic-ai/sdk")).default
    const client = new Anthropic({ apiKey })
    const response = await client.messages.create({
      model: input.env.DESIGN_MODEL?.trim() || MODEL,
      max_tokens: 1800,
      system: blueprintSystem(),
      messages: [
        {
          role: "user",
          content: [
            { type: "image", source: { type: "base64", media_type: input.mediaType, data: input.bytes.toString("base64") } },
            { type: "text", text: `Source id ${input.id}. Extract the structure only. Return JSON.` },
          ],
        },
      ],
    })
    const text = response.content.filter((block) => block.type === "text").map((block) => block.text).join("\n")
    const blueprint = parseVisionBlueprint(parseJson(text), input.id)
    if (!blueprint) return null
    blueprint.model = response.model
    blueprint.extractedAt = new Date().toISOString()
    const cost = {
      cardId: input.id,
      step: "blueprint" as const,
      model: response.model,
      inputTokens: response.usage?.input_tokens ?? 0,
      outputTokens: response.usage?.output_tokens ?? 0,
      estimatedUsd: estimateUsd(response.usage?.input_tokens ?? 0, response.usage?.output_tokens ?? 0, input.env),
    }
    logTokenCost(cost)
    return blueprint
  } catch (error) {
    console.info(`[design-intelligence] ${JSON.stringify({ step: "blueprint", id: input.id, error: error instanceof Error ? error.message : "extract failed" })}`)
    return input.structural ?? null
  }
}

export function parseStoredBlueprint(raw: unknown): MailerBlueprint | null {
  if (!raw || typeof raw !== "object") return null
  const row = raw as Partial<MailerBlueprint>
  if (!row.id || row.version !== BLUEPRINT_VERSION || !row.boxes || !row.guard) return null
  if (row.origin !== "vision" && row.origin !== "structural") return null
  return row as MailerBlueprint
}

function blueprintSystem(): string {
  const tones = BLUEPRINT_TAG_CONFIG.tones.map((rule) => rule.id).join(", ")
  const verticals = BLUEPRINT_TAG_CONFIG.verticals.map((rule) => rule.id).join(", ")
  const offers = BLUEPRINT_TAG_CONFIG.offerTypes.map((rule) => rule.id).join(", ")
  const patterns = BLUEPRINT_TAG_CONFIG.copyPatterns.map((rule) => `${rule.id} = ${rule.template}`).join(" | ")
  return [
    "You extract a reusable layout blueprint from one reference mailer.",
    "Return JSON only. Describe structure. Do not transcribe the brand name, slogan, phone, URL, or price into front, back, or any field except guard.",
    "Boxes are fractions of the card from 0 to 1. Roles: photo, headline, subhead, offer, badge, benefits, proof, response, logo. face is front or back.",
    "paletteRoles uses dominant (dark, light, or saturated), accent (saturated or muted), and neutral (light or dark). Do not put brand hex in paletteRoles.",
    "typeClass is condensed-display, humanist-sans, or serif.",
    "devices is any of pill-code, burst-badge, icon-grid, color-blocked-offer, thumbnail-strip, cut-out-subject, full-bleed.",
    "tones, verticals, offerTypes, and copyPatterns are lists of {tag, confidence}. confidence is 0 to 1. A mailer may have several of each.",
    `Tone tags: ${tones}.`,
    `Vertical tags: ${verticals}.`,
    `Offer type tags: ${offers}.`,
    `Copy pattern tags, with the abstract template the product will fill: ${patterns}.`,
    "copyPattern is the single best copyPatterns id. Do not write a copyTemplate. Do not put the mailer's words into any template.",
    "If none of the tags in a list fit, leave that list empty and add proposedTags: {kind, tag, reason}. kind is tone, vertical, offer_type, or copy_pattern.",
    "A proposed tag is new snake_case. It is not a word from the mailer, and it is not added to the vocabulary for you.",
    "reason is one short sentence and does not quote the mailer. For a proposed copy_pattern you may add template, using only slots such as [Deadline], [benefit], [Offer], [Problem], [Proof], and [Next step], plus a few connecting words.",
    "grade is a letter such as A, A-, B+, B, B-, C.",
    "guard.sourcePhrases is the visible headline and slogan, for an overlap check only.",
    "guard.paletteHex is up to four hex colors from the piece, for a trade-dress check only.",
    "Keys: boxes, scale {offerToHeadline, headlineToBody, photoShare}, paletteRoles, typeClass, devices, copyPattern, offerTypes, copyPatterns, proposedTags, front, back, tones, verticals, grade, guard.",
  ].join(" ")
}

async function readImage(record: LibraryRecord, env: NodeJS.ProcessEnv) {
  const { readRecordImage } = await import("./images")
  return readRecordImage(record, env)
}

function batchLimit(value: unknown, env: NodeJS.ProcessEnv): number {
  const parsed = Number(value ?? env.BLUEPRINT_BATCH ?? 4)
  if (!Number.isFinite(parsed)) return 4
  return Math.max(1, Math.min(8, Math.round(parsed)))
}

function indexIds(raw: unknown): string[] {
  if (!raw || typeof raw !== "object") return []
  const ids = (raw as { ids?: unknown }).ids
  if (!Array.isArray(ids)) return []
  return ids.filter((id): id is string => typeof id === "string")
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

export function hashBytes(bytes: Buffer): string {
  return createHash("sha256").update(bytes).digest("hex")
}

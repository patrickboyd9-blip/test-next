import { createHash } from "node:crypto"

import type { DocumentStore } from "@/lib/storage/document-store"
import { createAppDocumentStore, createFileDocumentStore } from "@/lib/storage/document-store"

import { LETTERS, type LetterGrade } from "./composition-grade"
import { isForbiddenResearchPath } from "./images"
import {
  gradeRank,
  isAntiExample,
  loadSeedAnalyses,
  type LibraryRecord,
  type MailerAnalysis,
} from "./library"
import { estimateUsd, logTokenCost } from "./cost"

/**
 * Vision taste is a structured reading of a reference photograph.
 * It is stored beside the written seed grades. The seed is not replaced.
 * Nothing under private/ is read or stored.
 */

export const VISION_TASTE_VERSION = "1.0.0"
const MODEL = "claude-sonnet-5"

export const TASTE_INDUSTRIES = [
  "roofing",
  "plumbing",
  "hvac",
  "real_estate",
  "medicare",
  "solar",
  "dental",
  "pest_control",
  "landscaping",
  "restaurant",
  "junk_removal",
  "general",
] as const

export const TASTE_OFFER_TYPES = [
  "free_inspection",
  "storm",
  "tune_up",
  "price_point",
  "dollar_off",
  "percent",
  "we_buy",
  "appointment",
  "other",
] as const

export const TASTE_FEELS = ["integrated", "panel", "calm", "urgent", "editorial", "appetite"] as const

export interface VisionTaste {
  version: typeof VISION_TASTE_VERSION
  id: string
  origin: "vision" | "seed"
  imageSha256: string
  imagePath: string
  analyzedAt: string
  model: string
  scoreKind: "vision" | "machine estimate" | "seed"
  eyePath: string
  focalElement: string
  scaleRatios: { offerVersusHeadline: string; headlineVersusBody: string }
  whitespace: string
  paletteRoles: { background: string; type: string; offer: string; accent: string }
  typeIntegration: string
  responseBlock: string
  whatWorks: string
  grade: LetterGrade
  industry: string
  offerType: string
  feel: string
  compositionFamily: string
  doNotCopy: string
}

export function visionTasteStore(options?: { dataDir?: string; store?: DocumentStore }): DocumentStore {
  if (options?.store) return options.store
  if (options?.dataDir) return createFileDocumentStore(options.dataDir)
  return createAppDocumentStore("vision_taste")
}

export function hashImage(bytes: Buffer): string {
  return createHash("sha256").update(bytes).digest("hex")
}

export function tasteFromSeed(analysis: MailerAnalysis): VisionTaste | null {
  if (isAntiExample({ id: analysis.id, analysis })) return null
  const grade = asLetter(analysis.grade)
  if (!grade) return null
  const blob = [
    analysis.focal_point,
    analysis.eye_path,
    analysis.grid,
    analysis.scale_ratios,
    analysis.summary,
    analysis.offer_placement,
    analysis.photo_art_direction,
    analysis.trust_and_cta,
  ].filter(Boolean).join(" ")
  return {
    version: VISION_TASTE_VERSION,
    id: analysis.id,
    origin: "seed",
    imageSha256: "",
    imagePath: "",
    analyzedAt: "",
    model: "seed",
    scoreKind: "seed",
    eyePath: clip(analysis.eye_path || "Not written."),
    focalElement: clip(analysis.focal_point || analysis.summary || "One subject."),
    scaleRatios: {
      offerVersusHeadline: clip(analysis.scale_ratios || "Not written."),
      headlineVersusBody: clip(analysis.scale_ratios || "Not written."),
    },
    whitespace: clip(analysis.grid || "Not written."),
    paletteRoles: {
      background: "Not written from a photograph.",
      type: "Not written from a photograph.",
      offer: clip(analysis.offer_placement || "Not written."),
      accent: (analysis.palette_hex ?? []).slice(0, 4).join(", ") || "Not written.",
    },
    typeIntegration: clip(analysis.photo_art_direction || "Not written."),
    responseBlock: clip(analysis.trust_and_cta || "Not written."),
    whatWorks: clip(analysis.emulate?.[0] || analysis.summary || "One subject, one offer, one response."),
    grade,
    industry: normalizeIndustry(analysis.vertical),
    offerType: inferOfferType(blob),
    feel: inferFeel(blob),
    compositionFamily: clip(analysis.grid || "unspecified"),
    doNotCopy: clip(analysis.do_not_copy?.[0] || "Do not copy the mark, the amounts, the phone, the photos, or the wording."),
  }
}

export function seedTasteCorpus(): VisionTaste[] {
  return loadSeedAnalyses().map(tasteFromSeed).filter((taste): taste is VisionTaste => Boolean(taste))
}

export async function loadVisionTaste(store: DocumentStore): Promise<VisionTaste[]> {
  const index = await store.get("index")
  const ids = indexIds(index)
  const tastes: VisionTaste[] = []
  for (const id of ids) {
    if (id === "index") continue
    const raw = await store.get(id)
    const taste = parseStoredTaste(raw)
    if (taste) tastes.push(taste)
  }
  return tastes
}

export async function loadTasteCorpus(store?: DocumentStore): Promise<VisionTaste[]> {
  const merged = new Map<string, VisionTaste>()
  for (const taste of seedTasteCorpus()) merged.set(taste.id, taste)
  if (!store) return [...merged.values()]
  try {
    for (const taste of await loadVisionTaste(store)) merged.set(taste.id, taste)
  } catch {
    return [...merged.values()]
  }
  return [...merged.values()]
}

export function parseVisionTastePayload(raw: unknown, id: string): VisionTaste | null {
  if (!raw || typeof raw !== "object") return null
  const row = raw as Record<string, unknown>
  const grade = asLetter(typeof row.grade === "string" ? row.grade : undefined)
  const whatWorks = scrub(stringField(row, "whatWorks"))
  const focal = scrub(stringField(row, "focalElement"))
  const eye = scrub(stringField(row, "eyePath"))
  if (!grade || !whatWorks || !focal || !eye) return null
  const scale = record(row.scaleRatios)
  const palette = record(row.paletteRoles)
  return {
    version: VISION_TASTE_VERSION,
    id,
    origin: "vision",
    imageSha256: "",
    imagePath: "",
    analyzedAt: "",
    model: "",
    scoreKind: "vision",
    eyePath: clip(eye),
    focalElement: clip(focal),
    scaleRatios: {
      offerVersusHeadline: clip(scrub(stringField(scale ?? {}, "offerVersusHeadline")) || "Not stated."),
      headlineVersusBody: clip(scrub(stringField(scale ?? {}, "headlineVersusBody")) || "Not stated."),
    },
    whitespace: clip(scrub(stringField(row, "whitespace")) || "Not stated."),
    paletteRoles: {
      background: clip(scrub(stringField(palette ?? {}, "background")) || "Not stated."),
      type: clip(scrub(stringField(palette ?? {}, "type")) || "Not stated."),
      offer: clip(scrub(stringField(palette ?? {}, "offer")) || "Not stated."),
      accent: clip(scrub(stringField(palette ?? {}, "accent")) || "Not stated."),
    },
    typeIntegration: clip(scrub(stringField(row, "typeIntegration")) || "Not stated."),
    responseBlock: clip(scrub(stringField(row, "responseBlock")) || "Not stated."),
    whatWorks: clip(whatWorks),
    grade,
    industry: normalizeIndustry(stringField(row, "industry")),
    offerType: normalizeOffer(stringField(row, "offerType")),
    feel: normalizeFeel(stringField(row, "feel")),
    compositionFamily: clip(scrub(stringField(row, "compositionFamily")) || "unspecified"),
    doNotCopy: "Do not copy the mark, the amounts, the phone, the photos, or the wording.",
  }
}

export function parseStoredTaste(raw: unknown): VisionTaste | null {
  if (!raw || typeof raw !== "object") return null
  const row = raw as Partial<VisionTaste>
  if (!row.id || row.version !== VISION_TASTE_VERSION) return null
  if (row.origin !== "vision" && row.origin !== "seed") return null
  const grade = asLetter(row.grade)
  if (!grade || !row.whatWorks || !row.focalElement || !row.eyePath) return null
  return { ...(row as VisionTaste), grade, doNotCopy: row.doNotCopy || "Do not copy the mark, the amounts, the phone, the photos, or the wording." }
}

export interface TasteBackfillReport {
  status: "ok" | "skipped"
  reason?: string
  analyzed: string[]
  skipped: string[]
  pending: number
  errors: string[]
}

export async function backfillVisionTaste(input: {
  env?: NodeJS.ProcessEnv
  store?: DocumentStore
  records?: LibraryRecord[]
  limit?: number
  now?: string
  analyze?: (record: LibraryRecord, bytes: Buffer, mediaType: "image/jpeg" | "image/png" | "image/webp") => Promise<VisionTaste | null>
  readImage?: (record: LibraryRecord) => Promise<{ bytes: Buffer; mediaType: "image/jpeg" | "image/png" | "image/webp" } | null>
}): Promise<TasteBackfillReport> {
  const env = input.env ?? process.env
  const store = input.store ?? visionTasteStore()
  const records = (input.records ?? await loadRecords()).filter((record) => record.images.length > 0)
  const limit = batchLimit(input.limit ?? env.VISION_TASTE_BATCH, env)
  const existing = await loadVisionTaste(store).catch(() => [] as VisionTaste[])
  const byId = new Map(existing.map((taste) => [taste.id, taste]))
  const pending = records.filter((record) => needsTaste(record, byId.get(record.id)))
  if (!input.analyze && !env.ANTHROPIC_API_KEY?.trim()) {
    return {
      status: "skipped",
      reason: "ANTHROPIC_API_KEY is not set. Vision taste waits.",
      analyzed: [],
      skipped: [],
      pending: pending.length,
      errors: [],
    }
  }
  const analyze = input.analyze ?? ((record, bytes, mediaType) => analyzeReferenceImage({ id: record.id, bytes, mediaType, env }))
  const report: TasteBackfillReport = { status: "ok", analyzed: [], skipped: [], pending: pending.length, errors: [] }
  let done = 0
  for (const record of records) {
    const listed = [...record.images].sort((a, b) => (a.role === "front" ? -1 : 1) - (b.role === "front" ? -1 : 1))[0]
    if (listed && isForbiddenResearchPath(listed.path)) {
      report.errors.push(`${record.id} skipped: private path`)
      continue
    }
    const image = frontImage(record)
    if (!image) continue
    const prior = byId.get(record.id)
    let bytes: Buffer
    let mediaType: "image/jpeg" | "image/png" | "image/webp"
    try {
      const loaded = input.readImage ? await input.readImage(record) : await loadBytes(record, env)
      if (!loaded) {
        report.skipped.push(record.id)
        continue
      }
      bytes = loaded.bytes
      mediaType = loaded.mediaType
    } catch (error) {
      report.errors.push(error instanceof Error ? error.message : `${record.id} could not be read`)
      continue
    }
    const sha = hashImage(bytes)
    if (prior?.origin === "vision" && prior.imageSha256 === sha) {
      report.skipped.push(record.id)
      continue
    }
    if (done >= limit) continue
    try {
      const taste = await analyze(record, bytes, mediaType)
      if (!taste) {
        report.errors.push(`${record.id} returned no analysis`)
        continue
      }
      const stored: VisionTaste = {
        ...taste,
        id: record.id,
        origin: "vision",
        imageSha256: sha,
        imagePath: image.path,
        analyzedAt: input.now ?? new Date().toISOString(),
      }
      await store.put(record.id, stored)
      byId.set(record.id, stored)
      done += 1
      report.analyzed.push(record.id)
    } catch (error) {
      report.errors.push(error instanceof Error ? error.message : `${record.id} failed`)
    }
  }
  await store.put("index", { ids: [...byId.keys()].sort() })
  report.pending = records.filter((record) => needsTaste(record, byId.get(record.id))).length
  return report
}

export async function analyzeReferenceImage(input: {
  id: string
  bytes: Buffer
  mediaType: "image/jpeg" | "image/png" | "image/webp"
  env: NodeJS.ProcessEnv
}): Promise<VisionTaste | null> {
  const apiKey = input.env.ANTHROPIC_API_KEY?.trim()
  if (!apiKey) return null
  try {
    const Anthropic = (await import("@anthropic-ai/sdk")).default
    const client = new Anthropic({ apiKey })
    const response = await client.messages.create({
      model: input.env.DESIGN_MODEL?.trim() || MODEL,
      max_tokens: 1200,
      system: tasteSystem(),
      messages: [
        {
          role: "user",
          content: [
            { type: "image", source: { type: "base64", media_type: input.mediaType, data: input.bytes.toString("base64") } },
            { type: "text", text: `Id ${input.id}. Describe only what is visible. Return JSON.` },
          ],
        },
      ],
    })
    const text = response.content.filter((block) => block.type === "text").map((block) => block.text).join("\n")
    const taste = parseVisionTastePayload(parseJson(text), input.id)
    if (!taste) return null
    taste.model = response.model
    taste.scoreKind = "vision"
    const cost = {
      cardId: input.id,
      step: "analyze" as const,
      model: response.model,
      inputTokens: response.usage?.input_tokens ?? 0,
      outputTokens: response.usage?.output_tokens ?? 0,
      estimatedUsd: estimateUsd(response.usage?.input_tokens ?? 0, response.usage?.output_tokens ?? 0, input.env),
    }
    logTokenCost(cost)
    return taste
  } catch (error) {
    console.info(`[design-intelligence] ${JSON.stringify({ step: "vision-taste", id: input.id, error: error instanceof Error ? error.message : "analyze failed" })}`)
    return null
  }
}

function tasteSystem(): string {
  return [
    "You are a direct-mail art director reading one reference photograph.",
    "Return JSON only. Describe transferable principles. Do not transcribe brand names, slogans, phone numbers, urls, or prices.",
    "Keys: eyePath, focalElement, scaleRatios {offerVersusHeadline, headlineVersusBody}, whitespace, paletteRoles {background, type, offer, accent}, typeIntegration, responseBlock, whatWorks, grade, industry, offerType, feel, compositionFamily.",
    `grade is one of ${LETTERS.join(", ")}.`,
    `industry is one of ${TASTE_INDUSTRIES.join(", ")}.`,
    `offerType is one of ${TASTE_OFFER_TYPES.join(", ")}.`,
    `feel is one of ${TASTE_FEELS.join(", ")}.`,
    "Grade an integrated piece (type on the open canvas, one floating offer, one subject, at most one thumbnail row) as A or A-.",
    "Grade a panel of boxes, even a tidy one, as B- or C+.",
    "whatWorks is one sentence a designer can reuse without copying the piece.",
  ].join("\n")
}

function needsTaste(record: LibraryRecord, prior: VisionTaste | undefined): boolean {
  const image = frontImage(record)
  if (!image || isForbiddenResearchPath(image.path)) return false
  return prior?.origin !== "vision" || !prior.imageSha256
}

function frontImage(record: LibraryRecord) {
  return [...record.images]
    .filter((image) => !isForbiddenResearchPath(image.path))
    .sort((a, b) => (a.role === "front" ? -1 : 1) - (b.role === "front" ? -1 : 1))[0]
}

async function loadRecords(): Promise<LibraryRecord[]> {
  const { loadLibrary } = await import("./library")
  return loadLibrary()
}

async function loadBytes(record: LibraryRecord, env: NodeJS.ProcessEnv) {
  const { readRecordImage } = await import("./images")
  return readRecordImage(record, env)
}

function batchLimit(value: string | number | undefined, env: NodeJS.ProcessEnv): number {
  const parsed = typeof value === "number" ? value : Number(value ?? env.VISION_TASTE_BATCH ?? 4)
  if (!Number.isFinite(parsed)) return 4
  return Math.max(1, Math.min(8, Math.round(parsed)))
}

function indexIds(raw: unknown): string[] {
  if (!raw || typeof raw !== "object") return []
  const ids = (raw as { ids?: unknown }).ids
  if (!Array.isArray(ids)) return []
  return ids.filter((id): id is string => typeof id === "string")
}

function asLetter(value: string | undefined): LetterGrade | null {
  if (!value) return null
  const cleaned = value.trim().toUpperCase().replace("MINUS", "-").replace("PLUS", "+")
  const match = LETTERS.find((letter) => letter === cleaned || letter === value.trim())
  if (match) return match
  const upper = value.trim()
  if ((LETTERS as readonly string[]).includes(upper)) return upper as LetterGrade
  return null
}

export function normalizeIndustry(value: string | undefined): string {
  const text = (value ?? "").toLowerCase().replace(/[\s-]+/g, "_")
  if (text === "medicare_insurance" || text === "insurance") return "medicare"
  if (text === "realestate") return "real_estate"
  if (text === "pest" || text === "pestcontrol") return "pest_control"
  if ((TASTE_INDUSTRIES as readonly string[]).includes(text)) return text
  if (text === "general_local_service") return "general"
  return "general"
}

function normalizeOffer(value: string): string {
  const text = value.toLowerCase().replace(/[\s-]+/g, "_")
  if ((TASTE_OFFER_TYPES as readonly string[]).includes(text)) return text
  return inferOfferType(value)
}

function normalizeFeel(value: string): string {
  const text = value.toLowerCase()
  if ((TASTE_FEELS as readonly string[]).includes(text)) return text
  return inferFeel(value)
}

export function inferOfferType(text: string): string {
  const hay = text.toLowerCase()
  if (/we buy|cash offer|sell your/.test(hay)) return "we_buy"
  if (/tune-up|tune up|seasonal service/.test(hay)) return "tune_up"
  if (/storm|wind|hail/.test(hay)) return "storm"
  if (/free|\$0|inspection|estimate/.test(hay)) return "free_inspection"
  if (/%|percent/.test(hay)) return "percent"
  if (/\$\s?\d+\s?off|dollars off/.test(hay)) return "dollar_off"
  if (/\$\s?\d/.test(hay)) return "price_point"
  if (/saturday|appointment|book|showing/.test(hay)) return "appointment"
  return "other"
}

export function inferFeel(text: string): string {
  const hay = text.toLowerCase()
  if (/appetite|menu|restaurant|dish/.test(hay)) return "appetite"
  if (/calm|medicare|advisor|compliance/.test(hay)) return "calm"
  if (/storm|urgent|leak|emergency/.test(hay)) return "urgent"
  if (/panel|boxed|column|rail|template/.test(hay)) return "panel"
  if (/editorial|question/.test(hay)) return "editorial"
  if (/full-bleed|full bleed|canvas|floating|integrated|cut-out|cutout/.test(hay)) return "integrated"
  return "integrated"
}

function scrub(value: string): string {
  return value
    .replace(/\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g, "")
    .replace(/https?:\/\/\S+/gi, "")
    .replace(/\$\s?\d[\d,]*/g, "a price")
    .replace(/\s+/g, " ")
    .trim()
}

function clip(value: string): string {
  const text = value.replace(/\s+/g, " ").trim()
  return text.length > 400 ? `${text.slice(0, 397)}...` : text
}

function stringField(row: object, key: string): string {
  const value = (row as Record<string, unknown>)[key]
  return typeof value === "string" ? value : ""
}

function record(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null
  return value as Record<string, unknown>
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

export function highGrade(taste: VisionTaste): boolean {
  return gradeRank(taste.grade) <= gradeRank("B")
}


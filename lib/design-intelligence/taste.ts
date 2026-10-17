import type { MailerAnalysis } from "./library"

/**
 * A grounded reading of one reference mailer.
 * The vision pass describes what is visible. It does not transcribe a brand,
 * a phone number, a price, or a slogan. Written notes are a fallback until
 * that pass has seen the image.
 */

export const TASTE_VERSION = "1" as const

export const TASTE_GRADES = ["A", "A-", "B+", "B", "B-", "C+", "C", "C-", "D", "F"] as const
export type TasteGrade = (typeof TASTE_GRADES)[number]

export const TYPE_INTEGRATIONS = ["on_open_canvas", "on_panel", "on_scrim", "boxed", "mixed"] as const
export type TypeIntegration = (typeof TYPE_INTEGRATIONS)[number]

export interface TasteAnalysis {
  version: typeof TASTE_VERSION
  id: string
  groundedBy: "vision" | "written-notes"
  model: string
  analyzedAt: string
  eyePath: string
  focalElement: string
  scaleRatios: {
    offerToHeadline: string
    headlineToBody: string
  }
  whitespace: string
  paletteRoles: {
    ground: string
    type: string
    accent: string
  }
  typeIntegration: TypeIntegration
  responseBlock: string
  whatMakesItWork: string
  grade: TasteGrade
  industry: string
  offerType: string
  feel: string
  compositionFamily: string
  doNotCopy: string[]
}

const SAFE_ID = /^[A-Za-z0-9_-]{1,80}$/

export function parseTasteAnalysis(
  id: string,
  raw: unknown,
  meta: { model: string; analyzedAt: string; groundedBy?: TasteAnalysis["groundedBy"] }
): TasteAnalysis | null {
  if (!SAFE_ID.test(id)) return null
  if (!raw || typeof raw !== "object") return null
  const row = raw as Record<string, unknown>
  const scale = record(row.scaleRatios)
  const palette = record(row.paletteRoles)
  const grade = normalizeGrade(row.grade)
  const integration = normalizeIntegration(row.typeIntegration)
  const eyePath = scrub(stringField(row, "eyePath"))
  const focalElement = scrub(stringField(row, "focalElement"))
  const whatMakesItWork = scrub(stringField(row, "whatMakesItWork"))
  const offerToHeadline = scrub(scale ? stringField(scale, "offerToHeadline") : "")
  const headlineToBody = scrub(scale ? stringField(scale, "headlineToBody") : "")
  if (!grade || !integration || eyePath.length < 8 || focalElement.length < 8 || whatMakesItWork.length < 8) return null
  if (offerToHeadline.length < 3 || headlineToBody.length < 3) return null
  const analysis: TasteAnalysis = {
    version: TASTE_VERSION,
    id,
    groundedBy: meta.groundedBy ?? "vision",
    model: meta.model,
    analyzedAt: meta.analyzedAt,
    eyePath,
    focalElement,
    scaleRatios: { offerToHeadline, headlineToBody },
    whitespace: scrub(stringField(row, "whitespace")) || "A calm field is part of the composition.",
    paletteRoles: {
      ground: scrub(palette ? stringField(palette, "ground") : "") || "A light ground",
      type: scrub(palette ? stringField(palette, "type") : "") || "Dark type",
      accent: scrub(palette ? stringField(palette, "accent") : "") || "One accent",
    },
    typeIntegration: integration,
    responseBlock: scrub(stringField(row, "responseBlock")) || "One response group.",
    whatMakesItWork,
    grade,
    industry: scrub(stringField(row, "industry")) || "general_local_service",
    offerType: scrub(stringField(row, "offerType")) || "other",
    feel: scrub(stringField(row, "feel")) || "integrated",
    compositionFamily: scrub(stringField(row, "compositionFamily")) || "open",
    doNotCopy: ["Do not copy the mark, the amounts, the phone, the photos, or the wording."],
  }
  if (leaksPrivate(analysis)) return null
  return analysis
}

export function tasteFromWrittenNotes(analysis: MailerAnalysis, analyzedAt = "seed"): TasteAnalysis | null {
  const grade = normalizeGrade(analysis.grade) ?? "C"
  const summary = scrub(analysis.summary || analysis.focal_point || "")
  if (!analysis.id || summary.length < 8) return null
  const grid = `${analysis.grid ?? ""} ${analysis.summary ?? ""}`.toLowerCase()
  const integration: TypeIntegration = /open canvas|on the canvas|cut-?out/.test(grid)
    ? "on_open_canvas"
    : /box|card|template/.test(grid)
      ? "boxed"
      : /panel|band|slab/.test(grid)
        ? "on_panel"
        : "mixed"
  return parseTasteAnalysis(
    analysis.id,
    {
      eyePath: analysis.eye_path || summary,
      focalElement: analysis.focal_point || summary,
      scaleRatios: {
        offerToHeadline: analysis.scale_ratios || "The offer and the headline use different sizes.",
        headlineToBody: "The headline is at least two and a half times the body.",
      },
      whitespace: "Calm field comes from the photograph or the ground, not from extra boxes.",
      paletteRoles: {
        ground: "Neutrals from the piece",
        type: "Type in a dark neutral or one accent",
        accent: "One accent",
      },
      typeIntegration: integration,
      responseBlock: analysis.trust_and_cta || "One phone with the response.",
      whatMakesItWork: analysis.emulate?.[0] || summary,
      grade,
      industry: analysis.vertical || "general_local_service",
      offerType: offerTypeFromNotes(analysis),
      feel: integration === "on_open_canvas" ? "integrated" : integration === "on_panel" ? "panel" : "mixed",
      compositionFamily: integration,
    },
    { model: "written-notes", analyzedAt, groundedBy: "written-notes" }
  )
}

export function scrub(value: string): string {
  return value
    .replace(/\b\d{3}[-.\s]?\d{3}[-.\s]?\d{4}\b/g, "")
    .replace(/https?:\/\/\S+/gi, "")
    .replace(/\b[\w.+-]+@[\w.-]+\.[a-z]{2,}\b/gi, "")
    .replace(/\$\s?\d[\d,]*(?:\.\d+)?/g, "a price")
    .replace(/\s+/g, " ")
    .trim()
}

export function normalizeGrade(value: unknown): TasteGrade | null {
  if (typeof value !== "string") return null
  const text = value.trim().toUpperCase().replace("MINUS", "-").replace("PLUS", "+").replace(/\s+/g, "")
  if (text === "A+") return "A"
  if ((TASTE_GRADES as readonly string[]).includes(text)) return text as TasteGrade
  return null
}

function normalizeIntegration(value: unknown): TypeIntegration | null {
  if (typeof value !== "string") return null
  const text = value.trim().toLowerCase().replace(/[\s-]+/g, "_")
  if ((TYPE_INTEGRATIONS as readonly string[]).includes(text)) return text as TypeIntegration
  if (/open|canvas|cut/.test(text)) return "on_open_canvas"
  if (/panel|slab|band/.test(text)) return "on_panel"
  if (/scrim/.test(text)) return "on_scrim"
  if (/box/.test(text)) return "boxed"
  return null
}

function offerTypeFromNotes(analysis: MailerAnalysis): string {
  const text = `${analysis.offer_placement ?? ""} ${analysis.summary ?? ""}`.toLowerCase()
  if (/free|\$0|no charge/.test(text)) return "free"
  if (/percent|%/.test(text)) return "percent"
  if (/price|numeral|\$|amount|figure/.test(text)) return "numeral"
  if (/inspect|estimate|review/.test(text)) return "inspection"
  return "other"
}

function leaksPrivate(analysis: TasteAnalysis): boolean {
  const blob = JSON.stringify(analysis)
  return /\/private\//i.test(blob) || blob.split("/").some((part) => part.toLowerCase() === "private")
}

function record(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null
  return value as Record<string, unknown>
}

function stringField(record: Record<string, unknown>, key: string): string {
  const value = record[key]
  return typeof value === "string" ? value : ""
}

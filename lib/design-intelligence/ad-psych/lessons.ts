import { readFileSync } from "node:fs"
import path from "node:path"

/**
 * Lessons from the Ad Psychologist libraries.
 * Campaigns are reasoning examples. Their wording is not copy.
 * Agency-reported results are unverified and never leave this parser.
 */

export type DirectionRole = "outcome" | "threat" | "trust"

export interface AdLesson {
  vertical: string
  /** What to do, with slogans, urls, and result figures removed. */
  use: string
  /** What to avoid. */
  avoid: string
}

const RESULT = /\b(?:impressions?|views?|lift|roi|award|unverified|percentage points?|brand awareness|effie)\b/i
const RESULT_FIGURE = /\b\d[\d,.]*(?:\s*(?:%|k|m|x))\b/i
const URL = /https?:\/\/\S+/gi
const URL_TEST = /https?:\/\/\S+/i
const SHORT_QUOTE = /[“"]([^”"\n]{12,90})[”"]/g

const VERTICAL_KIND: Array<[RegExp, string]> = [
  [/roof/i, "roofing"],
  [/window/i, "windows"],
  [/solar/i, "solar"],
  [/hvac|heating|cooling/i, "hvac"],
  [/plumb/i, "plumbing"],
  [/pest|termite/i, "pest"],
  [/medicare|final expense/i, "medicare"],
  [/we buy|real estate|realtor/i, "real_estate"],
  [/food|restaurant|coupon|retail|qsr/i, "food"],
  [/dental|dentist/i, "dental"],
  [/landscap|lawn|yard|outdoor/i, "landscaping"],
  [/legal|attorney|lawyer|personal injury/i, "legal"],
  [/garage|handyman/i, "general"],
]

const ROLE_HINT: Record<DirectionRole, RegExp> = {
  outcome: /outcome|finished|not the|show the|life in|smile|evening|benefit|result the|curb|feels|joy/i,
  threat: /fear|threat|leak|damage|one-step|one easy|easy action|before it|inspect first|efficacy/i,
  trust: /trust|local|credential|face|authority|named|recognized|badge/i,
}

const FALLBACK: Record<DirectionRole, string> = {
  outcome: "Show the result the customer gets, not the product feature.",
  threat: "A threat belongs on the card only next to one easy action.",
  trust: "Local trust uses the business the client named, never an invented count.",
}

export function verticalKind(heading: string): string {
  const title = heading.replace(/\([^)]*\)/g, " ")
  for (const [pattern, kind] of VERTICAL_KIND) {
    if (pattern.test(title)) return kind
  }
  return "general"
}

/** Drop slogans, urls, and result figures. Keep the reasoning. */
export function sanitizeLesson(text: string): string {
  const withoutQuotes = text.replace(SHORT_QUOTE, " ")
  const stripped = withoutQuotes
    .replace(URL, " ")
    .replace(/\([^)]*(?:unverified|agency|award|claim)[^)]*\)/gi, " ")
    .replace(/\bResults?:[^.]+\./gi, " ")
    .replace(/·?\s*Compliance:.*$/i, " ")
    .replace(RESULT_FIGURE, " ")
    .replace(/#\d+\b/g, " ")
    .replace(/\*+/g, "")
    .replace(/\(\s*\)/g, " ")
    .replace(/\s+,/g, ",")
  const sentences = stripped
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.replace(/\s+/g, " ").trim())
    .filter((sentence) => sentence.length >= 24 && !RESULT.test(sentence) && !RESULT_FIGURE.test(sentence))
  return sentences.join(" ").replace(/\s+/g, " ").trim()
}

export function extractLessons(markdown: string): AdLesson[] {
  const lessons: AdLesson[] = []
  let vertical = "general"
  for (const line of markdown.split("\n")) {
    const heading = line.match(/^##\s+(.+)/)
    if (heading?.[1] && !/^how to read|^patterns|^note|^bottom line/i.test(heading[1])) {
      vertical = verticalKind(heading[1])
    }
    const hinted = line.match(/\(([^)]{3,40})\)/)
    const lineVertical = hinted ? verticalKind(hinted[1]) : "general"
    const scope = lineVertical === "general" ? vertical : lineVertical
    const lesson = line.match(/(?:Lesson(?: for postcards)?)\s*:?\s*(.+)$/i)
    const rule = line.match(/(?:\*\*Rule for the AI:\*\*|^\s*-\s+\*\*Rule for the AI:\*\*)\s*(.+)$/i)
    const useLine = lesson?.[1] ?? rule?.[1]
    if (useLine) {
      const use = sanitizeLesson(useLine)
      if (use) lessons.push({ vertical: scope, use, avoid: "" })
    }
    const avoid = line.match(/❌\s*\*\*Don't[^*]*\*\*\s*:?\s*(.+)$/i)
    if (avoid?.[1]) {
      const text = sanitizeLesson(avoid[1].replace(SHORT_QUOTE, " "))
      if (text) lessons.push({ vertical: scope, use: "", avoid: text })
    }
  }
  return lessons.filter((lesson) => lesson.use || lesson.avoid)
}

export function loadAdLessons(): AdLesson[] {
  const dir = path.join(/*turbopackIgnore: true*/ process.cwd(), "lib/design-intelligence/ad-psych")
  const files = [
    "postcard-principles.md",
    "emotion-needs.md",
    "campaign-library.md",
    "campaign-library-extra.md",
    "campaign-library-mando.md",
  ]
  return files.flatMap((file) => extractLessons(readFileSync(path.join(dir, file), "utf8")))
}

export function lessonForRole(lessons: readonly AdLesson[], kind: string, role: DirectionRole): string {
  const pool = lessons.filter((lesson) => lesson.vertical === kind && lesson.use)
  const general = lessons.filter((lesson) => lesson.vertical === "general" && lesson.use)
  const picked = bestLesson(pool, role) || (kind === "general" ? "" : bestLesson(general, role))
  return clientSafeLesson(picked, role)
}

function bestLesson(lessons: readonly AdLesson[], role: DirectionRole): string {
  const ranked = lessons
    .map((lesson) => ({ lesson, score: scoreLesson(lesson.use, role) }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score || b.lesson.use.length - a.lesson.use.length)
  const hit = ranked.find((item) => item.score >= 3)
  return hit?.lesson.use ?? ""
}

function scoreLesson(text: string, role: DirectionRole): number {
  if (RESULT.test(text) || RESULT_FIGURE.test(text)) return 0
  if (/\bnot the same\b|\bmeasure response\b/i.test(text)) return 0
  if (role === "trust" && /\bquote\b|\bstatistic\b|\btestimonial\b/i.test(text)) return 0
  let score = ROLE_HINT[role].test(text) ? 3 : 0
  if (role === "outcome" && /\bnot the\b/i.test(text)) score += 2
  if (role === "threat" && /\beasy\b|\bone-step\b|\baction\b/i.test(text)) score += 2
  if (role === "trust" && /\blocal\b|\bnamed\b|\bface\b/i.test(text)) score += 2
  return score
}

export function clientSafeLesson(text: string, role: DirectionRole): string {
  const cleaned = text.replace(/\s+/g, " ").trim()
  if (cleaned.length < 24 || RESULT.test(cleaned) || RESULT_FIGURE.test(cleaned)) return FALLBACK[role]
  if (/\b(?:home team|local event|certification badge|measure response)\b/i.test(cleaned)) return FALLBACK[role]
  if (role === "trust" && /\b(?:quote|statistic|neighbors?\s+said|testimonial|reference group)\b/i.test(cleaned)) return FALLBACK.trust
  return cleaned.length > 220 ? `${cleaned.slice(0, 217).trim()}…` : cleaned
}

/** Short quoted campaign lines. These are examples, never headlines. */
export function forbiddenClientText(markdown: string): string[] {
  const found = new Set<string>()
  for (const match of markdown.matchAll(SHORT_QUOTE)) {
    const line = (match[1] ?? "").replace(/\s+/g, " ").trim()
    if (line.length >= 16 && line.length <= 80 && !URL_TEST.test(line) && !RESULT.test(line)) found.add(line.toLowerCase())
  }
  return [...found]
}

export function textHasAgencyResult(text: string): boolean {
  return RESULT.test(text) && RESULT_FIGURE.test(text)
}

export function headlineCopiesLine(headline: string, forbidden: readonly string[]): boolean {
  const line = headline.replace(/\s+/g, " ").trim().toLowerCase().replace(/[.!?]+$/g, "")
  if (line.length < 12) return false
  return forbidden.some((item) => item.replace(/[.!?]+$/g, "") === line)
}

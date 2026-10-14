/**
 * Display headlines are 3–6 words. Eight is a hard cap.
 * Offer and supporting detail move into the subhead.
 * Overlong headlines are repaired. They do not fail generation.
 */

export const HEADLINE_WORD_MIN = 3
export const HEADLINE_WORD_TARGET = 6
export const HEADLINE_WORD_HARD_CAP = 8
export const SUBHEAD_WORD_CAP = 18

const BREAK_BEFORE = new Set([
  "including",
  "with",
  "plus",
  "and",
  "or",
  "for",
  "featuring",
  "before",
  "after",
  "from",
  "that",
  "which",
  "while",
  "when",
  "because",
  "without",
  "into",
])

const DANGLING = new Set([
  "a",
  "an",
  "the",
  "to",
  "of",
  "for",
  "and",
  "or",
  "with",
  "in",
  "on",
  "at",
  "by",
  "from",
  "into",
])

export interface HeadlineCopy {
  headline?: string
  subheadline?: string
}

export function headlineWordCount(value: string | undefined): number {
  return tokenize(value).length
}

export function repairHeadlineCopy(input: HeadlineCopy): {
  headline: string
  subheadline?: string
} {
  const raw = repairBusinessPlaceHeadline(collapse(input.headline))
  if (!raw) {
    const subheadline = collapse(input.subheadline)
    return { headline: "", subheadline: subheadline || undefined }
  }

  let head = raw
  let moved = ""

  const punct = splitOnPunctuation(raw)
  if (punct) {
    const leftCount = headlineWordCount(punct.left)
    const total = headlineWordCount(raw)
    const leftFits = leftCount >= HEADLINE_WORD_MIN && leftCount <= HEADLINE_WORD_TARGET
    const salvage =
      !leftFits &&
      total > HEADLINE_WORD_TARGET &&
      leftCount >= 1 &&
      leftCount <= HEADLINE_WORD_HARD_CAP
    if (leftFits || salvage) {
      head = punct.left
      moved = punct.right
    }
  }

  head = trimEdgePunctuation(head)
  const words = tokenize(head)
  const cut = cutIndex(words)
  if (cut !== null && cut < words.length) {
    moved = joinMoved(words.slice(cut).join(" "), moved)
    head = words.slice(0, cut).join(" ")
  }

  head = trimEdgePunctuation(head)

  let sub = collapse(input.subheadline)
  const extra = sentenceCase(moved)
  if (extra) {
    if (!sub) sub = extra
    else if (!sub.toLowerCase().includes(extra.toLowerCase())) {
      const lead = /[.!?]$/.test(extra) ? extra : `${extra}.`
      sub = `${lead} ${sub}`.trim()
    }
  }
  const subWords = tokenize(sub)
  if (subWords.length > SUBHEAD_WORD_CAP) sub = subWords.slice(0, SUBHEAD_WORD_CAP).join(" ")

  return { headline: head, subheadline: sub || undefined }
}

export function repairSpecHeadline<T extends HeadlineCopy>(spec: T): T {
  if (!spec.headline?.trim()) return spec
  const next = repairHeadlineCopy(spec)
  const headlineSame = next.headline === spec.headline
  const subSame = (next.subheadline ?? "") === (spec.subheadline ?? "")
  if (headlineSame && subSame) return spec
  return { ...spec, headline: next.headline, subheadline: next.subheadline }
}

/**
 * "Plumbers Solana Beach Trusts" is a business noun, a place, and a verb
 * with the wrong number. It becomes "The Plumber Solana Beach Trusts".
 * Ordinary headlines do not match and stay as they are.
 */
const PLACE_HEADLINE_VERBS = new Set([
  "trusts",
  "recommends",
  "chooses",
  "prefers",
  "loves",
  "knows",
  "calls",
  "hires",
  "picks",
  "needs",
  "wants",
  "uses",
  "backs",
])

const PLACE_MODIFIERS = new Set(["trusted", "local", "neighborhood", "family", "hometown"])

const NOT_A_PLACE = new Set([
  "a",
  "an",
  "the",
  "and",
  "or",
  "for",
  "with",
  "your",
  "our",
  "their",
  "you",
  "to",
  "of",
  "in",
  "on",
  "at",
  "by",
  "from",
  "near",
  "this",
  "that",
  "these",
  "those",
  "always",
  "already",
  "still",
  "really",
  "truly",
  "just",
  "only",
  "more",
  "most",
  "very",
  "now",
  "today",
  "here",
  "there",
  "home",
  "house",
  "free",
  "best",
  "quiet",
  "small",
  "big",
  "early",
  "fast",
  "same",
  "next",
  "last",
  "first",
  "leak",
  "leaks",
  "bill",
  "roof",
  "roofs",
  "crew",
  "crews",
  "team",
  "water",
  "heat",
  "storm",
])

const AGENT_NOUN = /(er|or|ar|ist|ian|man|ic)$/i

function repairBusinessPlaceHeadline(value: string): string {
  const words = tokenize(value)
  if (words.length < 3) return value
  const verb = words[words.length - 1] ?? ""
  if (!PLACE_HEADLINE_VERBS.has(normalizeToken(verb))) return value

  let index = 0
  if (normalizeToken(words[0] ?? "") === "the") index = 1

  const modifiers: string[] = []
  while (index < words.length - 2 && PLACE_MODIFIERS.has(normalizeToken(words[index] ?? ""))) {
    modifiers.push(words[index] ?? "")
    index += 1
  }

  const business = words[index] ?? ""
  if (!isAgentNoun(business)) return value
  const place = words.slice(index + 1, -1)
  if (place.length < 1 || place.length > 4 || !place.every(isPlaceToken)) return value

  const nextWords = ["The", ...modifiers.map(titleWord), titleWord(singularizeBusiness(business)), ...place, verb]
  if (nextWords.length > HEADLINE_WORD_HARD_CAP) return value
  const next = nextWords.join(" ")
  return next === value ? value : next
}

function isAgentNoun(word: string): boolean {
  return AGENT_NOUN.test(singularizeBusiness(word))
}

function isPlaceToken(word: string): boolean {
  const token = normalizeToken(word)
  if (!token || NOT_A_PLACE.has(token) || PLACE_HEADLINE_VERBS.has(token) || isAgentNoun(word)) {
    return false
  }
  if (/^(de|la|los|las|san|santa|st|saint|fort|mount|lake|port)$/i.test(token)) return true
  return /^[\p{Lu}]/u.test(word)
}

function singularizeBusiness(word: string): string {
  const lower = word.toLowerCase()
  if (lower.endsWith("ies") && lower.length > 4) return `${word.slice(0, -3)}y`
  if (/(ches|shes|sses|xes|zes)$/i.test(lower) && lower.length > 4) return word.slice(0, -2)
  if (lower.endsWith("s") && !lower.endsWith("ss") && lower.length > 3) return word.slice(0, -1)
  return word
}

function titleWord(word: string): string {
  if (!word) return word
  if (word === word.toUpperCase()) return word
  return word.charAt(0).toUpperCase() + word.slice(1)
}

function splitOnPunctuation(value: string): { left: string; right: string } | null {
  const comma = value.match(/^(.+?)[,:;]\s+(.+)$/)
  if (comma) return { left: comma[1], right: comma[2] }
  const dash = value.match(/^(.+?)\s+[—–]\s+(.+)$/)
  if (dash) return { left: dash[1], right: dash[2] }
  const sentence = value.match(/^(.+?[.!?])\s+(.+)$/)
  if (sentence) return { left: sentence[1], right: sentence[2] }
  return null
}

/**
 * Headlines already inside the hard cap stay put unless a natural break
 * can land them in the 3–6 word range. Longer lines break on a phrase
 * boundary up to 8 words, then on the 6-word target.
 */
function cutIndex(words: string[]): number | null {
  if (words.length <= HEADLINE_WORD_TARGET) return null
  const natural = findBreak(words)
  if (words.length <= HEADLINE_WORD_HARD_CAP) {
    return natural !== null && natural <= HEADLINE_WORD_TARGET ? natural : null
  }
  if (natural !== null) return natural
  return avoidDangling(words, HEADLINE_WORD_TARGET)
}

function findBreak(words: string[]): number | null {
  let withinTarget: number | null = null
  let withinCap: number | null = null
  for (let index = 0; index < words.length; index += 1) {
    if (!BREAK_BEFORE.has(normalizeToken(words[index] ?? ""))) continue
    if (index < HEADLINE_WORD_MIN || index > HEADLINE_WORD_HARD_CAP) continue
    if (index <= HEADLINE_WORD_TARGET) withinTarget = index
    else if (withinCap === null) withinCap = index
  }
  return withinTarget ?? withinCap
}

function avoidDangling(words: string[], cut: number): number {
  let next = Math.min(cut, HEADLINE_WORD_HARD_CAP, words.length)
  while (next > HEADLINE_WORD_MIN && DANGLING.has(normalizeToken(words[next - 1] ?? ""))) {
    next -= 1
  }
  if (next < HEADLINE_WORD_MIN) return Math.min(words.length, HEADLINE_WORD_TARGET)
  return next
}

function tokenize(value: string | undefined): string[] {
  return collapse(value).split(" ").filter(Boolean)
}

function normalizeToken(value: string): string {
  return value.toLowerCase().replace(/[^\p{L}\p{N}'’-]/gu, "")
}

function collapse(value: string | undefined): string {
  return (value ?? "").replace(/\s+/g, " ").trim()
}

function trimEdgePunctuation(value: string): string {
  return value.replace(/^[,:;.\-—–\s]+/, "").replace(/[,:;.\-—–\s]+$/g, "").trim()
}

function joinMoved(next: string, previous: string): string {
  return [next, previous].map((part) => part.trim()).filter(Boolean).join(" ")
}

function sentenceCase(value: string): string {
  const trimmed = trimEdgePunctuation(collapse(value))
  if (!trimmed) return ""
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1)
}

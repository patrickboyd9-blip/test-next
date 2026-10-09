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
  const raw = collapse(input.headline)
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

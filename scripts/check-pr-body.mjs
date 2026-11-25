import path from "node:path"
import { pathToFileURL } from "node:url"

/**
 * Checks a pull request body for the sections CI requires.
 *
 * Requirement served, Manifesto check, and Customer experience are detected the
 * same way, case-insensitively: a markdown heading (ATX `#`–`######` or a
 * Setext underline) or a label line such as "Customer experience: ...".
 * Customer experience must also contain text.
 *
 *   BODY="$(cat pr.md)" node scripts/check-pr-body.mjs
 */

const REQUIRED = [
  { title: "Requirement served", requireBody: false },
  { title: "Manifesto check", requireBody: false },
  { title: "Customer experience", requireBody: true },
]

/**
 * @param {string | null | undefined} body
 * @returns {string[]} Human-readable failures. Empty when the body passes.
 */
export function checkPullRequestBody(body) {
  const sections = parseSections(body ?? "")
  const errors = []

  for (const required of REQUIRED) {
    const matches = sections.filter((section) => headingMatches(section.rawTitle, required.title))
    if (matches.length === 0) {
      errors.push(missingMessage(required.title, required.requireBody))
      continue
    }
    if (required.requireBody && !matches.some((section) => sectionText(section).length > 0)) {
      errors.push(emptyMessage(required.title))
    }
  }

  return errors
}

/**
 * @param {string} title
 * @param {boolean} requireBody
 */
function missingMessage(title, requireBody) {
  const heading = `Add a markdown heading such as "## ${title}" (any heading level; case does not matter) or a line that starts with "${title}:".`
  if (title === "Customer experience" && requireBody) {
    return [
      'PR body is missing a non-empty "Customer experience" section.',
      heading,
      "Under that heading, write one or two plain-English sentences naming the specific customer moment this change improves.",
      'Example: "A roofer approves a proof from Claude in two minutes."',
      'Internal changes (CI, refactors, tests) still fill it in, naming the customer experience they protect, or write "Internal: <customer outcome it protects>".',
    ].join(" ")
  }
  return `PR body is missing a "${title}" section. ${heading}`
}

/** @param {string} title */
function emptyMessage(title) {
  return [
    `PR body has an empty "${title}" section.`,
    "Under that heading, write one or two plain-English sentences naming the specific customer moment this change improves.",
    'Example: "A roofer approves a proof from Claude in two minutes."',
    'Internal changes (CI, refactors, tests) still fill it in, naming the customer experience they protect, or write "Internal: <customer outcome it protects>".',
  ].join(" ")
}

/**
 * @param {string} body
 * @returns {{ rawTitle: string, inline: string, lines: string[] }[]}
 */
function parseSections(body) {
  const lines = body.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n")
  /** @type {{ rawTitle: string, inline: string, lines: string[] }[]} */
  const sections = []
  /** @type {{ rawTitle: string, inline: string, lines: string[] } | null} */
  let current = null
  /** @type {{ marker: string, size: number } | null} */
  let fence = null

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index]
    const fenceMark = line.match(/^\s{0,3}(`{3,}|~{3,})/)
    if (fenceMark) {
      const token = fenceMark[1]
      if (!fence) fence = { marker: token[0], size: token.length }
      else if (fence.marker === token[0] && token.length >= fence.size) fence = null
      if (current) current.lines.push(line)
      continue
    }
    if (fence) {
      if (current) current.lines.push(line)
      continue
    }

    const heading = headingFromLine(line, lines[index + 1]) ?? labelFromLine(line)
    if (heading) {
      current = { rawTitle: heading.rawTitle, inline: heading.inline, lines: [] }
      sections.push(current)
      if (heading.skipNext) index += 1
      continue
    }

    if (current) current.lines.push(line)
  }

  return sections
}

/**
 * @param {string} line
 * @param {string | undefined} next
 * @returns {{ rawTitle: string, inline: string, skipNext: boolean } | null}
 */
function headingFromLine(line, next) {
  const atx = line.match(/^\s{0,3}#{1,6}\s+(.+?)\s*#*\s*$/)
  if (atx) return { rawTitle: atx[1], inline: "", skipNext: false }

  if (next && line.trim() && /^\s{0,3}(?:=+|-+)\s*$/.test(next)) {
    const underline = next.trim()
    const mark = underline[0]
    const title = line.trim()
    const namesASection = REQUIRED.some((required) => headingMatches(title, required.title))
    // A line of dashes is usually a horizontal rule. Treat it as a Setext heading
    // only when the line above is one of the required section titles. Equals signs
    // are Setext-only.
    if ((mark === "=" || namesASection) && [...underline].every((character) => character === mark)) {
      return { rawTitle: title, inline: "", skipNext: true }
    }
  }

  return null
}

/**
 * A plain label line, matching bodies that name the section without a `#`.
 * @param {string} line
 * @returns {{ rawTitle: string, inline: string, skipNext: boolean } | null}
 */
function labelFromLine(line) {
  const trimmed = line.trim()
  if (!trimmed || trimmed.startsWith("#")) return null
  const unwrapped = trimmed.replace(/^(\*\*|__)|(\*\*|__)$/g, "").trim()
  const recognized = REQUIRED.some((required) => headingMatches(unwrapped, required.title))
  if (!recognized) return null
  return { rawTitle: unwrapped, inline: "", skipNext: false }
}

/**
 * @param {string} rawTitle
 * @param {string} required
 * @returns {boolean}
 */
function headingMatches(rawTitle, required) {
  const cleaned = rawTitle
    .replace(/^(\*\*|__|\*|_)|(\*\*|__|\*|_)$/g, "")
    .replace(/\s+/g, " ")
    .trim()
  const lower = cleaned.toLowerCase()
  const name = required.toLowerCase()
  if (lower === name || lower.replace(/[:.]+$/, "") === name) return true
  return [":", " —", " –", " -"].some((separator) => lower.startsWith(`${name}${separator}`))
}

/**
 * @param {{ rawTitle: string, inline: string, lines: string[] }} section
 */
function sectionText(section) {
  const inline = inlineRemainder(section.rawTitle)
  const body = section.lines.join("\n").replace(/<!--[\s\S]*?-->/g, "")
  return `${inline}\n${body}`.trim()
}

/** @param {string} rawTitle */
function inlineRemainder(rawTitle) {
  const cleaned = rawTitle
    .replace(/^(\*\*|__|\*|_)|(\*\*|__|\*|_)$/g, "")
    .replace(/\s+/g, " ")
    .trim()
  const lower = cleaned.toLowerCase()
  const name = "customer experience"
  for (const separator of [":", " —", " –", " -"]) {
    const prefix = `${name}${separator}`
    if (lower.startsWith(prefix)) return cleaned.slice(prefix.length).trim()
  }
  return ""
}

const entry = process.argv[1] ? pathToFileURL(path.resolve(process.argv[1])).href : ""

if (import.meta.url === entry) {
  const errors = checkPullRequestBody(process.env.BODY ?? "")
  if (errors.length > 0) {
    process.stderr.write(`${errors.join("\n\n")}\n`)
    process.exit(1)
  }
}

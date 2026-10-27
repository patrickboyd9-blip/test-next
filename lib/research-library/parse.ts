import { isForbiddenResearchPath } from "@/lib/design-intelligence/images"

import { normalizeIndustry, researchEmotion, researchOfferType } from "./industry"
import type { CoverageRow, ResearchEntry, ResearchLayout, ResearchOrigin } from "./types"

export interface SourceFile {
  path: string
  ref: "mando" | "c3po"
  sha?: string
  text?: string
  json?: unknown
  /** Set when the file was not fetched. */
  error?: string
}

const SECTION = /^(?:#{1,6}\s*)?(?:\*\*)?(OBSERVED|INFERRED|INTERPRETATION)(?:\*\*)?\b[^\n]*$/gim
const ID_IN_TEXT = /\b((?:MMR|PM|GOLD|SYNTH)-[A-Za-z0-9-]+)\b/
const SAFE_ID = /^[A-Za-z0-9_-]{1,80}$/

export function indexSourceFiles(files: readonly SourceFile[]): { entries: ResearchEntry[]; coverage: CoverageRow[] } {
  const coverage: CoverageRow[] = []
  const entries: ResearchEntry[] = []
  const privatePaths: string[] = []
  let imageCatalog: unknown = null
  let imageCatalogPath: string | undefined

  for (const file of files) {
    if (isForbiddenResearchPath(file.path) || file.path.split("/").some((part) => part.toLowerCase() === "private")) {
      privatePaths.push(file.path)
      continue
    }
    if (isImageCatalog(file.path)) {
      imageCatalog = file.json ?? tryJson(file.text)
      imageCatalogPath = file.path
      continue
    }
    const parsed = parseSourceFile(file)
    coverage.push(...parsed.rows)
    entries.push(...parsed.entries)
  }

  if (privatePaths.length > 0) {
    coverage.push({
      path: "private/",
      status: "skipped",
      kind: "private",
      reason: `${privatePaths.length} path(s) under a private folder were not read.`,
    })
  }

  if (imageCatalogPath) {
    const attached = attachImageCatalog(entries, imageCatalog, imageCatalogPath)
    coverage.push({
      path: imageCatalogPath,
      status: "indexed",
      kind: "catalog",
      reason: attached.created > 0
        ? `Image catalog merged onto records. ${attached.created} image-only mailer(s) added. ${attached.skippedPrivate} private image path(s) ignored.`
        : `Image catalog merged onto records. ${attached.skippedPrivate} private image path(s) ignored.`,
    })
    entries.push(...attached.createdEntries)
  }

  const merged = mergeEntries(entries)
  for (const row of coverage) {
    if (row.status === "indexed" && row.id && !merged.some((entry) => entry.id === row.id)) {
      row.reason = row.reason ? `${row.reason} Merged into another record with the same id.` : "Merged into another record with the same id."
    }
  }
  return { entries: merged, coverage }
}

export function parseSourceFile(file: SourceFile): { entries: ResearchEntry[]; rows: CoverageRow[] } {
  if (file.error) {
    return {
      entries: [],
      rows: [{
        path: file.path,
        status: "skipped",
        kind: looksLikeMailerPath(file.path) ? "mailer" : "other",
        reason: `Unreadable: ${file.error}`,
      }],
    }
  }
  if (file.path.endsWith(".json") || file.json !== undefined) {
    return parseJsonFile(file)
  }
  const parsed = parseMarkdownFile(file)
  return { entries: parsed.entry ? [parsed.entry] : [], rows: [parsed.row] }
}

function parseMarkdownFile(file: SourceFile): { entry?: ResearchEntry; row: CoverageRow } {
  const text = file.text ?? ""
  if (!text.trim()) {
    return {
      row: {
        path: file.path,
        status: "skipped",
        kind: looksLikeMailerPath(file.path) ? "mailer" : "other",
        reason: "Empty file.",
      },
    }
  }
  const sections = splitSections(text)
  const id = idFrom(file.path, text)
  const mailer = Boolean(id) || Boolean(sections.observed || sections.inferred || sections.interpretation) || isSynthesisPath(file.path)
  if (!mailer || isIgnorableDoc(file.path)) {
    return {
      row: {
        path: file.path,
        status: "skipped",
        kind: "other",
        reason: "Not a mailer record: no source id and no OBSERVED, INFERRED, or INTERPRETATION section.",
      },
    }
  }
  if (!id || !SAFE_ID.test(id)) {
    return {
      row: {
        path: file.path,
        status: "skipped",
        kind: "mailer",
        reason: "Mailer-shaped file has no safe source id.",
      },
    }
  }
  const fields = readFields(`${sections.observed}\n${sections.inferred}\n${sections.interpretation}\n${text.slice(0, 1500)}`)
  const industry = normalizeIndustry(fields.industry || industryFromPath(file.path))
  const headlines = unique(fields.headlines)
  const offers = unique(fields.offers)
  const photoStyle = fields.photoStyle
  const imageRefs = unique([...fields.images, ...markdownImages(text)]).filter((item) => !isForbiddenResearchPath(item))
  const layout = layoutFrom(fields, text)
  const favorite = favoriteFrom(text, fields.favoriteOf, fields.favoriteSimilarity)
  const why = firstSentence(fields.why || sections.interpretation)
  const response = meaningfulResponse(fields.response)
  const origin = originFor(file, id)
  const entry: ResearchEntry = {
    id,
    origin,
    sourcePath: file.path,
    ref: file.ref,
    sha: file.sha,
    industry,
    offerType: researchOfferType([fields.offer, ...offers, text.slice(0, 400)].join(" ")),
    emotion: fields.emotion ? researchEmotion(fields.emotion) : researchEmotion(text.slice(0, 800)),
    format: fields.format || layout.size || "postcard",
    layout,
    photoStyle,
    colors: fields.colors,
    headlines,
    offers,
    structures: structureLines(sections, layout),
    responseEvidence: response,
    whyItWorks: why,
    favoriteSimilarity: favorite.score,
    favoriteOf: favorite.of,
    imageRefs,
    evidence: imageRefs.length > 0 ? "visual" : "text",
    gold: false,
    searchText: clip(scrub([industry, headlines.join(" "), offers.join(" "), photoStyle, why, fields.offer].filter(Boolean).join(" ")), 500),
  }
  return {
    entry,
    row: { path: file.path, id, status: "indexed", kind: "mailer" },
  }
}

function parseJsonFile(file: SourceFile): { entries: ResearchEntry[]; rows: CoverageRow[] } {
  const value = file.json ?? tryJson(file.text)
  if (value === null || value === undefined) {
    return {
      entries: [],
      rows: [{
        path: file.path,
        status: "skipped",
        kind: looksLikeMailerPath(file.path) ? "mailer" : "other",
        reason: file.text?.trim() ? "JSON could not be parsed." : "Empty file.",
      }],
    }
  }
  const records = goldRecords(value)
  if (records.length === 0) {
    return {
      entries: [],
      rows: [{
        path: file.path,
        status: "skipped",
        kind: isGoldPath(file.path) ? "catalog" : "other",
        reason: isGoldPath(file.path)
          ? "Catalog manifest. The mailers it names are indexed from their own gold files."
          : "JSON file is not a mailer record.",
      }],
    }
  }
  const entries: ResearchEntry[] = []
  const skipped: string[] = []
  for (const record of records) {
    const entry = entryFromGold(record, file)
    if (entry) entries.push(entry)
    else skipped.push("one object had no safe source id")
  }
  if (entries.length === 0) {
    return {
      entries: [],
      rows: [{ path: file.path, status: "skipped", kind: "mailer", reason: "Gold JSON has no safe source id." }],
    }
  }
  const rows: CoverageRow[] = entries.map((entry) => ({
    path: records.length === 1 ? file.path : `${file.path}#${entry.id}`,
    id: entry.id,
    status: "indexed",
    kind: "mailer",
    reason: records.length > 1 ? `Indexed from a multi-record file at ${file.path}.` : undefined,
  }))
  if (skipped.length > 0) {
    rows.push({
      path: file.path,
      status: "skipped",
      kind: "mailer",
      reason: `${skipped.length} object(s) in ${file.path} had no safe source id.`,
    })
  }
  return { entries, rows }
}

export function entryFromGold(record: Record<string, unknown>, file: Pick<SourceFile, "path" | "ref" | "sha">): ResearchEntry | null {
  const id = stringField(record, ["id", "gold_id", "goldId", "mmr_id", "mmrId"]) || idFrom(file.path, "")
  if (!id || !SAFE_ID.test(id)) return null
  const industry = normalizeIndustry(
    stringField(record, ["industry", "vertical", "slug"]) || industryFromPath(file.path)
  )
  const headline = objectField(record, ["headline"])
  const offer = objectField(record, ["offer"])
  const headlineText = stringField(headline, ["text", "line"]) || stringField(record, ["headlineText", "headline_text"])
  const offerText = stringField(offer, ["text", "line"]) || stringField(record, ["offerText", "offer_text"])
  const headlineWords = numberField(headline, ["wordCount", "words"]) ?? numberField(record, ["headlineWordCount", "headline_word_count", "headlineWords"])
  const headlineSize = stringField(headline, ["size"]) || stringField(record, ["headlineSize", "headline_size"])
  const photoShare = photoShareField(record, headline)
  const offerPosition = stringField(offer, ["position"]) || stringField(record, ["offerPosition", "offer_position"])
  const offerSize = stringField(offer, ["size"]) || stringField(record, ["offerSize", "offer_size"])
  const colors = colorList(record.colors ?? record.palette ?? record.color)
  const photoStyle = stringField(record, ["photoStyle", "photo_style", "photo", "subject"])
  const images = stringList(record.images ?? record.image ?? record.imageRefs).filter((item) => !isForbiddenResearchPath(item))
  const similarity = similarityField(record)
  const why = stringField(record, ["whyItWorks", "why_it_works", "why", "summary"])
  const response = responseField(record)
  const layout: ResearchLayout = {
    size: stringField(record, ["size", "format", "trim"]),
    photoShare,
    headlineWords: headlineWords ?? (headlineText ? wordCount(headlineText) : undefined),
    headlineSize,
    offerPosition,
    offerSize,
    whitespace: stringField(record, ["whitespace", "whiteSpace", "white_space"]),
    phonePlacement: stringField(record, ["phone", "phonePlacement", "phone_placement"]),
    qrPlacement: stringField(record, ["qr", "qrPlacement", "qr_placement"]),
  }
  const gold = id.startsWith("GOLD-") || isGoldPath(file.path)
  return {
    id,
    origin: gold ? "gold" : id.startsWith("PM-") || file.ref === "c3po" ? "c3po" : "mmr",
    sourcePath: file.path,
    ref: file.ref,
    sha: file.sha,
    industry,
    offerType: researchOfferType([offerText, offerPosition, stringField(record, ["offerType", "offer_type"])].filter(Boolean).join(" ")),
    emotion: researchEmotion(stringField(record, ["emotion", "tone"]) || why || ""),
    format: layout.size || "postcard",
    layout,
    photoStyle,
    colors,
    headlines: headlineText ? [clip(headlineText, 120)] : [],
    offers: offerText ? [clip(offerText, 120)] : [],
    structures: structureFromLayout(layout),
    responseEvidence: response,
    whyItWorks: why ? clip(why, 280) : undefined,
    favoriteSimilarity: similarity.score,
    favoriteOf: similarity.of,
    imageRefs: images,
    evidence: images.length > 0 ? "visual" : "text",
    gold,
    searchText: clip([industry, headlineText, offerText, photoStyle, why].filter(Boolean).join(" "), 500),
  }
}

function attachImageCatalog(entries: ResearchEntry[], catalog: unknown, catalogPath = "images/index.json"): {
  created: number
  skippedPrivate: number
  createdEntries: ResearchEntry[]
} {
  const rows = catalogRows(catalog)
  const createdEntries: ResearchEntry[] = []
  let skippedPrivate = 0
  for (const row of rows) {
    if (isForbiddenResearchPath(row.path)) {
      skippedPrivate += 1
      continue
    }
    const existing = entries.find((entry) => entry.id === row.id) ?? createdEntries.find((entry) => entry.id === row.id)
    if (existing) {
      if (!existing.imageRefs.includes(row.path)) existing.imageRefs.push(row.path)
      existing.evidence = "visual"
      if (existing.industry === "unknown" && row.industry) existing.industry = normalizeIndustry(row.industry)
      continue
    }
    if (!SAFE_ID.test(row.id)) continue
    createdEntries.push({
      id: row.id,
      origin: row.id.startsWith("PM-") ? "c3po" : "mmr",
      sourcePath: catalogPath,
      ref: "mando",
      industry: normalizeIndustry(row.industry),
      offerType: "other",
      emotion: "unspecified",
      format: "postcard",
      layout: {},
      colors: [],
      headlines: [],
      offers: [],
      structures: ["Image-backed mailer. The written record was not in this batch."],
      imageRefs: [row.path],
      evidence: "visual",
      gold: false,
      searchText: normalizeIndustry(row.industry),
    })
  }
  return { created: createdEntries.length, skippedPrivate, createdEntries }
}

function mergeEntries(entries: ResearchEntry[]): ResearchEntry[] {
  const byId = new Map<string, ResearchEntry>()
  for (const entry of entries) {
    const current = byId.get(entry.id)
    if (!current) {
      byId.set(entry.id, entry)
      continue
    }
    byId.set(entry.id, richer(current, entry))
  }
  return [...byId.values()].sort((a, b) => a.id.localeCompare(b.id))
}

function richer(left: ResearchEntry, right: ResearchEntry): ResearchEntry {
  const preferred = scoreEntry(right) > scoreEntry(left) ? right : left
  const other = preferred === left ? right : left
  return {
    ...preferred,
    imageRefs: unique([...preferred.imageRefs, ...other.imageRefs]),
    colors: preferred.colors.length > 0 ? preferred.colors : other.colors,
    headlines: preferred.headlines.length > 0 ? preferred.headlines : other.headlines,
    offers: preferred.offers.length > 0 ? preferred.offers : other.offers,
    photoStyle: preferred.photoStyle || other.photoStyle,
    responseEvidence: preferred.responseEvidence || other.responseEvidence,
    whyItWorks: preferred.whyItWorks || other.whyItWorks,
    favoriteSimilarity: preferred.favoriteSimilarity ?? other.favoriteSimilarity,
    favoriteOf: preferred.favoriteOf || other.favoriteOf,
    evidence: preferred.imageRefs.length + other.imageRefs.length > 0 ? "visual" : preferred.evidence,
    gold: preferred.gold || other.gold,
    layout: {
      ...other.layout,
      ...stripEmpty(preferred.layout),
    },
  }
}

function scoreEntry(entry: ResearchEntry): number {
  let score = 0
  if (entry.gold) score += 8
  if (entry.evidence === "visual") score += 4
  if (entry.whyItWorks) score += 2
  if (entry.layout.photoShare !== undefined) score += 2
  if (entry.headlines.length) score += 1
  return score
}

function stripEmpty(layout: ResearchLayout): ResearchLayout {
  const next: ResearchLayout = {}
  for (const [key, value] of Object.entries(layout)) {
    if (value !== undefined && value !== "") (next as Record<string, unknown>)[key] = value
  }
  return next
}

function goldRecords(value: unknown): Record<string, unknown>[] {
  if (Array.isArray(value)) {
    return value.filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object" && !Array.isArray(item) && hasGoldIdentity(item as Record<string, unknown>))
  }
  if (!value || typeof value !== "object") return []
  const record = value as Record<string, unknown>
  if (hasGoldIdentity(record)) return [record]
  for (const key of ["records", "items", "mailers", "gold", "entries"]) {
    const nested = record[key]
    if (Array.isArray(nested)) {
      const rows = nested.filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object")
      if (rows.some(hasGoldIdentity)) return rows.filter(hasGoldIdentity)
    }
  }
  return []
}

function hasGoldIdentity(record: Record<string, unknown>): boolean {
  return Boolean(stringField(record, ["id", "gold_id", "goldId", "mmr_id", "mmrId"]))
}

function catalogRows(catalog: unknown): { id: string; path: string; industry?: string }[] {
  const rows = Array.isArray(catalog)
    ? catalog
    : catalog && typeof catalog === "object"
      ? arrayField(catalog as Record<string, unknown>, ["images", "records", "items"])
      : []
  const found: { id: string; path: string; industry?: string }[] = []
  for (const row of rows) {
    if (!row || typeof row !== "object") continue
    const record = row as Record<string, unknown>
    const id = stringField(record, ["mmr_id", "mmrId", "id", "pmId", "name"])
    const path = stringField(record, ["path", "image", "src", "front"])
    if (!id || !path) continue
    found.push({ id, path, industry: stringField(record, ["vertical", "industry"]) })
  }
  return found
}

interface FieldBag {
  industry?: string
  offer?: string
  emotion?: string
  format?: string
  photoStyle?: string
  why?: string
  response?: string
  favoriteOf?: string
  favoriteSimilarity?: number
  headlines: string[]
  offers: string[]
  colors: string[]
  images: string[]
  layoutText?: string
  phone?: string
  qr?: string
  whitespace?: string
  size?: string
}

function readFields(text: string): FieldBag {
  const bag: FieldBag = { headlines: [], offers: [], colors: [], images: [] }
  const lines = text.split(/\n+/)
  for (const raw of lines) {
    const line = raw.replace(/^[-*]\s*/, "").trim()
    const match = /^([A-Za-z][A-Za-z /_-]{0,40})\s*[:—–-]\s*(.+)$/.exec(line)
    if (!match) continue
    const key = match[1]!.toLowerCase().replace(/\s+/g, " ").trim()
    const value = match[2]!.trim()
    if (/^industr|^vertical|^trade/.test(key)) bag.industry = value
    else if (key === "offer" || key === "offer type") bag.offer = value
    else if (key === "emotion" || key === "tone") bag.emotion = value
    else if (key === "format" || key === "piece") bag.format = value
    else if (key === "size" || key === "trim") bag.size = value
    else if (/photo style|photo|imagery|subject/.test(key)) bag.photoStyle = value
    else if (/headline/.test(key)) bag.headlines.push(cleanQuote(value))
    else if (key === "colors" || key === "color" || key === "palette") bag.colors.push(...splitColors(value))
    else if (/why/.test(key)) bag.why = value
    else if (/response|reply|result/.test(key)) bag.response = value
    else if (/similar|favorite/.test(key)) {
      bag.favoriteOf = bag.favoriteOf || favoriteId(value)
      bag.favoriteSimilarity = bag.favoriteSimilarity ?? favoriteScore(value)
    }
    else if (/^image|^scan|^front/.test(key)) bag.images.push(value.split(/\s+/)[0]!)
    else if (/layout|composition/.test(key)) bag.layoutText = value
    else if (key === "phone") bag.phone = value
    else if (key === "qr") bag.qr = value
    else if (/white/.test(key)) bag.whitespace = value
  }
  if (bag.colors.length === 0) bag.colors.push(...hexes(text))
  return bag
}

function layoutFrom(fields: FieldBag, text: string): ResearchLayout {
  const blob = `${fields.layoutText ?? ""} ${fields.photoStyle ?? ""} ${text.slice(0, 1200)}`
  return {
    size: fields.size || sizeFrom(fields.format || blob),
    photoShare: photoShareFromText(blob),
    headlineWords: fields.headlines[0] ? wordCount(fields.headlines[0]) : undefined,
    offerPosition: offerPositionFrom(fields.layoutText || blob),
    offerSize: /largest|dominant|biggest|hero/.test((fields.layoutText || "").toLowerCase()) ? "dominant" : undefined,
    whitespace: fields.whitespace,
    phonePlacement: fields.phone,
    qrPlacement: fields.qr,
  }
}

function structureLines(sections: { observed: string; inferred: string; interpretation: string }, layout: ResearchLayout): string[] {
  const lines: string[] = []
  if (layout.photoShare !== undefined) lines.push(`Photograph covers about ${Math.round(layout.photoShare * 100)}% of the card.`)
  if (layout.offerPosition) lines.push(`Offer sits ${layout.offerPosition}.`)
  const inferred = firstSentence(sections.inferred)
  if (inferred) lines.push(inferred)
  return lines.slice(0, 4)
}

function structureFromLayout(layout: ResearchLayout): string[] {
  const lines: string[] = []
  if (layout.photoShare !== undefined) lines.push(`Photograph covers about ${Math.round(layout.photoShare * 100)}% of the card.`)
  if (layout.offerPosition) lines.push(`Offer sits ${layout.offerPosition}.`)
  if (layout.offerSize) lines.push(`Offer size is ${layout.offerSize}.`)
  if (layout.whitespace) lines.push(`Whitespace: ${layout.whitespace}.`)
  if (layout.headlineWords) lines.push(`Headline is about ${layout.headlineWords} words.`)
  return lines
}

function splitSections(text: string): { observed: string; inferred: string; interpretation: string } {
  const marks: { name: string; index: number }[] = []
  for (const match of text.matchAll(SECTION)) {
    if (match.index === undefined) continue
    marks.push({ name: match[1]!.toLowerCase(), index: match.index + match[0].length })
  }
  const slice = (name: string) => {
    const start = marks.find((mark) => mark.name === name)
    if (!start) return ""
    const next = marks.find((mark) => mark.index > start.index)
    return text.slice(start.index, next?.index ?? text.length)
  }
  return {
    observed: slice("observed"),
    inferred: slice("inferred"),
    interpretation: slice("interpretation"),
  }
}

function idFrom(filePath: string, text: string): string | undefined {
  const file = filePath.split("/").pop() ?? filePath
  const inFile = file.match(ID_IN_TEXT)?.[1]
  if (inFile) return inFile.toUpperCase().startsWith("GOLD-") ? inFile : inFile.toUpperCase()
  const inText = text.match(ID_IN_TEXT)?.[1]
  if (inText) return inText.toUpperCase().startsWith("GOLD-") ? inText : inText.toUpperCase()
  if (isSynthesisPath(filePath)) {
    const slug = file.replace(/\.md$/i, "").replace(/^\d{4}-\d{2}-\d{2}-/, "").replace(/[^A-Za-z0-9]+/g, "-").replace(/^-|-$/g, "")
    return slug ? `SYNTH-${slug}`.slice(0, 80) : undefined
  }
  const goldSlug = filePath.match(/(?:^|\/)gold\/([A-Za-z0-9_-]+)\.json$/i)?.[1]
  if (goldSlug) return `GOLD-${goldSlug}-001`.slice(0, 80)
  const pm = filePath.match(/\/(PM-\d+)\//i)?.[1]
  if (pm) return pm.toUpperCase()
  return undefined
}

function originFor(file: SourceFile, id: string): ResearchOrigin {
  if (id.startsWith("SYNTH-") || isSynthesisPath(file.path)) return "synthesis"
  if (file.ref === "c3po" || id.startsWith("PM-")) return "c3po"
  if (id.startsWith("GOLD-")) return "gold"
  return "mmr"
}

function looksLikeMailerPath(filePath: string): boolean {
  return /MMR-|PM-\d|GOLD-|syntheses\/|\/gold\/|examples\//i.test(filePath)
}

function isSynthesisPath(filePath: string): boolean {
  return /(^|\/)syntheses\//i.test(filePath)
}

function isGoldPath(filePath: string): boolean {
  return /(^|\/)(gold|indexes\/gold)\//i.test(filePath) || /gold\/.+\.json$/i.test(filePath)
}

function isImageCatalog(filePath: string): boolean {
  return /(^|\/)images\/index\.json$/i.test(filePath)
}

function isIgnorableDoc(filePath: string): boolean {
  const name = (filePath.split("/").pop() ?? "").toLowerCase()
  return /^(readme|license|contributing|changelog)(\.|$)/.test(name)
}

function industryFromPath(filePath: string): string | undefined {
  const blob = filePath.replace(/[_./-]+/g, " ")
  const industry = normalizeIndustry(blob)
  return industry === "unknown" ? undefined : industry
}

function photoShareField(record: Record<string, unknown>, headline: Record<string, unknown>): number | undefined {
  const direct = record.photoShare ?? record.photo_share ?? record.photoPercent ?? headline.photoShare
  return coerceShare(direct)
}

function coerceShare(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value > 1 ? clamp01(value / 100) : clamp01(value)
  }
  if (typeof value === "string") {
    const fromText = photoShareFromText(value)
    if (fromText !== undefined) return fromText
    const percent = value.match(/(\d{1,3})\s*%/)
    if (percent) return clamp01(Number(percent[1]) / 100)
    const asNumber = Number(value)
    if (Number.isFinite(asNumber)) return asNumber > 1 ? clamp01(asNumber / 100) : clamp01(asNumber)
  }
  return undefined
}

export function photoShareFromText(text: string): number | undefined {
  const labeled = text.match(/photo(?:graph)?(?:\s+\w+){0,3}\s*(?:about\s*)?(\d{1,3})\s*%/i)
  if (labeled) return clamp01(Number(labeled[1]) / 100)
  const share = text.match(/(\d{1,3})\s*%\s*(?:of the (?:card|front|piece)|photo)/i)
  if (share) return clamp01(Number(share[1]) / 100)
  const decimal = text.match(/\b(0?\.\d+|1(?:\.0+)?)\b/)
  if (decimal && /photo|share/.test(text.toLowerCase())) return clamp01(Number(decimal[1]))
  if (/full[- ]bleed|fills the card|most of the card/.test(text)) return 0.7
  if (/half|split/.test(text) && /photo/.test(text)) return 0.5
  return undefined
}

function offerPositionFrom(text: string): string | undefined {
  if (/bottom band|lower band|full-width|footer band|offer strip/.test(text.toLowerCase())) return "bottom band"
  if (/top/.test(text.toLowerCase()) && /offer/.test(text.toLowerCase())) return "top"
  if (/beside|right|left/.test(text.toLowerCase()) && /offer/.test(text.toLowerCase())) return "beside the photograph"
  return undefined
}

function favoriteFrom(text: string, of: string | undefined, score: number | undefined): { of?: string; score?: number } {
  return {
    of: of || favoriteId(text),
    score: score ?? favoriteScore(text),
  }
}

function favoriteId(text: string): string | undefined {
  if (/wondercide/i.test(text)) return "PM-056"
  return text.match(/\bPM-\d{2,4}\b/i)?.[0]?.toUpperCase()
}

function favoriteScore(text: string): number | undefined {
  const labeled = text.match(/(?:similarity|similar|score)\D{0,12}([1-5])\b/i)
  if (labeled) return Number(labeled[1])
  return undefined
}

function similarityField(record: Record<string, unknown>): { of?: string; score?: number } {
  const directScore = numberField(record, ["favoriteSimilarity", "favorite_similarity", "similarityScore"])
  const directOf = stringField(record, ["favoriteOf", "favorite_of", "favorite"])
  const list = record.similarity ?? record.similarTo ?? record.favorites
  if (Array.isArray(list)) {
    let bestOf = directOf
    let bestScore = directScore
    for (const item of list) {
      if (!item || typeof item !== "object") continue
      const row = item as Record<string, unknown>
      const id = stringField(row, ["id", "mailer", "favorite"])
      const score = numberField(row, ["score", "similarity", "value"])
      if (score !== undefined && (bestScore === undefined || score > bestScore)) {
        bestScore = score
        bestOf = id || bestOf
      } else if (!bestOf && id) bestOf = id
    }
    return { of: bestOf ? favoriteId(bestOf) || bestOf : undefined, score: clampFavorite(bestScore) }
  }
  return { of: directOf ? favoriteId(directOf) || directOf : undefined, score: clampFavorite(directScore) }
}

function responseField(record: Record<string, unknown>): string | undefined {
  const value = record.response ?? record.responseData ?? record.response_data ?? record.results
  if (typeof value === "string" && value.trim()) return meaningfulResponse(clip(value.trim(), 280))
  if (value && typeof value === "object") {
    const note = stringField(value as Record<string, unknown>, ["note", "summary", "text", "finding"])
    if (note) return meaningfulResponse(clip(note, 280))
  }
  return undefined
}

function meaningfulResponse(value: string | undefined): string | undefined {
  const trimmed = value?.replace(/\s+/g, " ").trim()
  if (!trimmed) return undefined
  if (/\bno measured\b|\bnot measured\b|\bno response (rate|data|noted)\b|\bno data\b|\bnone recorded\b|\bno rate\b/i.test(trimmed)) return undefined
  return trimmed
}

function colorList(value: unknown): string[] {
  if (typeof value === "string") return splitColors(value)
  if (!Array.isArray(value)) return []
  return unique(value.flatMap((item) => (typeof item === "string" ? splitColors(item) : [])))
}

function splitColors(value: string): string[] {
  return value.split(/[,/]| and /i).map((item) => item.trim()).filter((item) => item.length > 0 && item.length < 32)
}

function hexes(text: string): string[] {
  return unique(text.match(/#[0-9A-Fa-f]{3,8}/g) ?? [])
}

function markdownImages(text: string): string[] {
  const found: string[] = []
  for (const match of text.matchAll(/!\[[^\]]*]\(([^)\s]+)\)/g)) {
    const path = match[1]
    if (path && !path.startsWith("http")) found.push(path)
  }
  return found
}

function stringList(value: unknown): string[] {
  if (typeof value === "string" && value.trim()) return [value.trim()]
  if (!Array.isArray(value)) return []
  return value.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
}

function arrayField(record: Record<string, unknown>, keys: string[]): unknown[] {
  for (const key of keys) {
    const value = record[key]
    if (Array.isArray(value)) return value
  }
  return []
}

function objectField(record: Record<string, unknown>, keys: string[]): Record<string, unknown> {
  for (const key of keys) {
    const value = record[key]
    if (value && typeof value === "object" && !Array.isArray(value)) return value as Record<string, unknown>
  }
  return {}
}

function stringField(record: Record<string, unknown>, keys: string[]): string | undefined {
  for (const key of keys) {
    const value = record[key]
    if (typeof value === "string" && value.trim()) return value.trim()
  }
  return undefined
}

function numberField(record: Record<string, unknown>, keys: string[]): number | undefined {
  for (const key of keys) {
    const value = record[key]
    if (typeof value === "number" && Number.isFinite(value)) return value
    if (typeof value === "string" && value.trim() && Number.isFinite(Number(value))) return Number(value)
  }
  return undefined
}

function tryJson(text: string | undefined): unknown {
  if (!text?.trim()) return undefined
  try {
    return JSON.parse(text) as unknown
  } catch {
    return null
  }
}

function sizeFrom(text: string | undefined): string | undefined {
  return text?.match(/\b\d\s?[×x]\s?\d{1,2}\b/)?.[0]?.replace(/\s/g, "")
}

function wordCount(value: string): number {
  return value.replace(/["“”]/g, "").split(/\s+/).filter(Boolean).length
}

function cleanQuote(value: string): string {
  return clip(value.replace(/^["“]|["”]$/g, "").trim(), 140)
}

function firstSentence(value: string | undefined): string | undefined {
  const trimmed = value?.replace(/\s+/g, " ").trim()
  if (!trimmed) return undefined
  const sentence = trimmed.split(/(?<=[.!])\s/)[0] ?? trimmed
  return clip(sentence, 280)
}

function unique(values: string[]): string[] {
  const seen = new Set<string>()
  const next: string[] = []
  for (const value of values) {
    const trimmed = value.trim()
    if (!trimmed || seen.has(trimmed)) continue
    seen.add(trimmed)
    next.push(trimmed)
  }
  return next
}

function clip(value: string, max: number): string {
  const trimmed = value.replace(/\s+/g, " ").trim()
  return trimmed.length <= max ? trimmed : `${trimmed.slice(0, max - 1).trim()}…`
}

function scrub(value: string): string {
  return value.replace(/\b\d{3}[-.\s]?\d{3}[-.\s]?\d{4}\b/g, "").replace(/https?:\/\/\S+/gi, "").replace(/\s+/g, " ").trim()
}

function clamp01(value: number): number | undefined {
  if (!Number.isFinite(value)) return undefined
  return Math.max(0, Math.min(1, value))
}

function clampFavorite(value: number | undefined): number | undefined {
  if (value === undefined || !Number.isFinite(value)) return undefined
  return Math.max(1, Math.min(5, Math.round(value)))
}

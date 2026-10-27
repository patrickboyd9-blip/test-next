/**
 * Normalized mailer research. Built at runtime from the private repo.
 * This module stores paths and short readings, never image bytes.
 */

export type ResearchOrigin = "mmr" | "gold" | "c3po" | "synthesis"

export type EvidenceKind = "visual" | "text"

export interface ResearchLayout {
  size?: string
  photoShare?: number
  headlineWords?: number
  headlineSize?: string
  offerPosition?: string
  offerSize?: string
  whitespace?: string
  phonePlacement?: string
  qrPlacement?: string
}

export interface ResearchEntry {
  id: string
  origin: ResearchOrigin
  /** Repo path the reading came from. Not a customer-facing label. */
  sourcePath: string
  ref: "mando" | "c3po"
  sha?: string
  industry: string
  offerType: string
  emotion: string
  format: string
  layout: ResearchLayout
  photoStyle?: string
  colors: string[]
  /** Observed lines used as strategy evidence. Not copied onto a card. */
  headlines: string[]
  offers: string[]
  structures: string[]
  responseEvidence?: string
  whyItWorks?: string
  /** 1–5 likeness to an owner favorite, when the source states one. */
  favoriteSimilarity?: number
  favoriteOf?: string
  /** Repo-relative image paths. Bytes stay in the private repo. */
  imageRefs: string[]
  evidence: EvidenceKind
  gold: boolean
  /** Short searchable text. Not the raw markdown. */
  searchText: string
  /** Tagger fingerprint that produced this row. Absent on an index built before versioning. */
  taggerVersion?: string
}

export interface CoverageRow {
  path: string
  id?: string
  status: "indexed" | "skipped"
  reason?: string
  kind: "mailer" | "catalog" | "private" | "library" | "other"
  /** Set when this path was parsed under the current tagger. */
  taggerVersion?: string
}

export interface ResearchIndex {
  version: 1
  /** Fingerprint of the tagger and the master list. A mismatch rebuilds every file. */
  taggerVersion: string
  builtAt: string
  entries: ResearchEntry[]
  coverage: CoverageRow[]
  pending: PendingFile[]
  stats: CoverageStats
}

export interface PendingFile {
  ref: "mando" | "c3po"
  path: string
  sha?: string
  /** Present for a corpus folder synthesized from image paths. Not image bytes. */
  json?: unknown
}

export interface CoverageStats {
  discovered: number
  indexed: number
  skipped: number
  usable: number
  visual: number
  textOnly: number
  gold: number
  pending: number
}

export interface RetrievalQuery {
  industry: string
  offerType: string
  audience: string
  direction: string
  emotion: string
}

export interface RetrievalHit {
  entry: ResearchEntry
  score: number
  /** same industry, an adjacent industry, or a broader fallback. */
  band: "same" | "adjacent" | "broader"
}

export interface RetrievalResult {
  hits: RetrievalHit[]
  fallback: "none" | "filled" | "adjacent" | "broader"
}

export interface LayoutTune {
  photoShare?: number
  offerProminent: boolean
  colors: string[]
  templateBias?: string
  headlineWords?: number
  photoStyle?: string
  sourceId: string
}

export interface GoldExpectation {
  id: string
  photoShare?: number
  offerProminent: boolean
  colors: string[]
}

import { parseCsv, type Recipient } from "@/lib/click2mail/recipients"

import { exactAddressKey } from "./dedupe"
import { rowMessages, validateAddress } from "./validate"

export interface ColumnMapping {
  first: number | null
  last: number | null
  fullName: number | null
  organization: number | null
  address1: number | null
  address2: number | null
  city: number | null
  state: number | null
  zip: number | null
}

export interface CsvPreview {
  headers: string[]
  mapping: ColumnMapping
  /** First data rows, still in file order, for the mapping screen. */
  sample: { row: number; cells: string[] }[]
  dataRows: number
  error: string | null
}

export interface CsvDuplicate {
  row: number
  matches: "list" | "file"
  matchesRow?: number
}

export interface CsvImportResult {
  headerError: string | null
  accepted: Recipient[]
  invalid: { row: number; messages: string[] }[]
  duplicates: CsvDuplicate[]
}

const ALIASES: Record<keyof ColumnMapping, string[]> = {
  first: ["first", "first name", "firstname", "given name", "fname"],
  last: ["last", "last name", "lastname", "surname", "lname"],
  fullName: ["name", "full name", "fullname", "customer", "recipient", "contact"],
  organization: ["organization", "organisation", "company", "business", "company name"],
  address1: ["address1", "address 1", "address line 1", "street", "street address", "address", "addr"],
  address2: ["address2", "address 2", "address line 2", "apt", "apartment", "unit", "suite"],
  city: ["city", "town"],
  state: ["state", "st"],
  zip: ["zip", "zip code", "zipcode", "postal", "postal code", "postalcode", "zip+4", "zip 4"],
}

const GUESS_ORDER: (keyof ColumnMapping)[] = [
  "zip",
  "state",
  "city",
  "address2",
  "address1",
  "organization",
  "last",
  "first",
  "fullName",
]

export function emptyMapping(): ColumnMapping {
  return {
    first: null,
    last: null,
    fullName: null,
    organization: null,
    address1: null,
    address2: null,
    city: null,
    state: null,
    zip: null,
  }
}

export function headerKey(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[_./#]+/g, " ")
    .replace(/\s+/g, " ")
}

export function guessMapping(headers: readonly string[]): ColumnMapping {
  const mapping = emptyMapping()
  const normalized = headers.map(headerKey)
  const used = new Set<number>()
  for (const field of GUESS_ORDER) {
    const index = normalized.findIndex((column, position) => !used.has(position) && ALIASES[field].includes(column))
    if (index >= 0) {
      mapping[field] = index
      used.add(index)
    }
  }
  if (mapping.first !== null || mapping.last !== null) mapping.fullName = null
  return mapping
}

export function inspectCsv(text: string): CsvPreview {
  const table = parseCsv(text)
  if (table.length === 0) {
    return { headers: [], mapping: emptyMapping(), sample: [], dataRows: 0, error: "That file is empty." }
  }
  const headers = table[0].map((cell) => cell.trim())
  if (headers.every((cell) => cell.length === 0)) {
    return { headers: [], mapping: emptyMapping(), sample: [], dataRows: 0, error: "That file needs a header row." }
  }
  const data = table.slice(1)
  if (data.length === 0) {
    return { headers, mapping: guessMapping(headers), sample: [], dataRows: 0, error: "That file has a header and no addresses." }
  }
  return {
    headers,
    mapping: guessMapping(headers),
    sample: data.slice(0, 5).map((cells, index) => ({ row: index + 2, cells })),
    dataRows: data.length,
    error: null,
  }
}

function cell(row: string[], index: number | null): string {
  if (index === null || index < 0) return ""
  return row[index] ?? ""
}

function splitName(value: string): { first: string; last: string } {
  const parts = value.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return { first: "", last: "" }
  if (parts.length === 1) return { first: parts[0] ?? "", last: "" }
  return { first: parts.slice(0, -1).join(" "), last: parts[parts.length - 1] ?? "" }
}

export function mappingGap(mapping: ColumnMapping): string | null {
  const hasName = (mapping.first !== null && mapping.last !== null) || mapping.fullName !== null
  const missing: string[] = []
  if (!hasName) missing.push("first and last name, or one full name column")
  if (mapping.address1 === null) missing.push("street")
  if (mapping.city === null) missing.push("city")
  if (mapping.state === null) missing.push("state")
  if (mapping.zip === null) missing.push("ZIP")
  if (missing.length === 0) return null
  return `Match these columns before any address can be added: ${missing.join(", ")}.`
}

export function importMappedCsv(
  text: string,
  mapping: ColumnMapping,
  existing: readonly Recipient[] = []
): CsvImportResult {
  const empty: CsvImportResult = { headerError: null, accepted: [], invalid: [], duplicates: [] }
  const table = parseCsv(text)
  if (table.length === 0) return { ...empty, headerError: "That file is empty." }
  const gap = mappingGap(mapping)
  if (gap) return { ...empty, headerError: gap }
  if (table.length === 1) return { ...empty, headerError: "That file has a header and no addresses." }

  const accepted: Recipient[] = []
  const invalid: CsvImportResult["invalid"] = []
  const duplicates: CsvDuplicate[] = []
  const seen = new Map<string, number>()
  for (const recipient of existing) seen.set(exactAddressKey(recipient), 0)

  for (let index = 1; index < table.length; index += 1) {
    const columns = table[index] ?? []
    const row = index + 1
    const named = mapping.fullName !== null && (mapping.first === null || mapping.last === null)
      ? splitName(cell(columns, mapping.fullName))
      : { first: cell(columns, mapping.first), last: cell(columns, mapping.last) }
    const parsed = validateAddress({
      first: named.first,
      last: named.last,
      organization: cell(columns, mapping.organization),
      address1: cell(columns, mapping.address1),
      address2: cell(columns, mapping.address2),
      city: cell(columns, mapping.city),
      state: cell(columns, mapping.state),
      zip: cell(columns, mapping.zip),
    })
    if (!parsed.ok) {
      invalid.push({ row, messages: rowMessages(parsed.errors, row) })
      continue
    }
    const key = exactAddressKey(parsed.recipient)
    const firstRow = seen.get(key)
    if (firstRow !== undefined) {
      duplicates.push(firstRow === 0 ? { row, matches: "list" } : { row, matches: "file", matchesRow: firstRow })
      continue
    }
    seen.set(key, row)
    accepted.push(parsed.recipient)
  }

  return { headerError: null, accepted, invalid, duplicates }
}

export function entriesToCsv(recipients: readonly Recipient[]): string {
  const header = "first,last,organization,address1,address2,city,state,zip"
  const lines = recipients.map((recipient) =>
    [recipient.first, recipient.last, recipient.organization, recipient.address1, recipient.address2, recipient.city, recipient.state, recipient.zip]
      .map(csvCell)
      .join(",")
  )
  return [header, ...lines].join("\n")
}

function csvCell(value: string): string {
  if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`
  return value
}

export function parseMapping(value: unknown): ColumnMapping | null {
  if (!value || typeof value !== "object") return null
  const record = value as Record<string, unknown>
  const mapping = emptyMapping()
  for (const field of Object.keys(mapping) as (keyof ColumnMapping)[]) {
    const raw = record[field]
    if (raw === null || raw === undefined || raw === "") {
      mapping[field] = null
      continue
    }
    const index = typeof raw === "number" ? raw : Number(raw)
    if (!Number.isInteger(index) || index < 0 || index > 80) return null
    mapping[field] = index
  }
  return mapping
}

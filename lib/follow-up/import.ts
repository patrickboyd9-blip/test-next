import { createHash } from "node:crypto"

import { parseCsv } from "@/lib/click2mail/recipients"

export type EventStatus = "open" | "converted" | "opt-out"

export interface FollowUpEvent {
  source: string
  externalId: string
  status: EventStatus
  lastContact: string | null
  permission: boolean
  first: string
  last: string
  address1: string
  address2: string
  city: string
  state: string
  zip: string
}

export interface ImportIssue {
  row: number
  messages: string[]
}

export interface EventImport {
  validation: "syntax"
  validationNote: string
  headerError: string | null
  submittedRows: number
  events: FollowUpEvent[]
  issues: ImportIssue[]
  duplicates: { row: number; matchesRow: number; externalId: string }[]
}

const NOTE =
  "Checked the columns and the shape of each row. This is not a postal deliverability check, and it does not buy or append addresses."

const ALIASES: Record<string, string[]> = {
  source: ["source", "list source"],
  externalId: ["event id", "eventid", "id", "estimate id"],
  status: ["status", "job status"],
  lastContact: ["last contact", "lastcontact", "last touch"],
  permission: ["permission", "may mail", "consent"],
  first: ["first", "first name", "firstname"],
  last: ["last", "last name", "lastname"],
  address1: ["address", "address1", "street", "street address"],
  address2: ["apt", "apartment", "unit", "address2", "address 2"],
  city: ["city"],
  state: ["state"],
  zip: ["zip", "zip code", "postal code"],
}

function headerKey(value: string): string {
  return value.trim().toLowerCase().replace(/[_./#]+/g, " ").replace(/\s+/g, " ")
}

function columnIndex(header: string[], field: string): number {
  const aliases = ALIASES[field] ?? []
  return header.findIndex((column) => aliases.includes(column))
}

export function eventKey(event: Pick<FollowUpEvent, "source" | "externalId">): string {
  return `${event.source.trim().toLowerCase()}|${event.externalId.trim().toLowerCase()}`
}

export function importEvents(csv: string): EventImport {
  const empty: EventImport = {
    validation: "syntax",
    validationNote: NOTE,
    headerError: null,
    submittedRows: 0,
    events: [],
    issues: [],
    duplicates: [],
  }
  const table = parseCsv(csv)
  if (table.length === 0) return { ...empty, headerError: "The file is empty." }
  const header = table[0].map(headerKey)
  const joined = header.join(" ")
  if (/\b(neighbor|every door|edd[m]?|purchased list)\b/.test(joined)) {
    return {
      ...empty,
      headerError: "Neighbor, Every Door, and purchased-list columns are not accepted. Use a list you already have permission to mail.",
    }
  }
  const indexes = Object.fromEntries(
    (Object.keys(ALIASES) as (keyof typeof ALIASES)[]).map((field) => [field, columnIndex(header, field)])
  ) as Record<keyof typeof ALIASES, number>
  const required = ["source", "externalId", "status", "permission", "first", "last", "address1", "city", "state", "zip"] as const
  const missing = required.filter((field) => indexes[field] < 0)
  if (missing.length > 0) {
    return { ...empty, headerError: `Map these columns before any row can be reviewed: ${missing.join(", ")}.` }
  }
  const events: FollowUpEvent[] = []
  const issues: ImportIssue[] = []
  const duplicates: EventImport["duplicates"] = []
  const seen = new Map<string, number>()
  for (let index = 1; index < table.length; index += 1) {
    const columns = table[index] ?? []
    const row = index + 1
    const at = (field: keyof typeof indexes) => (indexes[field] < 0 ? "" : (columns[indexes[field]] ?? "").trim())
    const messages: string[] = []
    const source = at("source")
    const externalId = at("externalId")
    const statusRaw = at("status").toLowerCase()
    const permissionRaw = at("permission").toLowerCase()
    if (!source) messages.push(`Row ${row}: source is required.`)
    if (!externalId) messages.push(`Row ${row}: event id is required.`)
    if (statusRaw !== "open" && statusRaw !== "converted" && statusRaw !== "opt-out") {
      messages.push(`Row ${row}: status must be open, converted, or opt-out.`)
    }
    if (permissionRaw !== "yes" && permissionRaw !== "no") {
      messages.push(`Row ${row}: permission must be yes or no.`)
    }
    if (!at("first") || !at("last") || !at("address1") || !at("city") || !at("state") || !at("zip")) {
      messages.push(`Row ${row}: name and address are incomplete.`)
    }
    if (messages.length > 0) {
      issues.push({ row, messages })
      continue
    }
    const event: FollowUpEvent = {
      source,
      externalId,
      status: statusRaw as EventStatus,
      lastContact: at("lastContact") || null,
      permission: permissionRaw === "yes",
      first: at("first"),
      last: at("last"),
      address1: at("address1"),
      address2: at("address2"),
      city: at("city"),
      state: at("state"),
      zip: at("zip"),
    }
    const key = eventKey(event)
    const firstRow = seen.get(key)
    if (firstRow !== undefined) {
      duplicates.push({ row, matchesRow: firstRow, externalId })
      continue
    }
    seen.set(key, row)
    events.push(event)
  }
  return { ...empty, submittedRows: table.length - 1, events, issues, duplicates }
}

export function audienceHash(events: readonly FollowUpEvent[]): string {
  const lines = events.map(eventKey).sort()
  return createHash("sha256").update(lines.join("\n")).digest("hex").slice(0, 16)
}

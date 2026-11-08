import { createHash } from "node:crypto"

import { normalizeRecipient, parseCsv, type Recipient } from "@/lib/click2mail/recipients"

export interface InvalidListRow {
  row: number
  messages: string[]
}

export interface DuplicateListRow {
  row: number
  matchesRow: number
}

/**
 * A customer list after a syntax check.
 * ZIP shape and state names are checked. Deliverability is not.
 */
export interface ListReview {
  validation: "syntax"
  validationNote: string
  submittedRows: number
  accepted: Recipient[]
  acceptedCount: number
  invalid: InvalidListRow[]
  duplicates: DuplicateListRow[]
  headerError: string | null
}

const VALIDATION_NOTE =
  "Checked that each accepted row has a name, street, city, a U.S. state, and a 5- or 9-digit ZIP. Apartment lines are kept. This is not a postal deliverability check."

const FIELD_ALIASES: Record<string, string[]> = {
  first: ["first", "first name", "firstname", "given name"],
  last: ["last", "last name", "lastname", "surname"],
  address1: ["address1", "address 1", "address line 1", "street", "street address", "address"],
  address2: ["address2", "address 2", "address line 2", "apt", "apartment", "unit", "suite"],
  city: ["city"],
  state: ["state"],
  zip: ["zip", "zip code", "zipcode", "postal", "postal code", "postalcode"],
  organization: ["organization", "company", "business"],
}

function headerKey(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[_./#]+/g, " ")
    .replace(/\s+/g, " ")
}

function columnIndex(header: string[], field: string): number {
  const aliases = FIELD_ALIASES[field] ?? []
  return header.findIndex((column) => aliases.includes(column))
}

function dedupKey(recipient: Recipient): string {
  return [
    recipient.first,
    recipient.last,
    recipient.organization,
    recipient.address1,
    recipient.address2,
    recipient.city,
    recipient.state,
    recipient.zip,
  ]
    .map((part) => part.trim().toUpperCase())
    .join("|")
}

export function reviewCustomerList(csv: string): ListReview {
  const empty: ListReview = {
    validation: "syntax",
    validationNote: VALIDATION_NOTE,
    submittedRows: 0,
    accepted: [],
    acceptedCount: 0,
    invalid: [],
    duplicates: [],
    headerError: null,
  }
  const table = parseCsv(csv)
  if (table.length === 0) {
    return { ...empty, headerError: "The file is empty." }
  }

  const header = table[0].map(headerKey)
  const indexes = {
    first: columnIndex(header, "first"),
    last: columnIndex(header, "last"),
    address1: columnIndex(header, "address1"),
    address2: columnIndex(header, "address2"),
    city: columnIndex(header, "city"),
    state: columnIndex(header, "state"),
    zip: columnIndex(header, "zip"),
    organization: columnIndex(header, "organization"),
  }
  const missing = (["first", "last", "address1", "city", "state", "zip"] as const).filter(
    (field) => indexes[field] < 0
  )
  if (missing.length > 0) {
    return {
      ...empty,
      headerError: `Map these columns before any row can be accepted: ${missing.join(", ")}.`,
    }
  }

  const accepted: Recipient[] = []
  const invalid: InvalidListRow[] = []
  const duplicates: DuplicateListRow[] = []
  const seen = new Map<string, number>()

  for (let index = 1; index < table.length; index += 1) {
    const columns = table[index] ?? []
    const row = index + 1
    const at = (field: keyof typeof indexes) => {
      const column = indexes[field]
      return column < 0 ? "" : (columns[column] ?? "")
    }
    const parsed = normalizeRecipient(
      {
        first: at("first"),
        last: at("last"),
        address1: at("address1"),
        address2: at("address2"),
        city: at("city"),
        state: at("state"),
        zip: at("zip"),
        organization: at("organization"),
      },
      row
    )
    if (!parsed.recipient) {
      invalid.push({ row, messages: parsed.errors })
      continue
    }
    const key = dedupKey(parsed.recipient)
    const firstRow = seen.get(key)
    if (firstRow !== undefined) {
      duplicates.push({ row, matchesRow: firstRow })
      continue
    }
    seen.set(key, row)
    accepted.push(parsed.recipient)
  }

  if (accepted.length === 0 && invalid.length === 0) {
    return { ...empty, submittedRows: 0, headerError: "The file has a header and no addresses." }
  }

  return {
    ...empty,
    submittedRows: table.length - 1,
    accepted,
    acceptedCount: accepted.length,
    invalid,
    duplicates,
  }
}

export function listIdentity(recipients: readonly Recipient[]): { hash: string; count: number } {
  const lines = recipients.map(dedupKey).sort()
  return {
    hash: createHash("sha256").update(lines.join("\n")).digest("hex"),
    count: recipients.length,
  }
}

import { normalizeRecipient } from "@/lib/click2mail/recipients"

import { validMonthDay } from "./calendar"

export interface CardImportRow {
  row: number
  name: string
  month: number
  day: number
  address1: string
  address2: string
  city: string
  state: string
  zip: string
}

export interface CardImportIssue {
  row: number
  messages: string[]
}

export interface CardImportReview {
  accepted: CardImportRow[]
  invalid: CardImportIssue[]
  duplicates: { row: number; matchesRow: number }[]
  headerError: string | null
}

const MONTHS: Record<string, number> = {
  jan: 1,
  january: 1,
  feb: 2,
  february: 2,
  mar: 3,
  march: 3,
  apr: 4,
  april: 4,
  may: 5,
  jun: 6,
  june: 6,
  jul: 7,
  july: 7,
  aug: 8,
  august: 8,
  sep: 9,
  sept: 9,
  september: 9,
  oct: 10,
  october: 10,
  nov: 11,
  november: 11,
  dec: 12,
  december: 12,
}

/**
 * Review a CSV or a pasted list. Nothing is saved.
 * A birth year, if someone typed one, is ignored.
 */
export function reviewCardList(text: string): CardImportReview {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
  if (lines.length === 0) {
    return { accepted: [], invalid: [], duplicates: [], headerError: "The list is empty." }
  }
  const table = lines.map(splitRow)
  const header = table[0]?.map((cell) => cell.toLowerCase()) ?? []
  const mapped = headerIndexes(header)
  if (mapped) {
    return reviewTable(table.slice(1), mapped, 2)
  }
  return reviewFreeLines(lines)
}

function reviewFreeLines(lines: string[]): CardImportReview {
  const accepted: CardImportRow[] = []
  const invalid: CardImportIssue[] = []
  const duplicates: { row: number; matchesRow: number }[] = []
  const seen = new Map<string, number>()
  lines.forEach((line, index) => {
    const row = index + 1
    const parsed = parseFreeLine(line, row)
    if (!parsed.row) {
      invalid.push({ row, messages: parsed.messages })
      return
    }
    const key = identity(parsed.row)
    const first = seen.get(key)
    if (first !== undefined) {
      duplicates.push({ row, matchesRow: first })
      return
    }
    seen.set(key, row)
    accepted.push(parsed.row)
  })
  return { accepted, invalid, duplicates, headerError: null }
}

function reviewTable(
  rows: string[][],
  indexes: { name: number; birthday: number; address1: number; city: number; state: number; zip: number; address2: number },
  firstRowNumber: number,
): CardImportReview {
  const accepted: CardImportRow[] = []
  const invalid: CardImportIssue[] = []
  const duplicates: { row: number; matchesRow: number }[] = []
  const seen = new Map<string, number>()
  rows.forEach((columns, index) => {
    const row = firstRowNumber + index
    const birthday = parseBirthday(columns[indexes.birthday] ?? "")
    const name = (columns[indexes.name] ?? "").trim()
    const address = normalizeRecipient(
      {
        first: firstName(name),
        last: lastName(name),
        address1: columns[indexes.address1] ?? "",
        address2: indexes.address2 >= 0 ? columns[indexes.address2] ?? "" : "",
        city: columns[indexes.city] ?? "",
        state: columns[indexes.state] ?? "",
        zip: columns[indexes.zip] ?? "",
      },
      row,
    )
    const messages = [...(birthday ? [] : ["Use a month and day, such as 3/14."]), ...(nameParts(name) ? [] : ["Add a first and last name."]), ...address.errors]
    if (!birthday || !address.recipient || !nameParts(name)) {
      invalid.push({ row, messages })
      return
    }
    const item: CardImportRow = {
      row,
      name,
      month: birthday.month,
      day: birthday.day,
      address1: address.recipient.address1,
      address2: address.recipient.address2,
      city: address.recipient.city,
      state: address.recipient.state,
      zip: address.recipient.zip,
    }
    const key = identity(item)
    const first = seen.get(key)
    if (first !== undefined) {
      duplicates.push({ row, matchesRow: first })
      return
    }
    seen.set(key, row)
    accepted.push(item)
  })
  return { accepted, invalid, duplicates, headerError: null }
}

function parseFreeLine(line: string, row: number): { row?: CardImportRow; messages: string[] } {
  const parts = splitRow(line)
  if (parts.length < 4) return { messages: ["Use name, birthday, street, city, and state." ] }
  const name = parts[0] ?? ""
  const birthday = parseBirthday(parts[1] ?? "")
  const address1 = parts[2] ?? ""
  let city = ""
  let state = ""
  let zip = ""
  if (parts.length >= 6) {
    city = parts[3] ?? ""
    state = parts[4] ?? ""
    zip = parts[5] ?? ""
  } else if (parts.length === 5) {
    city = parts[3] ?? ""
    const packed = /^([A-Za-z]{2})\s+(\d{5}(?:-\d{4})?)$/.exec((parts[4] ?? "").trim())
    state = packed?.[1] ?? parts[4] ?? ""
    zip = packed?.[2] ?? ""
  } else {
    const packed = /^(.*)\s+([A-Za-z]{2})\s+(\d{5}(?:-\d{4})?)$/.exec((parts[3] ?? "").trim())
    city = packed?.[1] ?? ""
    state = packed?.[2] ?? ""
    zip = packed?.[3] ?? ""
  }
  const address = normalizeRecipient({ first: firstName(name), last: lastName(name), address1, city, state, zip }, row)
  const messages = [
    ...(birthday ? [] : ["Use a month and day, such as 3/14."]),
    ...(nameParts(name) ? [] : ["Add a first and last name."]),
    ...address.errors,
  ]
  if (!birthday || !address.recipient || !nameParts(name)) return { messages }
  return {
    messages: [],
    row: {
      row,
      name: name.trim(),
      month: birthday.month,
      day: birthday.day,
      address1: address.recipient.address1,
      address2: address.recipient.address2,
      city: address.recipient.city,
      state: address.recipient.state,
      zip: address.recipient.zip,
    },
  }
}

export function parseBirthday(value: string): { month: number; day: number } | null {
  const text = value.trim().toLowerCase().replace(/,/g, "")
  const numeric = /^(\d{1,2})[/-](\d{1,2})(?:[/-]\d{2,4})?$/.exec(text)
  if (numeric) {
    const month = Number(numeric[1])
    const day = Number(numeric[2])
    return validMonthDay(month, day, 2024) || validMonthDay(month, day, 2023) ? { month, day } : null
  }
  const named = /^([a-z]+)\s+(\d{1,2})(?:\s+\d{2,4})?$/.exec(text)
  if (!named) return null
  const month = MONTHS[named[1] ?? ""]
  const day = Number(named[2])
  if (!month || !validMonthDay(month, day, 2024)) return null
  return { month, day }
}

function headerIndexes(header: string[]) {
  const find = (...names: string[]) => header.findIndex((cell) => names.includes(cell))
  const name = find("name", "full name")
  const birthday = find("birthday", "birth date", "birthdate")
  const address1 = find("address", "address1", "street", "street address")
  const city = find("city")
  const state = find("state")
  const zip = find("zip", "zipcode", "postal", "postal code")
  if ([name, birthday, address1, city, state, zip].some((index) => index < 0)) return null
  return { name, birthday, address1, city, state, zip, address2: find("address2", "apt", "unit") }
}

function splitRow(line: string): string[] {
  const cells: string[] = []
  let current = ""
  let quoted = false
  for (const char of line) {
    if (char === '"') {
      quoted = !quoted
      continue
    }
    if (char === "," && !quoted) {
      cells.push(current.trim())
      current = ""
      continue
    }
    current += char
  }
  cells.push(current.trim())
  return cells
}

function nameParts(name: string): boolean {
  return name.trim().split(/\s+/).filter(Boolean).length >= 2
}

function firstName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  return parts.slice(0, -1).join(" ")
}

function lastName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  return parts.at(-1) ?? ""
}

function identity(row: CardImportRow): string {
  return [row.name, row.month, row.day, row.address1, row.zip].join("|").toUpperCase()
}

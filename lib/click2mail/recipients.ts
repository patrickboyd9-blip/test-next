import { xmlTag } from "./xml"

export interface Recipient {
  first: string
  last: string
  organization: string
  address1: string
  address2: string
  city: string
  state: string
  zip: string
}

export interface RecipientIssue {
  row: number
  message: string
}

const STATE_NAMES: Record<string, string> = {
  AL: "AL",
  ALABAMA: "AL",
  AK: "AK",
  ALASKA: "AK",
  AZ: "AZ",
  ARIZONA: "AZ",
  AR: "AR",
  ARKANSAS: "AR",
  CA: "CA",
  CALIFORNIA: "CA",
  CO: "CO",
  COLORADO: "CO",
  CT: "CT",
  CONNECTICUT: "CT",
  DE: "DE",
  DELAWARE: "DE",
  DC: "DC",
  "DISTRICT OF COLUMBIA": "DC",
  FL: "FL",
  FLORIDA: "FL",
  GA: "GA",
  GEORGIA: "GA",
  HI: "HI",
  HAWAII: "HI",
  ID: "ID",
  IDAHO: "ID",
  IL: "IL",
  ILLINOIS: "IL",
  IN: "IN",
  INDIANA: "IN",
  IA: "IA",
  IOWA: "IA",
  KS: "KS",
  KANSAS: "KS",
  KY: "KY",
  KENTUCKY: "KY",
  LA: "LA",
  LOUISIANA: "LA",
  ME: "ME",
  MAINE: "ME",
  MD: "MD",
  MARYLAND: "MD",
  MA: "MA",
  MASSACHUSETTS: "MA",
  MI: "MI",
  MICHIGAN: "MI",
  MN: "MN",
  MINNESOTA: "MN",
  MS: "MS",
  MISSISSIPPI: "MS",
  MO: "MO",
  MISSOURI: "MO",
  MT: "MT",
  MONTANA: "MT",
  NE: "NE",
  NEBRASKA: "NE",
  NV: "NV",
  NEVADA: "NV",
  NH: "NH",
  "NEW HAMPSHIRE": "NH",
  NJ: "NJ",
  "NEW JERSEY": "NJ",
  NM: "NM",
  "NEW MEXICO": "NM",
  NY: "NY",
  "NEW YORK": "NY",
  NC: "NC",
  "NORTH CAROLINA": "NC",
  ND: "ND",
  "NORTH DAKOTA": "ND",
  OH: "OH",
  OHIO: "OH",
  OK: "OK",
  OKLAHOMA: "OK",
  OR: "OR",
  OREGON: "OR",
  PA: "PA",
  PENNSYLVANIA: "PA",
  RI: "RI",
  "RHODE ISLAND": "RI",
  SC: "SC",
  "SOUTH CAROLINA": "SC",
  SD: "SD",
  "SOUTH DAKOTA": "SD",
  TN: "TN",
  TENNESSEE: "TN",
  TX: "TX",
  TEXAS: "TX",
  UT: "UT",
  UTAH: "UT",
  VT: "VT",
  VERMONT: "VT",
  VA: "VA",
  VIRGINIA: "VA",
  WA: "WA",
  WASHINGTON: "WA",
  WV: "WV",
  "WEST VIRGINIA": "WV",
  WI: "WI",
  WISCONSIN: "WI",
  WY: "WY",
  WYOMING: "WY",
}

const REQUIRED_COLUMNS = ["first", "last", "address1", "address2", "city", "state", "zip"] as const

export function normalizeZip(value: string): string | null {
  const digits = value.replace(/\D/g, "")
  if (digits.length === 5) return digits
  if (digits.length === 9) return `${digits.slice(0, 5)}-${digits.slice(5)}`
  return null
}

export function normalizeState(value: string): string | null {
  const key = value.trim().replace(/\./g, "").replace(/\s+/g, " ").toUpperCase()
  return STATE_NAMES[key] ?? null
}

function cleanLine(value: string): string {
  return value.replace(/[\u0000-\u001F\u007F]/g, "").replace(/\s+/g, " ").trim()
}

export function normalizeRecipient(
  input: {
    first?: string
    last?: string
    address1?: string
    address2?: string
    city?: string
    state?: string
    zip?: string
    organization?: string
  },
  row = 1
): { recipient?: Recipient; errors: string[] } {
  const errors: string[] = []
  const first = cleanLine(input.first ?? "")
  const last = cleanLine(input.last ?? "")
  const address1 = cleanLine(input.address1 ?? "")
  const address2 = cleanLine(input.address2 ?? "")
  const city = cleanLine(input.city ?? "")
  const organization = cleanLine(input.organization ?? "")
  const state = normalizeState(input.state ?? "")
  const zip = normalizeZip(input.zip ?? "")

  const requireText = (label: string, value: string) => {
    if (!value) errors.push(`Row ${row}: ${label} is required.`)
    if (value.length > 80) errors.push(`Row ${row}: ${label} is too long.`)
  }

  requireText("first name", first)
  requireText("last name", last)
  requireText("address", address1)
  requireText("city", city)
  if (address2.length > 80) errors.push(`Row ${row}: address line 2 is too long.`)
  if (organization.length > 80) errors.push(`Row ${row}: organization is too long.`)
  if (!state) errors.push(`Row ${row}: state must be a U.S. state.`)
  if (!zip) errors.push(`Row ${row}: ZIP must be 5 or 9 digits.`)

  if (errors.length > 0) return { errors }
  return {
    errors,
    recipient: {
      first,
      last,
      organization,
      address1,
      address2,
      city,
      state: state as string,
      zip: zip as string,
    },
  }
}

export function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let cell = ""
  let inQuotes = false
  const source = text.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n").replace(/\r/g, "\n")

  for (let index = 0; index < source.length; index += 1) {
    const char = source[index] ?? ""
    if (inQuotes) {
      if (char === '"') {
        if (source[index + 1] === '"') {
          cell += '"'
          index += 1
        } else {
          inQuotes = false
        }
      } else {
        cell += char
      }
      continue
    }
    if (char === '"') {
      inQuotes = true
      continue
    }
    if (char === ",") {
      row.push(cell)
      cell = ""
      continue
    }
    if (char === "\n") {
      row.push(cell)
      rows.push(row)
      row = []
      cell = ""
      continue
    }
    cell += char
  }
  if (cell.length > 0 || row.length > 0) {
    row.push(cell)
    rows.push(row)
  }
  return rows.filter((columns) => columns.some((column) => column.trim().length > 0))
}

export function parseRecipientCsv(text: string): { recipients: Recipient[]; errors: string[] } {
  const table = parseCsv(text)
  if (table.length === 0) {
    return { recipients: [], errors: ["The CSV is empty."] }
  }

  const header = table[0].map((column) => column.trim().toLowerCase())
  const missing = REQUIRED_COLUMNS.filter((column) => !header.includes(column))
  if (missing.length > 0) {
    return {
      recipients: [],
      errors: [`The CSV needs these columns: ${missing.join(", ")}.`],
    }
  }

  const indexOf = (name: string) => header.indexOf(name)
  const recipients: Recipient[] = []
  const errors: string[] = []

  for (let rowIndex = 1; rowIndex < table.length; rowIndex += 1) {
    const columns = table[rowIndex]
    const at = (name: string) => columns[indexOf(name)] ?? ""
    const parsed = normalizeRecipient(
      {
        first: at("first"),
        last: at("last"),
        address1: at("address1"),
        address2: at("address2"),
        city: at("city"),
        state: at("state"),
        zip: at("zip"),
      },
      rowIndex + 1
    )
    errors.push(...parsed.errors)
    if (parsed.recipient) recipients.push(parsed.recipient)
  }

  if (recipients.length === 0 && errors.length === 0) {
    errors.push("The CSV has a header and no addresses.")
  }

  return { recipients, errors }
}

export function buildAddressListXml(input: {
  name: string
  mappingId: string
  recipients: readonly Recipient[]
}): string {
  const addresses = input.recipients
    .map(
      (recipient) =>
        "<address>" +
        xmlTag("Firstname", recipient.first) +
        xmlTag("Lastname", recipient.last) +
        xmlTag("Organization", recipient.organization) +
        xmlTag("Address1", recipient.address1) +
        xmlTag("Address2", recipient.address2) +
        xmlTag("Address3", "") +
        xmlTag("City", recipient.city) +
        xmlTag("State", recipient.state) +
        xmlTag("Postalcode", recipient.zip) +
        xmlTag("Country", "") +
        "</address>"
    )
    .join("")

  return (
    `<?xml version="1.0" encoding="UTF-8"?>` +
    `<addressList>` +
    xmlTag("addressListName", input.name) +
    xmlTag("addressMappingId", input.mappingId) +
    `<addresses>${addresses}</addresses>` +
    `</addressList>`
  )
}

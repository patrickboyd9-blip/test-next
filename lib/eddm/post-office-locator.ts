import { mkdir, readFile, writeFile } from "node:fs/promises"
import path from "node:path"

import type { EddmRoute } from "./routes"

const LOCATOR_URL = "https://tools.usps.com/UspsToolsRestServices/rest/POLocator/findLocations"
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000

export interface PostOfficeContact {
  name: string
  street: string
  city: string
  state: string
  zip: string
  phone: string
}

/**
 * Used only when the USPS locator is down and the saved locator cache has
 * no match. James A. Farley was read from that locator on Oct 26, 2026.
 */
const FALLBACK_POST_OFFICES: readonly PostOfficeContact[] = [
  {
    name: "JAMES A FARLEY",
    street: "421 8TH AVE",
    city: "NEW YORK",
    state: "NY",
    zip: "10001",
    phone: "212-330-3296",
  },
]

interface OfficeCacheFile {
  zip: string
  fetchedAt: string
  contacts: PostOfficeContact[]
}

export async function lookupPostOfficeContacts(input: {
  zip: string
  fetchImpl?: typeof fetch
  cacheDir?: string
  now?: number
}): Promise<PostOfficeContact[]> {
  const fetchImpl = input.fetchImpl ?? fetch
  const now = input.now ?? Date.now()
  const cacheDir = input.cacheDir ?? defaultCacheDir()
  const zip = input.zip.trim()
  if (!/^\d{5}$/.test(zip)) return fallbackFor(zip)

  const cached = await readCache(cacheDir, zip)
  const fresh = cached !== null && now - Date.parse(cached.fetchedAt) <= CACHE_TTL_MS
  if (fresh && cached.contacts.length > 0) {
    return mergeFallback(cached.contacts, zip)
  }

  try {
    const live = await fetchLocator(zip, fetchImpl)
    if (live.length > 0) {
      await writeCache(cacheDir, { zip, fetchedAt: new Date(now).toISOString(), contacts: live })
      return mergeFallback(live, zip)
    }
  } catch {
    // The locator is optional. The saved copy and the fallback table still apply.
  }

  return mergeFallback(cached?.contacts ?? [], zip)
}

export function applyPostOfficeContacts(
  routes: readonly EddmRoute[],
  contacts: readonly PostOfficeContact[]
): EddmRoute[] {
  return routes.map((route) => {
    if (route.postOfficeStreet.trim() && route.postOfficePhone.trim()) return route
    const contact = findContact(route.postOfficeName, contacts)
    if (!contact) return route
    return {
      ...route,
      postOfficeStreet: route.postOfficeStreet.trim() || contact.street,
      postOfficePhone: route.postOfficePhone.trim() || contact.phone,
    }
  })
}

export function parseLocatorContacts(body: unknown): PostOfficeContact[] {
  if (!body || typeof body !== "object") return []
  const locations = (body as { locations?: unknown }).locations
  if (!Array.isArray(locations)) return []
  const contacts: PostOfficeContact[] = []
  for (const item of locations) {
    if (!item || typeof item !== "object") continue
    const row = item as {
      locationName?: unknown
      address1?: unknown
      city?: unknown
      state?: unknown
      zip5?: unknown
      phone?: unknown
    }
    const name = asText(row.locationName)
    const street = asText(row.address1)
    const phone = formatPhone(asText(row.phone))
    const city = asText(row.city)
    const state = asText(row.state).toUpperCase()
    const zip = asText(row.zip5)
    if (!name || !street || !phone) continue
    contacts.push({ name, street, city, state, zip, phone })
  }
  return contacts
}

function findContact(name: string, contacts: readonly PostOfficeContact[]): PostOfficeContact | null {
  const key = officeKey(name)
  if (!key) return null
  return contacts.find((contact) => officeKey(contact.name) === key) ?? null
}

function officeKey(name: string): string {
  return name
    .toUpperCase()
    .replace(/[^A-Z0-9 ]/g, " ")
    .replace(/\b(POST OFFICE|USPS|STATION)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

export function formatPhone(value: string): string {
  const digits = value.replace(/\D/g, "")
  const local = digits.length === 11 && digits.startsWith("1") ? digits.slice(1) : digits
  if (local.length !== 10) return value.trim()
  return `${local.slice(0, 3)}-${local.slice(3, 6)}-${local.slice(6)}`
}

function fallbackFor(zip: string): PostOfficeContact[] {
  return FALLBACK_POST_OFFICES.filter((office) => office.zip === zip)
}

function mergeFallback(contacts: readonly PostOfficeContact[], zip: string): PostOfficeContact[] {
  const keys = new Set(contacts.map((contact) => officeKey(contact.name)))
  const extra = fallbackFor(zip).filter((office) => !keys.has(officeKey(office.name)))
  return [...contacts, ...extra]
}

async function fetchLocator(zip: string, fetchImpl: typeof fetch): Promise<PostOfficeContact[]> {
  const response = await fetchImpl(LOCATOR_URL, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json;charset=UTF-8",
      Origin: "https://tools.usps.com",
      Referer: "https://tools.usps.com/find-location.htm",
      "User-Agent": "ModernMail/eddm (neighborhood mailing planner)",
    },
    body: JSON.stringify({
      lbro: "",
      requestRefineHours: "",
      requestRefineTypes: "",
      requestServices: "",
      requestType: "po",
      requestZipCode: zip,
      maxDistance: "20",
    }),
    signal: AbortSignal.timeout(12_000),
  })
  if (!response.ok) return []
  return parseLocatorContacts(await response.json())
}

function defaultCacheDir(): string {
  return path.join(process.cwd(), ".data", "eddm-post-offices")
}

async function readCache(cacheDir: string, zip: string): Promise<OfficeCacheFile | null> {
  try {
    const raw = await readFile(path.join(cacheDir, `${zip}.json`), "utf8")
    const parsed = JSON.parse(raw) as OfficeCacheFile
    if (!parsed || parsed.zip !== zip || !Array.isArray(parsed.contacts)) return null
    return parsed
  } catch {
    return null
  }
}

async function writeCache(cacheDir: string, file: OfficeCacheFile): Promise<void> {
  await mkdir(cacheDir, { recursive: true })
  await writeFile(path.join(cacheDir, `${file.zip}.json`), JSON.stringify(file))
}

function asText(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
}

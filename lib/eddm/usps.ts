import { mkdir, readFile, writeFile } from "node:fs/promises"
import path from "node:path"

import type { EddmRoute } from "./routes"

const USPS_EXECUTE =
  "https://gis.usps.com/arcgis/rest/services/EDDM/selectZIP/GPServer/routes/execute"
const NOMINATIM = "https://nominatim.openstreetmap.org/search"
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000

export interface EddmRouteLoad {
  ok: boolean
  zip: string
  areaLabel: string
  routes: EddmRoute[]
  /** live, saved, or none. */
  source: "usps" | "cache" | "none"
  stale: boolean
  savedAt?: string
  message: string
}

interface CacheFile {
  zip: string
  fetchedAt: string
  body: unknown
}

export async function loadEddmRoutes(input: {
  query: string
  cacheDir?: string
  fetchImpl?: typeof fetch
  now?: number
}): Promise<EddmRouteLoad> {
  const fetchImpl = input.fetchImpl ?? fetch
  const now = input.now ?? Date.now()
  const cacheDir = input.cacheDir ?? defaultCacheDir()
  const query = input.query.trim()
  if (!query) {
    return empty("", "Enter a ZIP code or a street address.")
  }

  const directZip = extractZip(query)
  let zip = directZip
  let areaLabel = directZip ?? ""
  if (!zip) {
    const place = await geocodeAddress(query, fetchImpl)
    if (!place.zip) {
      return empty("", place.message)
    }
    zip = place.zip
    areaLabel = place.label || zip
  }

  const cached = await readCache(cacheDir, zip)
  try {
    const body = await fetchUsps(zip, fetchImpl)
    const routes = parseUspsRoutes(body)
    await writeCache(cacheDir, { zip, fetchedAt: new Date(now).toISOString(), body })
    if (routes.length === 0) {
      return {
        ok: true,
        zip,
        areaLabel: areaLabel || zip,
        routes: [],
        source: "usps",
        stale: false,
        message: `USPS has no carrier routes on file for ZIP ${zip}.`,
      }
    }
    return {
      ok: true,
      zip,
      areaLabel: routes[0]?.cityState || areaLabel || zip,
      routes,
      source: "usps",
      stale: false,
      message: "",
    }
  } catch (error) {
    if (cached) {
      const routes = parseUspsRoutes(cached.body)
      const saved = cached.fetchedAt
      const stale = now - Date.parse(saved) > CACHE_TTL_MS
      return {
        ok: routes.length > 0,
        zip,
        areaLabel: routes[0]?.cityState || areaLabel || zip,
        routes,
        source: "cache",
        stale,
        savedAt: saved,
        message: routes.length
          ? `USPS route data isn't available right now. These routes were saved ${formatSaved(saved)}.`
          : "USPS route data isn't available right now, and the saved copy for this ZIP is empty.",
      }
    }
    const detail = error instanceof Error ? error.message : "Route data isn't available right now."
    return {
      ok: false,
      zip,
      areaLabel,
      routes: [],
      source: "none",
      stale: false,
      message: `${detail} You can try this ZIP again in a little while.`,
    }
  }
}

export function parseUspsRoutes(body: unknown): EddmRoute[] {
  const features = findFeatures(body)
  const routes: EddmRoute[] = []
  for (const feature of features) {
    const route = featureToRoute(feature)
    if (route) routes.push(route)
  }
  routes.sort((a, b) => a.route.localeCompare(b.route))
  return routes
}

export function extractZip(query: string): string | null {
  const trimmed = query.trim()
  if (/^\d{5}$/.test(trimmed)) return trimmed
  if (!/[a-z]/i.test(trimmed)) return null
  const matches = trimmed.match(/\b\d{5}\b/g)
  return matches ? matches[matches.length - 1] : null
}

function empty(zip: string, message: string): EddmRouteLoad {
  return { ok: false, zip, areaLabel: "", routes: [], source: "none", stale: false, message }
}

async function fetchUsps(zip: string, fetchImpl: typeof fetch): Promise<unknown> {
  const url = new URL(USPS_EXECUTE)
  url.searchParams.set("ZIP", zip)
  url.searchParams.set("Rte_Box", "R")
  url.searchParams.set("UserName", "EDDM")
  url.searchParams.set("f", "json")
  const response = await fetchImpl(url, {
    headers: { Accept: "application/json", "User-Agent": "ModernMail/eddm" },
    signal: AbortSignal.timeout(12_000),
  })
  if (!response.ok) {
    throw new Error("USPS route data isn't available right now.")
  }
  return response.json()
}

async function geocodeAddress(
  query: string,
  fetchImpl: typeof fetch
): Promise<{ zip: string; label: string; message: string }> {
  const url = new URL(NOMINATIM)
  url.searchParams.set("format", "jsonv2")
  url.searchParams.set("addressdetails", "1")
  url.searchParams.set("countrycodes", "us")
  url.searchParams.set("limit", "1")
  url.searchParams.set("q", query)
  try {
    const response = await fetchImpl(url, {
      headers: {
        Accept: "application/json",
        "User-Agent": "ModernMail/eddm (neighborhood mailing planner)",
      },
      signal: AbortSignal.timeout(8_000),
    })
    if (!response.ok) {
      return { zip: "", label: "", message: "Address lookup isn't available right now. Enter a 5-digit ZIP." }
    }
    const body = (await response.json()) as unknown
    const first = Array.isArray(body) ? body[0] : null
    const address = first && typeof first === "object" ? (first as { address?: { postcode?: string }; display_name?: string }).address : undefined
    const postcode = address?.postcode?.match(/\b\d{5}\b/)?.[0] ?? ""
    if (!postcode) {
      return { zip: "", label: "", message: "That address didn't include a ZIP. Enter the 5-digit ZIP." }
    }
    const label = first && typeof first === "object" && "display_name" in first ? String((first as { display_name?: string }).display_name ?? "") : ""
    return { zip: postcode, label, message: "" }
  } catch {
    return { zip: "", label: "", message: "Address lookup isn't available right now. Enter a 5-digit ZIP." }
  }
}

function findFeatures(body: unknown): unknown[] {
  if (!body || typeof body !== "object") return []
  const record = body as { features?: unknown; results?: unknown[] }
  if (Array.isArray(record.features)) return record.features
  if (Array.isArray(record.results)) {
    for (const result of record.results) {
      if (!result || typeof result !== "object") continue
      const value = (result as { value?: { features?: unknown } }).value
      if (value && Array.isArray(value.features)) return value.features
    }
  }
  return []
}

function featureToRoute(feature: unknown): EddmRoute | null {
  if (!feature || typeof feature !== "object") return null
  const attributes = (feature as { attributes?: Record<string, unknown> }).attributes
  if (!attributes) return null
  const zip = text(attributes, ["ZIP_CODE", "ZIP", "ZIP5"])
  const route = text(attributes, ["CRID_ID", "ROUTE_ID", "RTE"])
  if (!zip || !route) return null
  const id = text(attributes, ["ZIP_CRID"]) || `${zip}${route}`
  return {
    id,
    zip,
    route,
    cityState: text(attributes, ["CITY_STATE", "CITY"]) || "",
    residential: count(attributes, ["RES_CNT", "RESCNT"]),
    business: count(attributes, ["BUS_CNT", "BUSCNT"]),
    total: count(attributes, ["TOT_CNT", "TOTAL"]),
    medianAge: optionalNumber(attributes, ["MED_AGE", "MEDIAN_AGE"]),
    medianIncome: optionalNumber(attributes, ["MED_INCOME", "MEDIAN_INCOME"]),
    householdSize: optionalNumber(attributes, ["AVG_HH_SIZ", "AVG_HH_SIZE", "AVG_HH_SZ"]),
    postOfficeName: text(attributes, ["FACILITY_NAME", "FAC_NAME", "PO_NAME"]) || "",
    lines: readLines((feature as { geometry?: unknown }).geometry),
  }
}

function readLines(geometry: unknown): Array<Array<[number, number]>> {
  if (!geometry || typeof geometry !== "object") return []
  const record = geometry as { paths?: unknown; rings?: unknown }
  const groups = Array.isArray(record.paths) ? record.paths : Array.isArray(record.rings) ? record.rings : []
  const lines: Array<Array<[number, number]>> = []
  for (const group of groups) {
    if (!Array.isArray(group)) continue
    const line: Array<[number, number]> = []
    for (const point of group) {
      if (!Array.isArray(point) || point.length < 2) continue
      const x = Number(point[0])
      const y = Number(point[1])
      if (!Number.isFinite(x) || !Number.isFinite(y)) continue
      line.push(toLngLat(x, y))
    }
    if (line.length >= 2) lines.push(line)
  }
  return lines
}

/** Web Mercator (EPSG:3857 / 102100) to longitude and latitude. Degrees pass through. */
export function toLngLat(x: number, y: number): [number, number] {
  if (Math.abs(x) <= 180 && Math.abs(y) <= 90) return [x, y]
  const origin = 20037508.34
  const lon = (x / origin) * 180
  let lat = (y / origin) * 180
  lat = (180 / Math.PI) * (2 * Math.atan(Math.exp((lat * Math.PI) / 180)) - Math.PI / 2)
  return [roundCoord(lon), roundCoord(lat)]
}

function text(attributes: Record<string, unknown>, keys: readonly string[]): string {
  for (const key of keys) {
    const value = attributes[key]
    if (typeof value === "string" && value.trim()) return value.trim()
    if (typeof value === "number" && Number.isFinite(value)) return String(value)
  }
  return ""
}

function count(attributes: Record<string, unknown>, keys: readonly string[]): number {
  const value = optionalNumber(attributes, keys)
  return value === null ? 0 : Math.max(0, Math.round(value))
}

function optionalNumber(attributes: Record<string, unknown>, keys: readonly string[]): number | null {
  for (const key of keys) {
    const value = attributes[key]
    if (typeof value === "number" && Number.isFinite(value)) return value
    if (typeof value === "string" && value.trim() && Number.isFinite(Number(value))) return Number(value)
  }
  return null
}

function defaultCacheDir(): string {
  return path.join(process.cwd(), ".data", "eddm-routes")
}

async function readCache(cacheDir: string, zip: string): Promise<CacheFile | null> {
  try {
    const raw = await readFile(path.join(cacheDir, `${zip}.json`), "utf8")
    const parsed = JSON.parse(raw) as CacheFile
    if (!parsed || parsed.zip !== zip || !parsed.fetchedAt) return null
    return parsed
  } catch {
    return null
  }
}

async function writeCache(cacheDir: string, file: CacheFile): Promise<void> {
  try {
    await mkdir(cacheDir, { recursive: true })
    await writeFile(path.join(cacheDir, `${file.zip}.json`), JSON.stringify(file))
  } catch {
    // A cache miss on the next outage is acceptable. The live response still returns.
  }
}

function formatSaved(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return "earlier"
  return date.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })
}

function roundCoord(value: number): number {
  return Math.round(value * 1e6) / 1e6
}

import { eddmLimitMessages, type EddmZipTotal } from "./limits"
import type { EddmSize } from "./geometry"
import { eddmPostageEstimate, type EddmPostageEstimate } from "./postage"

export type EddmCoverage = "residential" | "residential_and_business"

export interface EddmFilters {
  minMedianAge?: number
  maxMedianAge?: number
  minMedianIncome?: number
  maxMedianIncome?: number
  minHouseholdSize?: number
  maxHouseholdSize?: number
}

/** One carrier route from the USPS EDDM feed. Lines are longitude, latitude. */
export interface EddmRoute {
  id: string
  zip: string
  route: string
  cityState: string
  residential: number
  business: number
  total: number
  medianAge: number | null
  medianIncome: number | null
  householdSize: number | null
  postOfficeName: string
  lines: Array<Array<[number, number]>>
}

/** Saved on the campaign. Map lines are loaded again when the customer returns. */
export interface EddmRouteSnapshot {
  id: string
  zip: string
  route: string
  cityState: string
  residential: number
  business: number
  total: number
  medianAge: number | null
  medianIncome: number | null
  householdSize: number | null
  postOfficeName: string
}

export interface EddmAudience {
  query: string
  zip: string
  neighborhood?: string
  coverage: EddmCoverage
  size: EddmSize
  filters: EddmFilters
  selectedRouteIds: string[]
  routes: EddmRouteSnapshot[]
}

export interface EddmPostOffice {
  name: string
  /** Street address is not in the free route feed. This is the city and ZIP. */
  address: string
  /** Hours are not in the free route feed. */
  hours: string
  zip: string
  totalPieces: number
}

export interface EddmSelectionSummary {
  residential: number
  business: number
  pieces: number
  routeCount: number
  perZip: EddmZipTotal[]
  messages: string[]
  postage: EddmPostageEstimate
  postOffices: EddmPostOffice[]
}

export function snapshotRoute(route: EddmRoute): EddmRouteSnapshot {
  return {
    id: route.id,
    zip: route.zip,
    route: route.route,
    cityState: route.cityState,
    residential: route.residential,
    business: route.business,
    total: route.total,
    medianAge: route.medianAge,
    medianIncome: route.medianIncome,
    householdSize: route.householdSize,
    postOfficeName: route.postOfficeName,
  }
}

export function routePieces(route: Pick<EddmRouteSnapshot, "residential" | "business">, coverage: EddmCoverage): number {
  if (coverage === "residential") return Math.max(0, route.residential)
  return Math.max(0, route.residential) + Math.max(0, route.business)
}

/**
 * A missing demographic stays selectable. The feed often leaves income or
 * household size blank, and hiding those routes would empty the map.
 */
export function routeMatchesFilter(route: Pick<EddmRouteSnapshot, "medianAge" | "medianIncome" | "householdSize">, filters: EddmFilters): boolean {
  if (!inRange(route.medianAge, filters.minMedianAge, filters.maxMedianAge)) return false
  if (!inRange(route.medianIncome, filters.minMedianIncome, filters.maxMedianIncome)) return false
  if (!inRange(route.householdSize, filters.minHouseholdSize, filters.maxHouseholdSize)) return false
  return true
}

export function summarizeSelection(
  routes: readonly EddmRouteSnapshot[],
  coverage: EddmCoverage
): EddmSelectionSummary {
  const perZip = new Map<string, number>()
  const offices = new Map<string, EddmPostOffice>()
  let residential = 0
  let business = 0
  let pieces = 0
  for (const route of routes) {
    const count = routePieces(route, coverage)
    residential += Math.max(0, route.residential)
    business += Math.max(0, route.business)
    pieces += count
    perZip.set(route.zip, (perZip.get(route.zip) ?? 0) + count)
    const key = `${route.zip}:${route.postOfficeName}`
    const existing = offices.get(key)
    if (existing) {
      existing.totalPieces += count
    } else {
      offices.set(key, {
        name: route.postOfficeName || `Post office ${route.zip}`,
        address: [route.cityState, route.zip].filter(Boolean).join(" "),
        hours: "",
        zip: route.zip,
        totalPieces: count,
      })
    }
  }
  const zipTotals = [...perZip.entries()].map(([zip, zipPieces]) => ({ zip, pieces: zipPieces }))
  return {
    residential,
    business,
    pieces,
    routeCount: routes.length,
    perZip: zipTotals,
    messages: routes.length === 0 ? ["Select at least one carrier route."] : eddmLimitMessages({ pieces, perZip: zipTotals }),
    postage: eddmPostageEstimate(pieces),
    postOffices: [...offices.values()],
  }
}

function inRange(value: number | null, min: number | undefined, max: number | undefined): boolean {
  if (value === null || value === undefined || Number.isNaN(value)) return true
  if (min !== undefined && Number.isFinite(min) && value < min) return false
  if (max !== undefined && Number.isFinite(max) && value > max) return false
  return true
}

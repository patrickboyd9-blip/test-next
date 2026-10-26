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
  /** Street from the USPS facility locator. Empty until that lookup succeeds. */
  postOfficeStreet: string
  /** Phone from the USPS facility locator. Empty until that lookup succeeds. */
  postOfficePhone: string
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
  /** Street from the USPS facility locator. Empty when the lookup did not find one. */
  postOfficeStreet?: string
  /** Phone from the USPS facility locator. Empty when the lookup did not find one. */
  postOfficePhone?: string
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
  /** Street address of the delivering post office. Click2Mail requires this. */
  address: string
  city: string
  state: string
  /** Phone of the delivering post office. Click2Mail requires this. */
  phone: string
  /** Hours are not in the free route feed. */
  hours: string
  zip: string
  /** City, Rural, or Highway, from the route prefix. */
  routeType: string
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
    postOfficeStreet: route.postOfficeStreet,
    postOfficePhone: route.postOfficePhone,
  }
}

export function routePieces(route: Pick<EddmRouteSnapshot, "residential" | "business">, coverage: EddmCoverage): number {
  if (coverage === "residential") return Math.max(0, route.residential)
  return Math.max(0, route.residential) + Math.max(0, route.business)
}

/** "NEW YORK, NY" becomes city NEW YORK and state NY. */
export function parseCityState(cityState: string): { city: string; state: string } {
  const trimmed = cityState.trim()
  const match = trimmed.match(/^(.*),\s*([A-Za-z]{2})$/)
  if (!match) return { city: trimmed, state: "" }
  return { city: (match[1] ?? "").trim(), state: (match[2] ?? "").toUpperCase() }
}

/** C071 is a city route. R is rural. H is highway. */
export function eddmRouteType(route: string): string {
  const prefix = route.trim().charAt(0).toUpperCase()
  if (prefix === "R") return "Rural"
  if (prefix === "H") return "Highway"
  return "City"
}

/**
 * Click2Mail's EDDM sample sends the route as ZIP plus the route id,
 * for example 20852-C083. Their written reference says "route number".
 * We send the sample's form.
 */
export function eddmRouteCode(route: Pick<EddmRouteSnapshot, "zip" | "route">): string {
  return `${route.zip}-${route.route}`
}

/** Plain-English block when a selected route has no delivering post office. */
export function deliveringPostOfficeIssues(routes: readonly EddmRouteSnapshot[]): string[] {
  const missingName = routes.filter((route) => !route.postOfficeName.trim())
  if (missingName.length > 0) {
    const listed = missingName
      .slice(0, 3)
      .map((route) => `route ${route.route} in ZIP ${route.zip}`)
      .join(", ")
    const extra = missingName.length > 3 ? `, and ${missingName.length - 3} more` : ""
    return [
      `We can't tell which post office delivers ${listed}${extra}. Every Door needs that post office before checkout. Pick routes that show a post office, or load the routes again.`,
    ]
  }
  const missingState = routes.filter((route) => !parseCityState(route.cityState).state)
  if (missingState.length > 0) {
    const route = missingState[0]
    return [
      `We know ${route?.postOfficeName} delivers route ${route?.route} in ZIP ${route?.zip}, but the USPS feed did not include that post office's city and state. Checkout stays closed until it does.`,
    ]
  }
  const incomplete = routes.find((route) => !route.postOfficeStreet?.trim() || !route.postOfficePhone?.trim())
  if (incomplete) {
    const missingStreet = !incomplete.postOfficeStreet?.trim()
    const missingPhone = !incomplete.postOfficePhone?.trim()
    const what =
      missingStreet && missingPhone
        ? "a street address or a phone number"
        : missingStreet
          ? "a street address"
          : "a phone number"
    return [
      `We don't have ${what} for ${incomplete.postOfficeName}, the post office that delivers route ${incomplete.route} in ZIP ${incomplete.zip}. Every Door needs both before checkout.`,
    ]
  }
  return []
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
    const street = route.postOfficeStreet?.trim() ?? ""
    const phone = route.postOfficePhone?.trim() ?? ""
    if (!route.postOfficeName.trim() || !street || !phone) continue
    const place = parseCityState(route.cityState)
    if (!place.state) continue
    const routeType = eddmRouteType(route.route)
    const key = `${route.zip}:${route.postOfficeName}:${routeType}`
    const existing = offices.get(key)
    if (existing) {
      existing.totalPieces += count
    } else {
      offices.set(key, {
        name: route.postOfficeName.trim(),
        address: street,
        city: place.city,
        state: place.state,
        phone,
        hours: "",
        zip: route.zip,
        routeType,
        totalPieces: count,
      })
    }
  }
  const zipTotals = [...perZip.entries()].map(([zip, zipPieces]) => ({ zip, pieces: zipPieces }))
  const messages =
    routes.length === 0
      ? ["Select at least one carrier route."]
      : [...deliveringPostOfficeIssues(routes), ...eddmLimitMessages({ pieces, perZip: zipTotals })]
  return {
    residential,
    business,
    pieces,
    routeCount: routes.length,
    perZip: zipTotals,
    messages,
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

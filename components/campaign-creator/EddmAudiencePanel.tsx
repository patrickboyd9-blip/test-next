"use client"

import { useEffect, useMemo, useState } from "react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { eddmBlockedReason } from "@/lib/eddm/copy"
import { eddmDisplayName, type EddmSize } from "@/lib/eddm/geometry"
import {
  routeMatchesFilter,
  routePieces,
  snapshotRoute,
  summarizeSelection,
  type EddmAudience,
  type EddmCoverage,
  type EddmFilters,
  type EddmRoute,
} from "@/lib/eddm/routes"
import type { AudienceDefinition } from "@/lib/campaign-creator/types"

import { EddmRouteMap } from "./EddmRouteMap"

interface EddmAudiencePanelProps {
  audience: AudienceDefinition | undefined
  briefText: string
  readOnly: boolean
  onChange: (audience: AudienceDefinition) => void
}

const EMPTY_EDDM: EddmAudience = {
  query: "",
  zip: "",
  coverage: "residential",
  size: "6.5x9",
  filters: {},
  selectedRouteIds: [],
  routes: [],
}

export function EddmAudiencePanel({ audience, briefText, readOnly, onChange }: EddmAudiencePanelProps) {
  const eddm = audience?.eddm ?? EMPTY_EDDM
  const blocked = eddmBlockedReason(briefText)
  const [query, setQuery] = useState(eddm.query || eddm.zip)
  const [neighborhood, setNeighborhood] = useState(eddm.neighborhood ?? "")
  const [routes, setRoutes] = useState<EddmRoute[]>([])
  const [loading, setLoading] = useState(false)
  const [notice, setNotice] = useState("")

  useEffect(() => {
    if (!eddm.zip) return
    let cancelled = false
    void loadRoutes(eddm.zip).then((result) => {
      if (cancelled || !result) return
      setRoutes(result.routes)
      if (result.message) setNotice(result.message)
    })
    return () => {
      cancelled = true
    }
  }, [eddm.zip])

  const visible = useMemo(
    () => routes.filter((route) => routeMatchesFilter(route, eddm.filters)),
    [routes, eddm.filters]
  )
  const selected = routes.length
    ? eddm.routes.filter((route) => visible.some((item) => item.id === route.id))
    : eddm.routes
  const summary = summarizeSelection(selected, eddm.coverage)

  function commit(next: EddmAudience, description?: string) {
    const kept = next.routes.filter((route) =>
      routeMatchesFilter(route, next.filters)
    )
    const audienceNext: EddmAudience = {
      ...next,
      routes: kept,
      selectedRouteIds: kept.map((route) => route.id),
    }
    onChange({
      description: description ?? audience?.description ?? "Every door in this area",
      quantity: summarizeSelection(kept, audienceNext.coverage).pieces || undefined,
      delivery: "eddm",
      eddm: audienceNext,
    })
  }

  async function showRoutes() {
    setLoading(true)
    setNotice("")
    const result = await loadRoutes(query)
    setLoading(false)
    if (!result) {
      setNotice("Route data isn't available right now. You can try this ZIP again in a little while.")
      return
    }
    setRoutes(result.routes)
    setNotice(result.message)
    if (result.ok) {
      commit(
        { ...eddm, query, zip: result.zip },
        eddm.neighborhood?.trim()
          ? `Neighbors in ${eddm.neighborhood.trim()}`
          : `Every door on the selected routes in ${result.zip}`
      )
    }
  }

  function toggle(routeId: string) {
    const route = visible.find((item) => item.id === routeId)
    if (!route) return
    const exists = eddm.routes.some((item) => item.id === routeId)
    const routesNext = exists
      ? eddm.routes.filter((item) => item.id !== routeId)
      : [...eddm.routes, snapshotRoute(route)]
    commit({ ...eddm, routes: routesNext, selectedRouteIds: routesNext.map((item) => item.id) })
  }

  function setFilter(patch: Partial<EddmFilters>) {
    commit({ ...eddm, filters: cleanFilters({ ...eddm.filters, ...patch }) })
  }

  if (blocked) {
    return (
      <p className="rounded-lg border bg-muted/40 p-3 text-sm" role="status">
        {blocked}
      </p>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2 sm:flex-row">
        <label className="flex flex-1 flex-col gap-1.5 text-sm font-medium">
          ZIP code or address
          <Input
            value={query}
            disabled={readOnly}
            placeholder="10001 or 350 5th Ave, New York"
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault()
                void showRoutes()
              }
            }}
          />
        </label>
        <Button
          type="button"
          className="sm:mt-6"
          variant="outline"
          disabled={readOnly || loading || !query.trim()}
          onClick={() => void showRoutes()}
        >
          {loading ? "Looking up routes…" : "Show routes"}
        </Button>
      </div>

      {notice && (
        <p className="text-sm text-muted-foreground" role="status">
          {notice}
        </p>
      )}

      <fieldset className="flex flex-col gap-2" disabled={readOnly}>
        <legend className="text-sm font-medium">Card size</legend>
        <div className="flex flex-wrap gap-2">
          {(["6.5x9", "6.25x11"] as const).map((size) => (
            <Choice
              key={size}
              pressed={eddm.size === size}
              label={eddmDisplayName(size)}
              onClick={() => commit({ ...eddm, size })}
            />
          ))}
        </div>
      </fieldset>

      <fieldset className="flex flex-col gap-2" disabled={readOnly}>
        <legend className="text-sm font-medium">Who receives a piece</legend>
        <div className="flex flex-wrap gap-2">
          <Choice
            pressed={eddm.coverage === "residential"}
            label="Residential only"
            onClick={() => commit({ ...eddm, coverage: "residential" satisfies EddmCoverage })}
          />
          <Choice
            pressed={eddm.coverage === "residential_and_business"}
            label="Residential and business"
            onClick={() => commit({ ...eddm, coverage: "residential_and_business" })}
          />
        </div>
      </fieldset>

      <fieldset className="grid gap-3 sm:grid-cols-3" disabled={readOnly}>
        <legend className="col-span-full text-sm font-medium">Route filters</legend>
        <FilterPair
          label="Median age"
          min={eddm.filters.minMedianAge}
          max={eddm.filters.maxMedianAge}
          onMin={(value) => setFilter({ minMedianAge: value })}
          onMax={(value) => setFilter({ maxMedianAge: value })}
        />
        <FilterPair
          label="Median income"
          min={eddm.filters.minMedianIncome}
          max={eddm.filters.maxMedianIncome}
          onMin={(value) => setFilter({ minMedianIncome: value })}
          onMax={(value) => setFilter({ maxMedianIncome: value })}
        />
        <FilterPair
          label="Household size"
          min={eddm.filters.minHouseholdSize}
          max={eddm.filters.maxHouseholdSize}
          step="0.1"
          onMin={(value) => setFilter({ minHouseholdSize: value })}
          onMax={(value) => setFilter({ maxHouseholdSize: value })}
        />
        <p className="col-span-full text-sm text-muted-foreground">
          Routes without a figure stay on the map. A blank field does not remove them.
        </p>
      </fieldset>

      <label className="flex flex-col gap-1.5 text-sm font-medium">
        Neighborhood name
        <Input
          value={neighborhood}
          disabled={readOnly}
          placeholder="Maple Ridge"
          onChange={(event) => setNeighborhood(event.target.value)}
          onBlur={() => {
            if (neighborhood === (eddm.neighborhood ?? "")) return
            commit(
              { ...eddm, neighborhood },
              neighborhood.trim() ? `Neighbors in ${neighborhood.trim()}` : audience?.description
            )
          }}
        />
      </label>

      {routes.length > 0 && (
        <>
          <EddmRouteMap routes={visible} selectedIds={eddm.selectedRouteIds} onToggle={toggle} />
          <ul className="flex max-h-64 flex-col gap-1 overflow-auto rounded-lg border p-2">
            {visible.map((route) => {
              const checked = eddm.selectedRouteIds.includes(route.id)
              const pieces = routePieces(route, eddm.coverage)
              return (
                <li key={route.id}>
                  <label className="flex cursor-pointer items-start gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted/50">
                    <input
                      type="checkbox"
                      className="mt-1"
                      checked={checked}
                      disabled={readOnly}
                      onChange={() => toggle(route.id)}
                    />
                    <span className="flex flex-1 flex-col">
                      <span className="font-medium">
                        Route {route.route} · {route.cityState || route.zip}
                      </span>
                      <span className="text-muted-foreground">
                        {route.residential.toLocaleString("en-US")} residential · {route.business.toLocaleString("en-US")} business · {pieces.toLocaleString("en-US")} pieces
                        {route.medianAge !== null ? ` · age ${Math.round(route.medianAge)}` : ""}
                        {route.medianIncome !== null ? ` · income $${Math.round(route.medianIncome).toLocaleString("en-US")}` : ""}
                        {route.householdSize !== null ? ` · household ${route.householdSize.toFixed(1)}` : ""}
                      </span>
                    </span>
                  </label>
                </li>
              )
            })}
          </ul>
        </>
      )}

      <div className="grid gap-3 rounded-lg border bg-muted/30 p-3 sm:grid-cols-4">
        <Stat label="Residential" value={summary.residential.toLocaleString("en-US")} />
        <Stat label="Business" value={summary.business.toLocaleString("en-US")} />
        <Stat label="Pieces" value={summary.pieces.toLocaleString("en-US")} />
        <Stat label={summary.postage.label} value={summary.postage.amountLabel} />
        <p className="text-sm text-muted-foreground sm:col-span-4">{summary.postage.detail}</p>
      </div>

      <div className="rounded-lg border bg-white p-3 text-sm">
        <div className="flex items-start justify-between gap-3">
          <span className="text-muted-foreground">Return address</span>
          <span className="font-medium tracking-wide">POSTAL CUSTOMER</span>
          <span className="border px-2 py-1 text-center text-xs leading-tight tracking-wide">
            ECRWSS
            <br />
            EDDM RETAIL
          </span>
        </div>
        <p className="mt-3 text-muted-foreground">
          The address side says Postal Customer. The indicia sits above and to the right. The offer speaks to the neighborhood, with no first name. Card size {eddmDisplayName(eddm.size as EddmSize)}.
        </p>
      </div>

      {summary.messages.map((message) => (
        <p key={message} className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm" role="status">
          {message}
        </p>
      ))}
    </div>
  )
}

async function loadRoutes(query: string): Promise<{
  ok: boolean
  zip: string
  routes: EddmRoute[]
  message: string
} | null> {
  try {
    const response = await fetch(`/api/eddm/routes?q=${encodeURIComponent(query)}`)
    if (!response.ok) return null
    return (await response.json()) as {
      ok: boolean
      zip: string
      routes: EddmRoute[]
      message: string
    }
  } catch {
    return null
  }
}

function cleanFilters(filters: EddmFilters): EddmFilters {
  const next: EddmFilters = {}
  for (const key of Object.keys(filters) as (keyof EddmFilters)[]) {
    const value = filters[key]
    if (value !== undefined && Number.isFinite(value)) next[key] = value
  }
  return next
}

function Choice({
  pressed,
  label,
  onClick,
}: {
  pressed: boolean
  label: string
  onClick: () => void
}) {
  return (
    <Button type="button" variant={pressed ? "default" : "outline"} aria-pressed={pressed} onClick={onClick}>
      {label}
    </Button>
  )
}

function FilterPair({
  label,
  min,
  max,
  step,
  onMin,
  onMax,
}: {
  label: string
  min?: number
  max?: number
  step?: string
  onMin: (value: number | undefined) => void
  onMax: (value: number | undefined) => void
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-sm font-medium">{label}</span>
      <div className="grid grid-cols-2 gap-2">
        <Input
          type="number"
          inputMode="decimal"
          step={step}
          placeholder="Min"
          aria-label={`${label} minimum`}
          value={min ?? ""}
          onChange={(event) => onMin(event.target.value === "" ? undefined : Number(event.target.value))}
        />
        <Input
          type="number"
          inputMode="decimal"
          step={step}
          placeholder="Max"
          aria-label={`${label} maximum`}
          value={max ?? ""}
          onChange={(event) => onMax(event.target.value === "" ? undefined : Number(event.target.value))}
        />
      </div>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-lg font-medium">{value}</p>
    </div>
  )
}

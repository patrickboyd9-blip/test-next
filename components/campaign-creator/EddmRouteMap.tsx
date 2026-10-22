"use client"

import { useEffect, useRef, useState } from "react"
import "leaflet/dist/leaflet.css"

import type { EddmRoute } from "@/lib/eddm/routes"

interface EddmRouteMapProps {
  routes: readonly EddmRoute[]
  selectedIds: readonly string[]
  onToggle: (routeId: string) => void
}

/**
 * Carrier-route lines on OpenStreetMap. Leaflet is loaded in the browser
 * because it reads window during setup.
 */
export function EddmRouteMap({ routes, selectedIds, onToggle }: EddmRouteMapProps) {
  const holder = useRef<HTMLDivElement>(null)
  const mapRef = useRef<import("leaflet").Map | null>(null)
  const onToggleRef = useRef(onToggle)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    onToggleRef.current = onToggle
  }, [onToggle])

  useEffect(() => {
    const node = holder.current
    if (!node) return
    let cancelled = false
    let map: import("leaflet").Map | null = null
    void import("leaflet").then((leaflet) => {
      if (cancelled || !holder.current) return
      const L = leaflet.default
      map = L.map(holder.current, { zoomControl: true })
      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      }).addTo(map)
      map.setView([39.8, -98.5], 4)
      mapRef.current = map
      window.setTimeout(() => map?.invalidateSize(), 50)
      setReady(true)
    })
    return () => {
      cancelled = true
      map?.remove()
      mapRef.current = null
      setReady(false)
    }
  }, [])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !ready) return
    let cancelled = false
    const selected = new Set(selectedIds)
    void import("leaflet").then((leaflet) => {
      if (cancelled || !mapRef.current) return
      const L = leaflet.default
      map.eachLayer((layer) => {
        if (!(layer instanceof L.TileLayer)) layer.remove()
      })
      const bounds = L.latLngBounds([])
      for (const route of routes) {
        const points = route.lines.flat()
        if (points.length < 2) continue
        const chosen = selected.has(route.id)
        const line = L.polyline(
          points.map(([lng, lat]) => [lat, lng] as [number, number]),
          {
            color: chosen ? "#1e3a5f" : "#94a3b8",
            weight: chosen ? 5 : 3,
            opacity: chosen ? 0.95 : 0.7,
          }
        )
        line.on("click", () => onToggleRef.current(route.id))
        line.bindTooltip(`${route.route} · ${route.residential.toLocaleString("en-US")} homes`)
        line.addTo(map)
        bounds.extend(line.getBounds())
      }
      if (bounds.isValid()) map.fitBounds(bounds.pad(0.2))
      map.invalidateSize()
    })
    return () => {
      cancelled = true
    }
  }, [ready, routes, selectedIds])

  return (
    <div
      ref={holder}
      className="h-80 w-full overflow-hidden rounded-lg border bg-muted"
      role="application"
      aria-label="Carrier routes"
    />
  )
}

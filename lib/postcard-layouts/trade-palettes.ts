/**
 * One palette per trade (gold industry slug) for the photo-led Pro layouts.
 * Roofing keeps navy and yellow; every other trade gets its own colors so a
 * dentist's card never looks like a roofer's. Each ink clears 4.5:1 on its tile.
 */
import { paletteById, type VerticalPalette } from "./palette"

type Colors = Pick<VerticalPalette, "field" | "scrim" | "offerTile" | "offerInk" | "accent" | "accentInk"> & Partial<VerticalPalette>

const T: Record<string, Colors> = {
  plumbing: { field: "#0b3a4a", scrim: "#082a36", offerTile: "#f47b20", offerInk: "#1a0d02", accent: "#f47b20", accentInk: "#1a0d02" },
  hvac: { field: "#12355b", scrim: "#0c2540", offerTile: "#c8281e", offerInk: "#ffffff", accent: "#c8281e", accentInk: "#ffffff" },
  dental: { field: "#0e4f5c", scrim: "#0b3a44", offerTile: "#7fe0d0", offerInk: "#06292e", accent: "#1aa39a", accentInk: "#ffffff", paper: "#ffffff" },
  "real-estate-agents": { field: "#1f2a24", scrim: "#18221d", offerTile: "#c9a45c", offerInk: "#1a140a", accent: "#c9a45c", accentInk: "#1a140a", paper: "#faf8f4" },
  "home-buying": { field: "#1d3b2a", scrim: "#142a1e", offerTile: "#4cc27a", offerInk: "#0b1f12", accent: "#4cc27a", accentInk: "#0b1f12" },
  "mortgage-financial": { field: "#16324f", scrim: "#0f2338", offerTile: "#58b7a0", offerInk: "#06221b", accent: "#58b7a0", accentInk: "#06221b" },
  "pest-control": { field: "#1c3a1f", scrim: "#14291a", offerTile: "#9bd33c", offerInk: "#10200a", accent: "#9bd33c", accentInk: "#10200a" },
  landscaping: { field: "#234d20", scrim: "#183616", offerTile: "#e8d44d", offerInk: "#1d1a05", accent: "#e8d44d", accentInk: "#1d1a05" },
  "cleaning-pressure-washing": { field: "#0d4c7a", scrim: "#093657", offerTile: "#4fd1e8", offerInk: "#03232b", accent: "#4fd1e8", accentInk: "#03232b" },
  "junk-removal": { field: "#203040", scrim: "#16222e", offerTile: "#3ccf6e", offerInk: "#06200f", accent: "#3ccf6e", accentInk: "#06200f" },
  "moving-storage": { field: "#1e2f5c", scrim: "#152142", offerTile: "#ff8c3a", offerInk: "#1f0e02", accent: "#ff8c3a", accentInk: "#1f0e02" },
  "home-remodeling": { field: "#2e2a26", scrim: "#211e1b", offerTile: "#e0a95c", offerInk: "#1d1306", accent: "#e0a95c", accentInk: "#1d1306" },
  handyman: { field: "#263238", scrim: "#1b2428", offerTile: "#ff9f1c", offerInk: "#1f1200", accent: "#ff9f1c", accentInk: "#1f1200" },
  "garage-doors": { field: "#2a2f36", scrim: "#1e2227", offerTile: "#c62828", offerInk: "#ffffff", accent: "#c62828", accentInk: "#ffffff" },
  "windows-gutters-siding": { field: "#173a5e", scrim: "#102943", offerTile: "#7cc6fe", offerInk: "#06213a", accent: "#7cc6fe", accentInk: "#06213a" },
  solar: { field: "#0f3057", scrim: "#0a223e", offerTile: "#ffb703", offerInk: "#1f1500", accent: "#ffb703", accentInk: "#1f1500" },
  "home-security": { field: "#141e2c", scrim: "#0e1520", offerTile: "#2ec4b6", offerInk: "#03201d", accent: "#2ec4b6", accentInk: "#03201d" },
  "med-spa-chiro": { field: "#3a2440", scrim: "#2a1a2f", offerTile: "#e9c6d6", offerInk: "#2a1430", accent: "#e9c6d6", accentInk: "#2a1430", paper: "#fbf7f9" },
  "hair-salon": { field: "#2b1b2e", scrim: "#1f1321", offerTile: "#e8a0b4", offerInk: "#2a0f19", accent: "#e8a0b4", accentInk: "#2a0f19" },
  "vet-pet": { field: "#1d4e6b", scrim: "#15384d", offerTile: "#ffb547", offerInk: "#211400", accent: "#ffb547", accentInk: "#211400" },
  optometry: { field: "#183a5a", scrim: "#112a41", offerTile: "#5ec5f2", offerInk: "#04212f", accent: "#5ec5f2", accentInk: "#04212f" },
  "restaurants-food": { field: "#4a1f14", scrim: "#35160e", offerTile: "#f4b942", offerInk: "#201502", accent: "#f4b942", accentInk: "#201502" },
  bakery: { field: "#5a3020", scrim: "#402217", offerTile: "#f6d7b0", offerInk: "#3a1e10", accent: "#f6d7b0", accentInk: "#3a1e10", paper: "#fdf8f2" },
  "gyms-fitness": { field: "#141414", scrim: "#0d0d0d", offerTile: "#ff5a1f", offerInk: "#1f0800", accent: "#ff5a1f", accentInk: "#1f0800" },
  "tutoring-childcare": { field: "#24467a", scrim: "#1a3358", offerTile: "#ffd166", offerInk: "#241a00", accent: "#ef476f", accentInk: "#ffffff" },
  "churches-community": { field: "#2f2a4a", scrim: "#211d35", offerTile: "#e8c872", offerInk: "#221a04", accent: "#e8c872", accentInk: "#221a04" },
  laundromat: { field: "#1a5276", scrim: "#123a54", offerTile: "#a3e4f7", offerInk: "#05222c", accent: "#a3e4f7", accentInk: "#05222c" },
  "precious-metals": { field: "#1c1c1c", scrim: "#121212", offerTile: "#d4af37", offerInk: "#1a1400", accent: "#d4af37", accentInk: "#1a1400" },
  "retail-grand-openings": { field: "#3b1f5c", scrim: "#2a1642", offerTile: "#ff4f9a", offerInk: "#1f0612", accent: "#ff4f9a", accentInk: "#1f0612" },
  auto: { field: "#1b1b1f", scrim: "#121215", offerTile: "#e3262c", offerInk: "#ffffff", accent: "#e3262c", accentInk: "#ffffff" },
  "auto-insurance": { field: "#1f3a4a", scrim: "#1a2428", offerTile: "#2f6f68", offerInk: "#f7f4ef", accent: "#2f6f68", accentInk: "#f7f4ef" },
}

const ALIAS: Record<string, string> = {
  real_estate: "real-estate-agents",
  pest: "pest-control",
  "home-insurance": "auto-insurance",
  "life-insurance": "auto-insurance",
}

/** Palette for a Pro-layout card in this trade. Unknown trades fall back to roofing (unchanged behavior). */
export function tradePalette(trade: string | undefined | null): VerticalPalette {
  const base = paletteById("roofing")
  if (!trade || trade === "roofing") return base
  if (trade === "medicare" || trade === "medicare_insurance") return paletteById("medicare")
  const colors = T[trade] ?? T[ALIAS[trade] ?? ""]
  if (!colors) return { ...paletteById("general"), field: "#1c2433", scrim: "#141b27", offerTile: "#3fb6a8", offerInk: "#04201c" }
  return { ...base, ...colors }
}

export const TRADE_PALETTE_SLUGS = Object.keys(T)

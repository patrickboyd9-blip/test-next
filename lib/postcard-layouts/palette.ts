import type { VerticalPaletteId } from "./ids"

export interface VerticalPalette {
  id: VerticalPaletteId
  paper: string
  ink: string
  field: string
  fieldInk: string
  accent: string
  accentInk: string
  scrim: string
}

/**
 * Original palettes. Each ink is chosen to clear 4.5:1 on the color it sits on.
 * Medicare stays on warm paper. It does not use alarm red.
 */
export const VERTICAL_PALETTES: Record<VerticalPaletteId, VerticalPalette> = {
  roofing: {
    id: "roofing",
    paper: "#f4efe6",
    ink: "#1c1917",
    field: "#1c1917",
    fieldInk: "#f6f1e7",
    accent: "#9a4e1d",
    accentInk: "#fff8f2",
    scrim: "#1c1917",
  },
  plumbing: {
    id: "plumbing",
    paper: "#f3f6f5",
    ink: "#102226",
    field: "#0f3d45",
    fieldInk: "#f4f7f6",
    accent: "#7a5b0c",
    accentInk: "#fff8e8",
    scrim: "#0c2c32",
  },
  hvac: {
    id: "hvac",
    paper: "#f4f6f8",
    ink: "#12202c",
    field: "#14324a",
    fieldInk: "#f4f6f8",
    accent: "#8a5a10",
    accentInk: "#fff6e4",
    scrim: "#102433",
  },
  medicare: {
    id: "medicare",
    paper: "#f7f4ef",
    ink: "#1a2428",
    field: "#1f3a4a",
    fieldInk: "#f7f4ef",
    accent: "#2f6f68",
    accentInk: "#f7f4ef",
    scrim: "#1a2428",
  },
  real_estate: {
    id: "real_estate",
    paper: "#f6f3ee",
    ink: "#1a1f1c",
    field: "#1c2822",
    fieldInk: "#f6f3ee",
    accent: "#2f5d50",
    accentInk: "#f6f3ee",
    scrim: "#1c2822",
  },
  general: {
    id: "general",
    paper: "#f5f3ef",
    ink: "#161b24",
    field: "#1c2433",
    fieldInk: "#f5f3ef",
    accent: "#2f4f86",
    accentInk: "#f5f3ef",
    scrim: "#1c2433",
  },
}

export function paletteById(id: VerticalPaletteId): VerticalPalette {
  return VERTICAL_PALETTES[id]
}

export function contrastRatio(foreground: string, background: string): number {
  const hi = Math.max(luminance(foreground), luminance(background))
  const lo = Math.min(luminance(foreground), luminance(background))
  return (hi + 0.05) / (lo + 0.05)
}

function luminance(hex: string): number {
  const value = hex.replace("#", "")
  const channels = [0, 2, 4].map((index) => {
    const channel = Number.parseInt(value.slice(index, index + 2), 16) / 255
    return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * channels[0]! + 0.7152 * channels[1]! + 0.0722 * channels[2]!
}

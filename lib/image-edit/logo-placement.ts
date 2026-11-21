export const LOGO_PLACEMENTS = [
  "top-left",
  "top-right",
  "bottom-left",
  "bottom-right",
  "center-top",
  "replace-existing",
] as const

export type LogoPlacement = (typeof LOGO_PLACEMENTS)[number]

export function isLogoPlacement(value: string): value is LogoPlacement {
  return (LOGO_PLACEMENTS as readonly string[]).includes(value)
}

/** WCAG relative luminance, used as the print contrast floor. */

export function hexToRgb(hex: string): [number, number, number] {
  const value = hex.replace("#", "")
  return [
    Number.parseInt(value.slice(0, 2), 16),
    Number.parseInt(value.slice(2, 4), 16),
    Number.parseInt(value.slice(4, 6), 16),
  ]
}

export function relativeLuminance(hex: string): number {
  const channels = hexToRgb(hex).map((channel) => {
    const s = channel / 255
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * channels[0]! + 0.7152 * channels[1]! + 0.0722 * channels[2]!
}

export function contrastRatio(foreground: string, background: string): number {
  const lighter = Math.max(relativeLuminance(foreground), relativeLuminance(background))
  const darker = Math.min(relativeLuminance(foreground), relativeLuminance(background))
  return (lighter + 0.05) / (darker + 0.05)
}

export function inkForBackground(background: string): "#161616" | "#F7F4EE" {
  const black = contrastRatio("#161616", background)
  const white = contrastRatio("#F7F4EE", background)
  return black >= white ? "#161616" : "#F7F4EE"
}

export function isLight(hex: string): boolean {
  return relativeLuminance(hex) > 0.45
}

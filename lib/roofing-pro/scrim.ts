/**
 * A steep gradient so type sits on a dark field, not on a gray box.
 * Preview and print share this curve.
 */

export function steepScrimOpacity(t: number): number {
  if (t <= 0) return 0
  const knee = 0.22
  if (t < knee) return (t / knee) ** 1.1 * 0.82
  return Math.min(0.95, 0.82 + ((t - knee) / (1 - knee)) * 0.13)
}

export function steepScrimCss(hex: string): string {
  const clear = withAlpha(hex, 0)
  const mid = withAlpha(hex, 0.82)
  const solid = withAlpha(hex, 0.95)
  return `linear-gradient(to bottom, ${clear} 0%, ${mid} 22%, ${solid} 100%)`
}

/**
 * Darkness for a translucent veil over a photograph.
 * A saturated trade scrim (dental teal, pest green) blended over skin
 * prints as a yellow-green cast. This keeps the scrim's darkness and only
 * a trace of its hue. Solid fields and offer tiles keep the full trade color.
 */
export function photoVeilHex(hex: string): string {
  const raw = hex.replace("#", "")
  const r = Number.parseInt(raw.slice(0, 2), 16)
  const g = Number.parseInt(raw.slice(2, 4), 16)
  const b = Number.parseInt(raw.slice(4, 6), 16)
  const y = 0.2126 * r + 0.7152 * g + 0.0722 * b
  const keep = 0.18
  const dark = 0.55
  const channel = (n: number) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, "0")
  return `#${channel((y + (r - y) * keep) * dark)}${channel((y + (g - y) * keep) * dark)}${channel((y + (b - y) * keep) * dark)}`
}

function withAlpha(hex: string, alpha: number): string {
  const value = hex.replace("#", "")
  const r = Number.parseInt(value.slice(0, 2), 16)
  const g = Number.parseInt(value.slice(2, 4), 16)
  const b = Number.parseInt(value.slice(4, 6), 16)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

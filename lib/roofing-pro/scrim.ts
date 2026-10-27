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

function withAlpha(hex: string, alpha: number): string {
  const value = hex.replace("#", "")
  const r = Number.parseInt(value.slice(0, 2), 16)
  const g = Number.parseInt(value.slice(2, 4), 16)
  const b = Number.parseInt(value.slice(4, 6), 16)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

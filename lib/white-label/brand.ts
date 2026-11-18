/**
 * Per-account branding. The flag is on unless an account turns it off.
 * A custom domain is not stored here.
 */

export const STOCK_APP_NAME = "Modern Mail"
export const STOCK_ACCENT = "#5ce1ff"
export const POWERED_BY = "Powered by Modern Mail"

export interface WhiteLabelSettings {
  enabled: boolean
  appName: string
  accent: string
  hidePoweredBy: boolean
  supportEmail: string
  supportName: string
  logoDataUrl: string | null
  faviconDataUrl: string | null
}

export interface AppliedBrand {
  appName: string
  accent: string
  ink: string
  hidePoweredBy: boolean
  poweredBy: string | null
  supportEmail: string
  supportName: string
  logoDataUrl: string | null
  faviconDataUrl: string | null
  enabled: boolean
}

export function defaultWhiteLabel(): WhiteLabelSettings {
  return {
    enabled: true,
    appName: STOCK_APP_NAME,
    accent: STOCK_ACCENT,
    hidePoweredBy: false,
    supportEmail: "",
    supportName: "",
    logoDataUrl: null,
    faviconDataUrl: null,
  }
}

export function applyBrand(settings: WhiteLabelSettings | null): AppliedBrand {
  const source = settings?.enabled === false ? defaultWhiteLabel() : settings ?? defaultWhiteLabel()
  const off = settings?.enabled === false
  const accent = off ? STOCK_ACCENT : source.accent
  const hide = off ? false : source.hidePoweredBy
  return {
    enabled: settings?.enabled !== false,
    appName: off ? STOCK_APP_NAME : source.appName || STOCK_APP_NAME,
    accent,
    ink: accentInk(accent),
    hidePoweredBy: hide,
    poweredBy: hide ? null : POWERED_BY,
    supportEmail: off ? "" : source.supportEmail,
    supportName: off ? "" : source.supportName,
    logoDataUrl: off ? null : source.logoDataUrl,
    faviconDataUrl: off ? null : source.faviconDataUrl,
  }
}

export function parseWhiteLabel(
  input: Partial<WhiteLabelSettings> | undefined,
  previous: WhiteLabelSettings = defaultWhiteLabel()
): { ok: true; value: WhiteLabelSettings } | { ok: false; error: string } {
  const appName = clean(input?.appName) || previous.appName || STOCK_APP_NAME
  if (appName.length > 40) return { ok: false, error: "The app name needs to be 40 characters or fewer." }
  const accent = (input?.accent ?? previous.accent).trim()
  if (!/^#[0-9a-fA-F]{6}$/.test(accent)) return { ok: false, error: "Use a color like #5ce1ff." }
  const supportEmail = clean(input?.supportEmail)
  if (supportEmail && !/^[^\s@]+@[^\s@]+$/.test(supportEmail)) {
    return { ok: false, error: "The support email needs an @ and a domain." }
  }
  const supportName = clean(input?.supportName)
  if (supportName.length > 60) return { ok: false, error: "The support name needs to be 60 characters or fewer." }
  const logo = imageField(input?.logoDataUrl, previous.logoDataUrl)
  if (!logo.ok) return logo
  const favicon = imageField(input?.faviconDataUrl, previous.faviconDataUrl)
  if (!favicon.ok) return favicon
  return {
    ok: true,
    value: {
      enabled: input?.enabled !== false,
      appName,
      accent: accent.toLowerCase(),
      hidePoweredBy: input?.hidePoweredBy === true,
      supportEmail,
      supportName,
      logoDataUrl: logo.value,
      faviconDataUrl: favicon.value,
    },
  }
}

export function accentInk(hex: string): string {
  const value = Number.parseInt(hex.slice(1), 16)
  const red = (value >> 16) & 255
  const green = (value >> 8) & 255
  const blue = value & 255
  const luminance = (0.299 * red + 0.587 * green + 0.114 * blue) / 255
  return luminance > 0.62 ? "#041018" : "#f7fbff"
}

function imageField(
  next: string | null | undefined,
  previous: string | null
): { ok: true; value: string | null } | { ok: false; error: string } {
  if (next === undefined) return { ok: true, value: previous }
  if (next === null || next === "") return { ok: true, value: null }
  if (!next.startsWith("data:image/")) return { ok: false, error: "Use a PNG, JPG, or WebP." }
  if (next.length > 500_000) return { ok: false, error: "That image is too large. Use one under about 350 KB." }
  return { ok: true, value: next }
}

function clean(value: string | undefined): string {
  return (value ?? "").replace(/\s+/g, " ").trim()
}

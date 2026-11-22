import { click2MailKeepOuts, type Click2MailSize } from "@/lib/print-spec/click2mail-keep-outs"
import { buildPostcard5x8PrintSpec } from "@/lib/print-spec/postcard-5x8-print-spec"
import { buildPostcard6x9PrintSpec } from "@/lib/print-spec/postcard-6x9-print-spec"
import { overlaps, type InchRect } from "@/lib/tracking/qr-zone"

export const QR_MIN_INCHES = 0.75
export const QR_MAX_INCHES = 2.5
export const QR_MAX_COUNT = 2
export const QR_RECOMMENDATION = "Recommended: QR codes let you track who responds."
export const POSTAGE_BLOCKED_MESSAGE = "That spot is saved for the postage and address."
export const QR_WEBSITE_MISSING = "Add the website this code should open."

const CODE_ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789"
const SNAP_GAP_INCHES = 0.02

export type QrSide = "front" | "back"
export type QrFrame = "trim" | "canvas"
export type QrDestinationKind = "page" | "website"

export interface QrPageParts {
  call: boolean
  form: boolean
  booking: boolean
  bookingUrl: string | null
}

export interface PlacedQr {
  id: string
  code: string
  side: QrSide
  xInches: number
  yInches: number
  sizeInches: number
  destination: QrDestinationKind
  website: string
  phone: string
  parts: QrPageParts
}

export interface QrPlacementValue {
  enabled: boolean
  codes: PlacedQr[]
  blockedMessage: string
}

export interface PlacedBox {
  xInches: number
  yInches: number
  sizeInches: number
  /** True when the spot was moved out of the postage and address block. */
  blocked: boolean
  /** False when no legal spot exists. Callers keep the previous box. */
  legal: boolean
}

export interface FrameBox {
  widthInches: number
  heightInches: number
  bleedInches: number
}

const EMPTY_PARTS: QrPageParts = { call: false, form: false, booking: false, bookingUrl: null }

export function emptyPageParts(): QrPageParts {
  return { ...EMPTY_PARTS }
}

export function mintPlacementCode(random: () => number = Math.random): string {
  let out = ""
  for (let i = 0; i < 8; i += 1) {
    out += CODE_ALPHABET[Math.floor(random() * CODE_ALPHABET.length) % CODE_ALPHABET.length]
  }
  return out
}

export function qrScanUrl(origin: string, code: string): string {
  return `${origin.replace(/\/$/, "")}/q/${code}`
}

export function frameBox(size: Click2MailSize, frame: QrFrame): FrameBox {
  const spec = size === "6x9" ? buildPostcard6x9PrintSpec() : buildPostcard5x8PrintSpec()
  if (frame === "canvas") {
    return {
      widthInches: spec.artworkCanvasInches.widthInches,
      heightInches: spec.artworkCanvasInches.heightInches,
      bleedInches: spec.bleedInchesPerSide,
    }
  }
  return {
    widthInches: spec.finishedTrimInches.widthInches,
    heightInches: spec.finishedTrimInches.heightInches,
    bleedInches: 0,
  }
}

export function clampQrSize(sizeInches: number): number {
  if (!Number.isFinite(sizeInches)) return QR_MIN_INCHES
  return Math.min(QR_MAX_INCHES, Math.max(QR_MIN_INCHES, sizeInches))
}

export function qrRect(qr: { xInches: number; yInches: number; sizeInches: number }): InchRect {
  return {
    xInches: qr.xInches,
    yInches: qr.yInches,
    widthInches: qr.sizeInches,
    heightInches: qr.sizeInches,
  }
}

/** The front has no postage block. The back uses the shared keep-outs. */
export function qrHitsReserved(
  size: Click2MailSize,
  side: QrSide,
  qr: { xInches: number; yInches: number; sizeInches: number }
): boolean {
  if (side !== "back") return false
  const frame = frameBox(size, "trim")
  return click2MailKeepOuts(size, frame.widthInches, frame.heightInches).some((box) => overlaps(qrRect(qr), box))
}

export function placeQr(
  size: Click2MailSize,
  side: QrSide,
  desired: { xInches: number; yInches: number; sizeInches: number }
): PlacedBox {
  const sizeInches = clampQrSize(desired.sizeInches)
  const clamped = clampToTrim(size, { xInches: desired.xInches, yInches: desired.yInches, sizeInches })
  if (!qrHitsReserved(size, side, clamped)) {
    return { ...clamped, blocked: false, legal: true }
  }
  const snapped = snapClear(size, clamped)
  if (!snapped) return { ...clamped, blocked: true, legal: false }
  return { ...snapped, blocked: true, legal: true }
}

export function qrBoxPercent(
  size: Click2MailSize,
  frame: QrFrame,
  qr: { xInches: number; yInches: number; sizeInches: number }
): { left: number; top: number; width: number } {
  const box = frameBox(size, frame)
  return {
    left: ((box.bleedInches + qr.xInches) / box.widthInches) * 100,
    top: ((box.bleedInches + qr.yInches) / box.heightInches) * 100,
    width: (qr.sizeInches / box.widthInches) * 100,
  }
}

/** A full website address, or null when the text is not one. */
export function normalizeScanUrl(value: string): string | null {
  const trimmed = value.trim()
  if (!trimmed || /\s/.test(trimmed)) return null
  const withScheme = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`
  try {
    const url = new URL(withScheme)
    if (url.protocol !== "https:" && url.protocol !== "http:") return null
    if (!url.hostname.includes(".")) return null
    url.protocol = "https:"
    return url.toString()
  } catch {
    return null
  }
}

export function scanDestinationLine(qr: Pick<PlacedQr, "destination" | "website">): string {
  if (qr.destination === "website") {
    const site = normalizeScanUrl(qr.website)
    return `When someone scans this code, they'll go to: ${site ?? "your website"}`
  }
  return "When someone scans this code, they'll go to: a page we make for you"
}

export function qrShortLabel(qr: Pick<PlacedQr, "destination" | "website">): string {
  if (qr.destination === "website") {
    const site = normalizeScanUrl(qr.website)
    if (!site) return "your website"
    try {
      return new URL(site).hostname.replace(/^www\./, "")
    } catch {
      return "your website"
    }
  }
  return "your page"
}

export function initialQrPlacement(size: Click2MailSize, website: string, phone = ""): QrPlacementValue {
  return {
    enabled: true,
    blockedMessage: "",
    codes: [makeQr(size, "front", website, phone)],
  }
}

export function setQrEnabled(
  value: QrPlacementValue,
  enabled: boolean,
  size: Click2MailSize,
  website: string,
  phone = ""
): QrPlacementValue {
  if (!enabled) return { ...value, enabled: false, blockedMessage: "" }
  if (value.codes.length > 0) return { ...value, enabled: true, blockedMessage: "" }
  return initialQrPlacement(size, website, phone)
}

export function addQrCode(value: QrPlacementValue, size: Click2MailSize, website: string, phone = ""): QrPlacementValue {
  if (value.codes.length >= QR_MAX_COUNT) return value
  const side: QrSide = value.codes.some((code) => code.side === "front") ? "back" : "front"
  const yInches = side === "back" && value.codes.some((code) => code.side === "back") ? 1.5 : 0.4
  return {
    enabled: true,
    blockedMessage: "",
    codes: [...value.codes, makeQr(size, side, website, phone, yInches)],
  }
}

export function removeQrCode(value: QrPlacementValue, id: string): QrPlacementValue {
  const codes = value.codes.filter((code) => code.id !== id)
  return { enabled: codes.length > 0, codes, blockedMessage: "" }
}

export function moveQr(value: QrPlacementValue, size: Click2MailSize, id: string, xInches: number, yInches: number): QrPlacementValue {
  const code = value.codes.find((item) => item.id === id)
  if (!code) return value
  return applyBox(value, id, code.side, placeQr(size, code.side, { xInches, yInches, sizeInches: code.sizeInches }))
}

export function resizeQr(value: QrPlacementValue, size: Click2MailSize, id: string, sizeInches: number): QrPlacementValue {
  const code = value.codes.find((item) => item.id === id)
  if (!code) return value
  return applyBox(value, id, code.side, placeQr(size, code.side, { xInches: code.xInches, yInches: code.yInches, sizeInches }))
}

export function setQrSide(value: QrPlacementValue, size: Click2MailSize, id: string, side: QrSide): QrPlacementValue {
  const code = value.codes.find((item) => item.id === id)
  if (!code) return value
  return applyBox(value, id, side, placeQr(size, side, code))
}

export function setQrChoice(
  value: QrPlacementValue,
  id: string,
  choice: QrDestinationKind,
  website: string,
  parts: QrPageParts,
  phone: string
): QrPlacementValue {
  return {
    ...value,
    codes: value.codes.map((code) =>
      code.id === id
        ? {
            ...code,
            destination: choice,
            website,
            phone,
            parts: {
              call: parts.call === true,
              form: parts.form === true,
              booking: parts.booking === true,
              bookingUrl: parts.bookingUrl?.trim() || null,
            },
          }
        : code
    ),
  }
}

export function activeQrs(value: QrPlacementValue): PlacedQr[] {
  if (!value.enabled) return []
  return value.codes.slice(0, QR_MAX_COUNT)
}

export interface SanitizedQr extends PlacedQr {
  scanWebsite: string | null
}

/** Trust the card, not the request. Illegal spots and a third code do not print. */
export function sanitizePlacedQrs(
  size: Click2MailSize,
  raw: unknown
): { ok: true; codes: SanitizedQr[] } | { ok: false; message: string } {
  if (!Array.isArray(raw)) return { ok: true, codes: [] }
  if (raw.length > QR_MAX_COUNT) return { ok: false, message: "A card can have two QR codes." }
  const codes: SanitizedQr[] = []
  for (const item of raw) {
    if (!item || typeof item !== "object") return { ok: false, message: POSTAGE_BLOCKED_MESSAGE }
    const row = item as Record<string, unknown>
    const side: QrSide = row.side === "back" ? "back" : "front"
    const placed = placeQr(size, side, {
      xInches: numberOf(row.xInches),
      yInches: numberOf(row.yInches),
      sizeInches: numberOf(row.sizeInches),
    })
    if (!placed.legal || qrHitsReserved(size, side, placed)) {
      return { ok: false, message: POSTAGE_BLOCKED_MESSAGE }
    }
    const destination: QrDestinationKind = row.destination === "website" ? "website" : "page"
    const website = typeof row.website === "string" ? row.website : ""
    const scanWebsite = normalizeScanUrl(website)
    if (destination === "website" && !scanWebsite) return { ok: false, message: QR_WEBSITE_MISSING }
    const parts = partsOf(row.parts)
    codes.push({
      id: typeof row.id === "string" && row.id.trim() ? row.id.slice(0, 40) : mintPlacementCode(),
      code: codeOf(row.code),
      side,
      xInches: placed.xInches,
      yInches: placed.yInches,
      sizeInches: placed.sizeInches,
      destination,
      website,
      phone: typeof row.phone === "string" ? row.phone.slice(0, 40) : "",
      parts,
      scanWebsite,
    })
  }
  return { ok: true, codes }
}

function makeQr(size: Click2MailSize, side: QrSide, website: string, phone: string, yInches = 0.4): PlacedQr {
  const placed = placeQr(size, side, { xInches: 0.35, yInches, sizeInches: 1 })
  return {
    id: `qr-${mintPlacementCode()}`,
    code: mintPlacementCode(),
    side,
    xInches: placed.xInches,
    yInches: placed.yInches,
    sizeInches: placed.sizeInches,
    destination: "page",
    website,
    phone,
    parts: emptyPageParts(),
  }
}

function applyBox(value: QrPlacementValue, id: string, side: QrSide, placed: PlacedBox): QrPlacementValue {
  if (!placed.legal) return { ...value, blockedMessage: POSTAGE_BLOCKED_MESSAGE }
  return {
    ...value,
    blockedMessage: placed.blocked ? POSTAGE_BLOCKED_MESSAGE : "",
    codes: value.codes.map((code) =>
      code.id === id
        ? { ...code, side, xInches: placed.xInches, yInches: placed.yInches, sizeInches: placed.sizeInches }
        : code
    ),
  }
}

function clampToTrim(
  size: Click2MailSize,
  qr: { xInches: number; yInches: number; sizeInches: number }
): { xInches: number; yInches: number; sizeInches: number } {
  const frame = frameBox(size, "trim")
  const sizeInches = clampQrSize(qr.sizeInches)
  return {
    sizeInches,
    xInches: clamp(qr.xInches, 0, Math.max(0, frame.widthInches - sizeInches)),
    yInches: clamp(qr.yInches, 0, Math.max(0, frame.heightInches - sizeInches)),
  }
}

function snapClear(
  size: Click2MailSize,
  qr: { xInches: number; yInches: number; sizeInches: number }
): { xInches: number; yInches: number; sizeInches: number } | null {
  const frame = frameBox(size, "trim")
  const boxes = click2MailKeepOuts(size, frame.widthInches, frame.heightInches)
  const panel = boxes.find((box) => box.id === "mailing_panel")
  const strip = boxes.find((box) => box.id === "barcode_strip")
  if (!panel || !strip) return null
  const gap = SNAP_GAP_INCHES
  const candidates = [
    { xInches: panel.xInches - qr.sizeInches - gap, yInches: qr.yInches },
    { xInches: qr.xInches, yInches: strip.yInches - qr.sizeInches - gap },
    { xInches: panel.xInches - qr.sizeInches - gap, yInches: strip.yInches - qr.sizeInches - gap },
    { xInches: 0.35, yInches: 0.4 },
    { xInches: 0, yInches: 0 },
  ]
  let best: { xInches: number; yInches: number; sizeInches: number } | null = null
  let bestDist = Infinity
  for (const candidate of candidates) {
    const fitted = clampToTrim(size, { ...candidate, sizeInches: qr.sizeInches })
    if (qrHitsReserved(size, "back", fitted)) continue
    const dist = (fitted.xInches - qr.xInches) ** 2 + (fitted.yInches - qr.yInches) ** 2
    if (dist < bestDist) {
      best = fitted
      bestDist = dist
    }
  }
  return best
}

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min
  if (max < min) return min
  return Math.min(max, Math.max(min, value))
}

function numberOf(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : QR_MIN_INCHES
}

function codeOf(value: unknown): string {
  if (typeof value === "string" && new RegExp(`^[${CODE_ALPHABET}]{8}$`).test(value)) return value
  return mintPlacementCode()
}

function partsOf(value: unknown): QrPageParts {
  if (!value || typeof value !== "object") return emptyPageParts()
  const row = value as Record<string, unknown>
  const bookingUrl = typeof row.bookingUrl === "string" && row.bookingUrl.trim() ? row.bookingUrl.trim().slice(0, 200) : null
  return {
    call: row.call === true,
    form: row.form === true,
    booking: row.booking === true && Boolean(bookingUrl),
    bookingUrl,
  }
}

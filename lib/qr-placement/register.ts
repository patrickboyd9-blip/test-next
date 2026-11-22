import { availablePlacedCode, upsertPlacedQr } from "@/lib/analytics/store"

import { qrScanUrl, type SanitizedQr } from "./model"

export interface RegisteredQr {
  id: string
  code: string
  scanUrl: string
  side: SanitizedQr["side"]
  xInches: number
  yInches: number
  sizeInches: number
}

/**
 * One tracking code per placed QR. A scan of either code is counted,
 * then the person continues to that code's own page or website.
 */
export function registerPlacedQrs(input: {
  campaignId: string
  ownerId: string
  origin: string
  businessName: string
  headline: string
  offer: string
  phone: string
  codes: readonly SanitizedQr[]
}): RegisteredQr[] {
  const saved: RegisteredQr[] = []
  for (const code of input.codes) {
    const row = upsertPlacedQr({
      code: code.code,
      campaignId: input.campaignId,
      ownerId: input.ownerId,
      destination: code.destination === "website" ? "website" : "hosted",
      website: code.scanWebsite,
      phone: code.phone || input.phone,
      headline: input.headline,
      offer: input.offer,
      businessName: input.businessName,
      parts: code.parts,
    })
    if (!row) continue
    saved.push({
      id: code.id,
      code: row.code,
      scanUrl: qrScanUrl(input.origin, row.code),
      side: code.side,
      xInches: code.xInches,
      yInches: code.yInches,
      sizeInches: code.sizeInches,
    })
  }
  return saved
}

/** Uses the customer's code when it is free so the printed symbol matches the proof. */
export function assignScanCodes<T extends { code: string }>(codes: readonly T[]): T[] {
  return codes.map((code) => ({ ...code, code: availablePlacedCode(code.code) }))
}

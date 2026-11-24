"use server"

import { headers } from "next/headers"

import { sanitizePlacedQrs, type SanitizedQr } from "@/lib/qr-placement/model"
import { renderTrackedPostcardPdf } from "@/lib/qr-placement/print-file"
import { assignScanCodes, registerPlacedQrs } from "@/lib/qr-placement/register"

/**
 * Builds the Comet postcard print file and counts each code.
 * Nothing is mailed or charged. The conversation never receives the symbol.
 */
export async function prepareCometPrint(input: {
  size: "5x8" | "6x9"
  shop: string
  line: string
  phone: string
  qrs: unknown
}): Promise<{ ok: true; pdfBase64: string } | { ok: false; message: string }> {
  const size = input.size === "6x9" ? "6x9" : "5x8"
  const sanitized = sanitizePlacedQrs(size, input.qrs ?? [])
  if (!sanitized.ok) return { ok: false, message: sanitized.message }
  if (sanitized.codes.length === 0) return { ok: true, pdfBase64: "" }

  const origin = await requestOrigin()
  const codes = assignScanCodes(sanitized.codes)
  const campaignId = `preview-${codes[0]?.code ?? "comet"}`
  const registered = registerPlacedQrs({
    campaignId,
    ownerId: "preview",
    origin,
    businessName: clean(input.shop),
    headline: clean(input.line),
    offer: clean(input.line),
    phone: clean(input.phone),
    codes,
  })
  if (registered.length !== codes.length) {
    return { ok: false, message: "That QR code could not be saved. Try again." }
  }
  const printedCodes: SanitizedQr[] = codes.map((code) => {
    const row = registered.find((item) => item.id === code.id)
    return row ? { ...code, code: row.code } : code
  })

  try {
    const printed = await renderTrackedPostcardPdf({
      size,
      origin,
      codes: printedCodes,
      frontLines: [clean(input.shop), clean(input.line)].filter(Boolean),
      backLines: [clean(input.shop), clean(input.phone)].filter(Boolean),
    })
    return { ok: true, pdfBase64: Buffer.from(printed.pdf).toString("base64") }
  } catch {
    return { ok: false, message: "The print file could not be prepared." }
  }
}

async function requestOrigin(): Promise<string> {
  try {
    const headerList = await headers()
    const host = headerList.get("x-forwarded-host") ?? headerList.get("host") ?? "localhost:3000"
    const proto = headerList.get("x-forwarded-proto") ?? "http"
    return `${proto}://${host}`
  } catch {
    return "http://localhost:3000"
  }
}

function clean(value: string): string {
  return value.replace(/\s+/g, " ").trim().slice(0, 80)
}

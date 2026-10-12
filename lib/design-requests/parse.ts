import type {
  DesignRequestInput,
  DesignRequestSize,
  IncomingImage,
  ResponseMethod,
} from "./types"
import { DESIGN_REQUEST_SIZES, RESPONSE_METHODS } from "./types"

export interface ParsedDesignRequest {
  companyName: string
  address: string
  vibe: string
  offer: string
  responseMethods: ResponseMethod[]
  qrUrl?: string
  phone?: string
  websiteUrl?: string
  otherResponse?: string
  notes?: string
  size?: DesignRequestSize
}

export type ParseDesignRequestResult =
  | { ok: true; value: ParsedDesignRequest }
  | { ok: false; error: string }

const COMPANY_MAX = 120
const ADDRESS_MAX = 300
const VIBE_MAX = 200
const OFFER_MAX = 200
const OTHER_MAX = 200
const NOTES_MAX = 2000

export const DESIGN_REQUEST_IMAGE_TYPES = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
} as const

export type DesignRequestImageType = keyof typeof DESIGN_REQUEST_IMAGE_TYPES

export const MAX_DESIGN_REQUEST_IMAGE_BYTES = 8 * 1024 * 1024
export const MAX_DESIGN_REQUEST_IMAGES = 8

export function parseDesignRequest(input: DesignRequestInput | undefined): ParseDesignRequestResult {
  const companyName = clean(input?.companyName)
  const address = clean(input?.address)
  const vibe = clean(input?.vibe)
  const offer = clean(input?.offer)
  const notes = clean(input?.notes)
  const otherResponse = clean(input?.otherResponse)
  const methods = uniqueMethods(input?.responseMethods)

  if (!companyName) return { ok: false, error: "Add the company name." }
  if (companyName.length > COMPANY_MAX) return { ok: false, error: "Use a shorter company name." }
  if (!address) return { ok: false, error: "Add the company address." }
  if (address.length > ADDRESS_MAX) return { ok: false, error: "Use a shorter address." }
  if (!vibe) return { ok: false, error: "Describe the vibe you want." }
  if (vibe.length > VIBE_MAX) return { ok: false, error: "Use a shorter description of the vibe." }
  if (!offer) return { ok: false, error: "Add the specific offer." }
  if (offer.length > OFFER_MAX) return { ok: false, error: "Use a shorter offer." }
  if (methods.length === 0) return { ok: false, error: "Choose how people should respond." }

  let qrUrl: string | undefined
  let phone: string | undefined
  let websiteUrl: string | undefined

  if (methods.includes("qr")) {
    const url = asHttpUrl(input?.qrUrl)
    if (!url) return { ok: false, error: "Add the QR code link. Start it with https://." }
    qrUrl = url
  }
  if (methods.includes("phone")) {
    const digits = (input?.phone ?? "").replace(/\D/g, "")
    if (digits.length < 10) return { ok: false, error: "Add the phone number people should call." }
    phone = clean(input?.phone)
  }
  if (methods.includes("website")) {
    const url = asHttpUrl(input?.websiteUrl)
    if (!url) return { ok: false, error: "Add the website people should visit. Start it with https://." }
    websiteUrl = url
  }
  if (methods.includes("other")) {
    if (!otherResponse) return { ok: false, error: "Describe the other way people should respond." }
    if (otherResponse.length > OTHER_MAX) {
      return { ok: false, error: "Use a shorter description of the other response." }
    }
  }
  if (notes && notes.length > NOTES_MAX) return { ok: false, error: "Use a shorter note." }

  const sizeResult = parseSize(input?.size)
  if (!sizeResult.ok) return sizeResult

  return {
    ok: true,
    value: {
      companyName,
      address,
      vibe,
      offer,
      responseMethods: methods,
      qrUrl,
      phone,
      websiteUrl,
      otherResponse: methods.includes("other") ? otherResponse : undefined,
      notes: notes || undefined,
      size: sizeResult.size,
    },
  }
}

export function designRequestInputFromForm(formData: FormData): DesignRequestInput {
  return {
    companyName: stringField(formData, "companyName"),
    address: stringField(formData, "address"),
    vibe: stringField(formData, "vibe"),
    offer: stringField(formData, "offer"),
    responseMethods: formData.getAll("responseMethod").map((value) => String(value)),
    qrUrl: stringField(formData, "qrUrl"),
    phone: stringField(formData, "phone"),
    websiteUrl: stringField(formData, "websiteUrl"),
    otherResponse: stringField(formData, "otherResponse"),
    notes: stringField(formData, "notes"),
    size: stringField(formData, "size"),
  }
}

export function imageTypeFor(mediaType: string): DesignRequestImageType | null {
  if (mediaType === "image/jpg") return "image/jpeg"
  if (mediaType in DESIGN_REQUEST_IMAGE_TYPES) return mediaType as DesignRequestImageType
  return null
}

export function validateIncomingImage(image: IncomingImage, label: string): string | null {
  if (!image.bytes.byteLength) return `${label} is empty.`
  if (image.bytes.byteLength > MAX_DESIGN_REQUEST_IMAGE_BYTES) {
    return "Each image needs to be under 8 MB."
  }
  if (!imageTypeFor(image.mediaType)) return "Use a PNG, JPEG, or WebP image."
  return null
}

function parseSize(
  value: string | undefined
): { ok: true; size?: DesignRequestSize } | { ok: false; error: string } {
  const size = clean(value)
  if (!size) return { ok: true }
  if ((DESIGN_REQUEST_SIZES as readonly string[]).includes(size)) {
    return { ok: true, size: size as DesignRequestSize }
  }
  return { ok: false, error: "Choose 5×8 or 6×9, or leave the size blank." }
}

function uniqueMethods(values: string[] | undefined): ResponseMethod[] {
  const seen = new Set<ResponseMethod>()
  for (const value of values ?? []) {
    if ((RESPONSE_METHODS as readonly string[]).includes(value)) {
      seen.add(value as ResponseMethod)
    }
  }
  return RESPONSE_METHODS.filter((method) => seen.has(method))
}

function asHttpUrl(value: string | undefined): string | null {
  const trimmed = clean(value)
  if (!trimmed) return null
  try {
    const url = new URL(trimmed)
    if (url.protocol !== "http:" && url.protocol !== "https:") return null
    return url.toString()
  } catch {
    return null
  }
}

function stringField(formData: FormData, name: string): string {
  const value = formData.get(name)
  return typeof value === "string" ? value : ""
}

function clean(value: string | undefined): string {
  return (value ?? "").replace(/\s+/g, " ").trim()
}

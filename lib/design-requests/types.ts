import type { SanitizedQr } from "@/lib/qr-placement/model"

export const RESPONSE_METHODS = ["qr", "phone", "website", "other"] as const
export type ResponseMethod = (typeof RESPONSE_METHODS)[number]

export const DESIGN_REQUEST_SIZES = ["5x8", "6x9"] as const
export type DesignRequestSize = (typeof DESIGN_REQUEST_SIZES)[number]

export const RESPONSE_METHOD_LABELS: Record<ResponseMethod, string> = {
  qr: "QR code",
  phone: "Phone call",
  website: "Website",
  other: "Other",
}

export interface DesignRequestUpload {
  id: string
  role: "logo" | "image"
  fileName: string
  mediaType: "image/png" | "image/jpeg" | "image/webp"
  byteLength: number
  /** Storage key, such as `logo.png`. Not a public URL. */
  key: string
}

/** A request for the design team. Stored as one record. No email is sent. */
export interface DesignRequest {
  id: string
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
  /** Exact words the customer wants printed. Optional. */
  cardWords?: string
  /** Slogans or taglines. Optional. */
  slogans?: string
  size?: DesignRequestSize
  uploads: DesignRequestUpload[]
  /** Placed codes. Absent when the customer turned QR off, or on older requests. */
  qrCodes?: SanitizedQr[]
  /** Storage key of the print file that includes those codes. */
  printFileKey?: string
  createdAt: string
  /**
   * Account that submitted the request. Missing on records saved before
   * accounts existed. Those records are not listed and are not assigned here.
   */
  ownerId?: string
}

export interface DesignRequestInput {
  companyName?: string
  address?: string
  vibe?: string
  offer?: string
  responseMethods?: string[]
  qrUrl?: string
  phone?: string
  websiteUrl?: string
  otherResponse?: string
  notes?: string
  cardWords?: string
  slogans?: string
  size?: string
  /** JSON from the shared placement panel. Absent on the older link-only form. */
  qrs?: string
}

export interface IncomingImage {
  fileName: string
  mediaType: string
  bytes: Buffer
}

export interface DesignRequestFiles {
  logo?: IncomingImage | null
  images?: IncomingImage[]
}

import type { EddmSize } from "@/lib/eddm/geometry"

/** Vendor ids and timestamps stored on the campaign document. No credentials. */
export interface MailOrderProduct {
  documentClass: string
  layout: string
  paperType: string
  printOption: string
  mailClass: string
  productionTime: string
  color: string
}

export interface MailOrderRecord {
  id: string
  mode: "test" | "production"
  environment: "stage" | "prod"
  pieceCount: number
  estimatedCostLabel: string
  artwork: "final-photo" | "type-plate" | "uploaded-design"
  documentId?: string
  addressListId?: string
  addressListStatus?: number
  jobId?: string
  jobStatus?: string
  resultCode?: number
  resultDescription?: string
  proofId?: string
  proofDescription?: string
  submitted: boolean
  trackingPieceCount?: number
  /** Shown when the job was submitted near or after the 8:00 PM ET batch cutoff. */
  cutoffNote?: string
  product: MailOrderProduct
  error?: string
  createdAt: string
  updatedAt: string
  submittedAt?: string
  lastPolledAt?: string
  /** Present on an Every Door order. Addressed postcard orders omit it. */
  eddm?: {
    size: EddmSize
    routeCount: number
    postOfficeCount: number
    prepared: boolean
  }
}

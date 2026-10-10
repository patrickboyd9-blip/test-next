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
  artwork: "final-photo" | "type-plate"
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
  product: MailOrderProduct
  error?: string
  createdAt: string
  updatedAt: string
  submittedAt?: string
  lastPolledAt?: string
}

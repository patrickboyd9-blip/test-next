import type { Click2MailProductOptions } from "./config"
import type { ProductOptionRow } from "./product-options"
import type { Recipient } from "./recipients"

export interface PurchaseCreditInput {
  billingName: string
  billingAddress1: string
  billingCity: string
  billingState: string
  billingZip: string
  billingAmount: string
  billingNumber: string
  billingMonth: string
  billingYear: string
  billingCvv: string
  billingCcType: string
}

export interface CreditSnapshot {
  balance: number
  status: number | null
  description: string
}

/** Total from GET /jobs/{id}/cost, including tax. */
export interface JobCostSnapshot {
  total: number
  status: number | null
  description: string
}

export interface CreditPurchaseResult {
  status: number | null
  description: string
}

export interface DocumentCreated {
  id: string
  status: number | null
  description: string
  pages: string
}

export interface AddressListSnapshot {
  id: string
  status: number
  description: string
}

export interface ReturnAddress {
  rtnName?: string
  rtnOrganization?: string
  rtnaddress1?: string
  rtnaddress2?: string
  rtnCity?: string
  rtnState?: string
  rtnZip?: string
}

export interface JobDraft {
  documentId: string
  /** Omitted for Every Door jobs, which use quantity instead of an address list. */
  addressId?: string
  product: Click2MailProductOptions
  returnAddress?: ReturnAddress
  quantity?: number
}

export interface EddmMailerInfo {
  name: string
  organization?: string
  address: string
  address2?: string
  address3?: string
  city: string
  state: string
  zip: string
  phone?: string
}

export interface EddmRouteSubmission {
  poName: string
  route: string
  postalCode: string
  totalPieces: number
}

export interface EddmPostOfficeSubmission {
  name: string
  /** City, state, and ZIP when the feed has no street. */
  address: string
  city: string
  state: string
  zip: string
  hours?: string
  phone?: string
  totalPieces: number
  deliveryType: string
  routeType: string
}

export interface JobSnapshot {
  id: string
  status: number | null
  description: string
  jobStatus: string
}

export interface ProofSnapshot {
  id: string
  sessionId: string
  status: number | null
  description: string
  /** Present when Click2Mail returned the proof file itself. */
  bytes?: Uint8Array
}

export interface TrackingPiece {
  barCode: string
  address: string
  status: string
  dateTime: string
  statusLocation: string
}

export interface TrackingSnapshot {
  id: string
  status: number | null
  description: string
  pieces: TrackingPiece[]
}

export interface Click2MailClient {
  getCredit(): Promise<CreditSnapshot>
  /** Quoted job total for the payment type we will submit with. Includes tax. */
  getJobCost(jobId: string, paymentType: string): Promise<JobCostSnapshot>
  purchaseCredit(input: PurchaseCreditInput): Promise<CreditPurchaseResult>
  createDocument(input: {
    documentName: string
    documentFormat: string
    documentClass: string
    fileName: string
    bytes: Uint8Array<ArrayBufferLike>
  }): Promise<DocumentCreated>
  createAddressList(input: {
    name: string
    mappingId: string
    recipients: readonly Recipient[]
  }): Promise<AddressListSnapshot>
  getAddressList(id: string): Promise<AddressListSnapshot>
  createJob(input: JobDraft): Promise<JobSnapshot>
  /**
   * A job template is created in the Click2Mail staging site, then started
   * by name. The document and quantity are attached on the following update.
   */
  /** Valid combinations from GET /productOptions/advanced. Do not invent these strings. */
  getAdvancedProductOptions(): Promise<ProductOptionRow[]>
  createJobFromTemplate(input: {
    templateName: string
    documentId: string
    quantity: number
    /** Required on a Full Service Every Door job. Click2Mail holds the job without it. */
    crid?: string
  }): Promise<JobSnapshot>
  createProof(jobId: string): Promise<ProofSnapshot>
  getProof(jobId: string, proofId: string, sessionId: string): Promise<ProofSnapshot>
  submitJob(jobId: string, billingType: string): Promise<JobSnapshot>
  getJob(jobId: string): Promise<JobSnapshot>
  getTracking(jobId: string, trackingType?: string): Promise<TrackingSnapshot>
  /**
   * Every Door calls. Field names follow Click2Mail's EDDM Postman
   * collection and the REST reference. The customer's USPS CRID is sent
   * on the job update, which marks crid required for EDDM.
   */
  getEddm(jobId: string): Promise<JobSnapshot>
  setEddmInfo(jobId: string, info: EddmMailerInfo): Promise<JobSnapshot>
  setEddmRoute(jobId: string, route: EddmRouteSubmission): Promise<JobSnapshot>
  setEddmPostOffice(jobId: string, office: EddmPostOfficeSubmission): Promise<JobSnapshot>
  updateEddmJob(jobId: string, input: { crid: string; quantity: number }): Promise<JobSnapshot>
}

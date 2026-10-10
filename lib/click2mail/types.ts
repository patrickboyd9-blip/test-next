import type { Click2MailProductOptions } from "./config"
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
  addressId: string
  product: Click2MailProductOptions
  returnAddress?: ReturnAddress
  quantity?: number
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
  createProof(jobId: string): Promise<ProofSnapshot>
  getProof(jobId: string, proofId: string, sessionId: string): Promise<ProofSnapshot>
  submitJob(jobId: string, billingType: string): Promise<JobSnapshot>
  getJob(jobId: string): Promise<JobSnapshot>
  getTracking(jobId: string, trackingType?: string): Promise<TrackingSnapshot>
}

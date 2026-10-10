import type { Click2MailClient, JobDraft } from "./types"

/** In-memory Click2Mail stand-in for tests. It does not open a network connection. */
export function createMockClick2MailClient(options?: {
  addressStatuses?: number[]
}): Click2MailClient & { calls: string[]; lastJob?: JobDraft } {
  const calls: string[] = []
  const statuses = [...(options?.addressStatuses ?? [3])]
  const state: { lastJob?: JobDraft } = {}

  const client: Click2MailClient & { calls: string[]; lastJob?: JobDraft } = {
    calls,
    get lastJob() {
      return state.lastJob
    },
    async getCredit() {
      calls.push("getCredit")
      return { balance: 25, status: 0, description: "Success" }
    },
    async purchaseCredit() {
      calls.push("purchaseCredit")
      return { status: 0, description: "Success" }
    },
    async createDocument() {
      calls.push("createDocument")
      return { id: "doc-1", status: 0, description: "Success", pages: "2" }
    },
    async createAddressList() {
      calls.push("createAddressList")
      return { id: "list-1", status: statuses[0] ?? 0, description: "Uploaded" }
    },
    async getAddressList(id) {
      calls.push(`getAddressList:${id}`)
      const status = statuses.shift() ?? 3
      return { id, status, description: status >= 3 ? "CASS Standardized" : "Uploaded" }
    },
    async createJob(input) {
      calls.push("createJob")
      state.lastJob = input
      return { id: "job-1", status: 0, description: "Created", jobStatus: "EDITING" }
    },
    async createProof(jobId) {
      calls.push(`createProof:${jobId}`)
      return { id: "proof-1", sessionId: "session-1", status: 0, description: "Success" }
    },
    async getProof(jobId, proofId, sessionId) {
      calls.push(`getProof:${jobId}:${proofId}:${sessionId}`)
      return { id: proofId, sessionId, status: 0, description: "Proof file" }
    },
    async submitJob(jobId) {
      calls.push(`submitJob:${jobId}`)
      return { id: jobId, status: 0, description: "Success", jobStatus: "ORDER_SUBMITTED" }
    },
    async getJob(jobId) {
      calls.push(`getJob:${jobId}`)
      return { id: jobId, status: 0, description: "Success", jobStatus: "AWAITING_PRODUCTION" }
    },
    async getTracking(jobId) {
      calls.push(`getTracking:${jobId}`)
      return { id: jobId, status: 0, description: "Success", pieces: [] }
    },
  }

  return client
}

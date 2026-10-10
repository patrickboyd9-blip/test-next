/** Lifecycle strings Click2Mail documents for a job. Not product-option enums. */
export const JOB_LIFECYCLE = [
  "EDITING",
  "PROOF_ACCEPTED",
  "ORDER_SUBMITTED",
  "ORDER_PROCESSING",
  "AWAITING_PRODUCTION",
  "IN_PRODUCTION",
  "MAILED",
  "ERROR",
  "ON_HOLD",
] as const

export type JobLifecycle = (typeof JOB_LIFECYCLE)[number]

const LIFECYCLE_SET = new Set<string>(JOB_LIFECYCLE)

const PLAIN: Record<JobLifecycle, string> = {
  EDITING: "Created on Click2Mail, not submitted yet",
  PROOF_ACCEPTED: "Proof accepted",
  ORDER_SUBMITTED: "Submitted",
  ORDER_PROCESSING: "Click2Mail is processing the order",
  AWAITING_PRODUCTION: "Waiting for the printer",
  IN_PRODUCTION: "At the printer",
  MAILED: "Handed to the postal service",
  ERROR: "Click2Mail reported a problem",
  ON_HOLD: "Click2Mail paused this job",
}

/**
 * Numeric codes seen on a live staging GET /jobs/{id}.
 * Create responses still use status 0. Do not treat 4 as a failure.
 */
const CONFIRMED_STATUS_CODE: Partial<Record<number, JobLifecycle>> = {
  4: "AWAITING_PRODUCTION",
}

export function canonicalJobStatus(value: string | undefined): JobLifecycle | undefined {
  if (!value) return undefined
  const key = value.trim().toUpperCase().replace(/[\s-]+/g, "_")
  return LIFECYCLE_SET.has(key) ? (key as JobLifecycle) : undefined
}

/**
 * Create responses may include a `<jobStatus>` element. A later GET usually does not:
 * it returns a numeric `<status>` and a `<description>` such as "Awaiting Production".
 */
export function interpretVendorJob(input: {
  resultCode: number | null
  description?: string
  jobStatusField?: string
  fallback?: string
}): JobLifecycle | undefined {
  const fromField = canonicalJobStatus(input.jobStatusField)
  if (fromField) return fromField
  const fromDescription = canonicalJobStatus(input.description)
  if (fromDescription) return fromDescription
  if (input.resultCode !== null && input.resultCode !== undefined) {
    const fromCode = CONFIRMED_STATUS_CODE[input.resultCode]
    if (fromCode) return fromCode
  }
  return canonicalJobStatus(input.fallback)
}

export function jobStatusLabel(status: string | undefined): string {
  const canonical = canonicalJobStatus(status)
  if (!canonical) return "Waiting for a status"
  return PLAIN[canonical]
}

export function isTerminalJobStatus(status: string | undefined): boolean {
  const canonical = canonicalJobStatus(status)
  return canonical === "MAILED" || canonical === "ERROR" || canonical === "ON_HOLD"
}

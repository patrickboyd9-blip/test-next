import type { EddmSize } from "@/lib/eddm/geometry"
import type { EddmRouteSnapshot } from "@/lib/eddm/routes"

import type { Click2MailConfig } from "./config"
import { placeEddmOrder } from "./eddm-order"
import type { Click2MailClient, EddmMailerInfo } from "./types"

export interface StagingEddmRunResult {
  jobId?: string
  jobStatus?: string
  /** Click2Mail job total, including tax, when the cost call succeeded. */
  cost?: number
  submitted: boolean
  error?: string
}

/**
 * One Full Service Every Door order on Click2Mail staging, paid with User Credit.
 * Production is refused before any client call.
 */
export async function runStagingEddmOrder(input: {
  client: Click2MailClient
  config: Click2MailConfig
  pdf: Uint8Array
  size: EddmSize
  crid: string
  routes: readonly EddmRouteSnapshot[]
  mailer: EddmMailerInfo
  templateName?: string
  env?: NodeJS.ProcessEnv
}): Promise<StagingEddmRunResult> {
  if (input.config.environment !== "stage" || !input.config.baseUrl.includes("stage-rest.click2mail.com")) {
    return {
      submitted: false,
      error: "This check only talks to Click2Mail staging. Production is not called.",
    }
  }
  const env = { ...(input.env ?? process.env), C2M_EDDM_BILLING_TYPE: "User Credit" }
  const order = await placeEddmOrder({
    client: input.client,
    config: input.config,
    pdf: input.pdf,
    size: input.size,
    coverage: "residential",
    routes: input.routes,
    mailer: input.mailer,
    crid: input.crid,
    submitEnabled: true,
    paymentCleared: true,
    documentName: "mm-eddm-stage",
    artwork: "type-plate",
    submit: true,
    proof: false,
    jobTemplateName: input.templateName,
    env,
  })
  return {
    jobId: order.jobId,
    jobStatus: order.jobStatus,
    cost: order.eddm?.vendorCost,
    submitted: order.submitted,
    error: order.error,
  }
}

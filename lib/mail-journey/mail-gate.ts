import type { MailJob } from "./job"

export interface LiveGate {
  payment: "off" | "staging" | "live"
  mail: "off" | "staging" | "live"
}

export function readLiveGate(env: NodeJS.ProcessEnv = process.env): LiveGate {
  return {
    payment: env.PAYMENT_MODE === "live" ? "live" : env.PAYMENT_MODE === "staging" ? "staging" : "off",
    mail: env.MAIL_MODE === "live" ? "live" : env.MAIL_MODE === "staging" ? "staging" : "off",
  }
}

export interface MailAttempt {
  mailed: false
  externalCalls: 0
  message: string
}

/**
 * Pay is required, and this build still does not send.
 * There is no alternate sender.
 */
export function attemptMail(job: MailJob, gate: LiveGate = readLiveGate()): MailAttempt {
  if (job.state === "payment_unknown" || job.state === "held") {
    return {
      mailed: false,
      externalCalls: 0,
      message: "This payment is held for reconciliation. It was not submitted again and nothing was mailed.",
    }
  }
  if (job.state !== "paid") {
    return {
      mailed: false,
      externalCalls: 0,
      message: "Mail waits for a verified payment. Nothing was sent.",
    }
  }
  if (gate.payment !== "live" || gate.mail !== "live") {
    return {
      mailed: false,
      externalCalls: 0,
      message: "Mailing is turned off on this server. Nothing was sent.",
    }
  }
  return {
    mailed: false,
    externalCalls: 0,
    message: "Live mailing is not connected in this build. Nothing was sent.",
  }
}

export const PRINT_TEST_REFUSAL =
  "Mail is not sent from this step. Review the proof and the list, then pay from the order page after a price is configured. Nothing was sent."

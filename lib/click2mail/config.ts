import { Click2MailError } from "./errors"
import type { PrintMailMode } from "./mode"

export const STAGE_BASE_URL = "https://stage-rest.click2mail.com/molpro"
/** Probable production host. Override with C2M_BASE_URL if Click2Mail publishes a different one. */
export const PROD_BASE_URL = "https://rest.click2mail.com/molpro"

/**
 * Defaults are the postcard strings from our research.
 * Click2Mail does not publish the enum, so every one of these can be replaced
 * with an environment variable without a code change.
 */
export interface Click2MailProductOptions {
  documentFormat: string
  documentClass: string
  layout: string
  productionTime: string
  envelope: string
  color: string
  paperType: string
  printOption: string
  mailClass: string
  addressMappingId: string
  billingType: string
}

export const DEFAULT_PRODUCT: Click2MailProductOptions = {
  documentFormat: "PDF",
  documentClass: "Postcard 5 x 8",
  layout: "Double Sided Postcard",
  productionTime: "Next Day",
  envelope: "",
  color: "Full Color",
  paperType: "White Matte with Gloss UV Finish",
  printOption: "Printing both sides",
  mailClass: "First Class",
  addressMappingId: "1",
  billingType: "User Credit",
}

export interface Click2MailConfig {
  environment: "stage" | "prod"
  baseUrl: string
  username: string
  password: string
  allowProduction: boolean
  addressListReadyMinStatus: number
  addressListErrorStatus: number
  product: Click2MailProductOptions
}

function readEnvironment(value: string | undefined): "stage" | "prod" {
  const normalized = (value ?? "stage").trim().toLowerCase()
  if (normalized === "stage" || normalized === "staging") return "stage"
  if (normalized === "prod" || normalized === "production") return "prod"
  throw new Click2MailError("C2M_ENV must be stage or prod.")
}

function readInt(value: string | undefined, fallback: number): number {
  if (value === undefined || value.trim() === "") return fallback
  const parsed = Number(value)
  if (!Number.isInteger(parsed)) {
    throw new Click2MailError("A Click2Mail status setting must be a whole number.")
  }
  return parsed
}

function textOr(value: string | undefined, fallback: string): string {
  const trimmed = value?.trim()
  return trimmed ? trimmed : fallback
}

export function loadClick2MailConfig(env: NodeJS.ProcessEnv = process.env): Click2MailConfig {
  const environment = readEnvironment(env.C2M_ENV)
  const baseUrl = textOr(
    env.C2M_BASE_URL,
    environment === "prod" ? PROD_BASE_URL : STAGE_BASE_URL
  ).replace(/\/$/, "")

  return {
    environment,
    baseUrl,
    username: env.C2M_USERNAME?.trim() ?? "",
    password: env.C2M_PASSWORD ?? "",
    allowProduction: env.C2M_ALLOW_PRODUCTION?.trim() === "true",
    addressListReadyMinStatus: readInt(env.C2M_ADDRESS_LIST_READY_MIN, 3),
    addressListErrorStatus: readInt(env.C2M_ADDRESS_LIST_ERROR_STATUS, 9),
    product: {
      documentFormat: textOr(env.C2M_DOCUMENT_FORMAT, DEFAULT_PRODUCT.documentFormat),
      documentClass: textOr(env.C2M_DOCUMENT_CLASS, DEFAULT_PRODUCT.documentClass),
      layout: textOr(env.C2M_LAYOUT, DEFAULT_PRODUCT.layout),
      productionTime: textOr(env.C2M_PRODUCTION_TIME, DEFAULT_PRODUCT.productionTime),
      envelope:
        env.C2M_ENVELOPE !== undefined ? env.C2M_ENVELOPE.trim() : DEFAULT_PRODUCT.envelope,
      color: textOr(env.C2M_COLOR, DEFAULT_PRODUCT.color),
      paperType: textOr(env.C2M_PAPER_TYPE, DEFAULT_PRODUCT.paperType),
      printOption: textOr(env.C2M_PRINT_OPTION, DEFAULT_PRODUCT.printOption),
      mailClass: textOr(env.C2M_MAIL_CLASS, DEFAULT_PRODUCT.mailClass),
      addressMappingId: textOr(env.C2M_ADDRESS_MAPPING_ID, DEFAULT_PRODUCT.addressMappingId),
      billingType: textOr(env.C2M_BILLING_TYPE, DEFAULT_PRODUCT.billingType),
    },
  }
}

export function assertClick2MailCallable(config: Click2MailConfig): void {
  if (!config.username || !config.password) {
    throw new Click2MailError(
      "Click2Mail credentials are missing. Set C2M_USERNAME and C2M_PASSWORD on the server."
    )
  }
  if (config.environment === "prod" && !config.allowProduction) {
    throw new Click2MailError(
      "Production Click2Mail is locked. Set C2M_ALLOW_PRODUCTION=true before a live order."
    )
  }
}

export function describePrintMailMode(env: NodeJS.ProcessEnv = process.env): PrintMailMode {
  const config = loadClick2MailConfig(env)
  return {
    environment: config.environment,
    productionEnabled: config.environment === "prod" && config.allowProduction,
    credentialsConfigured: Boolean(config.username && config.password),
  }
}

export type AddressListPhase = "ready" | "pending" | "error"

export function addressListPhase(status: number, config: Click2MailConfig): AddressListPhase {
  if (status === config.addressListErrorStatus) return "error"
  if (status >= config.addressListReadyMinStatus) return "ready"
  return "pending"
}

export function mergeProduct(
  base: Click2MailProductOptions,
  overrides?: Partial<Click2MailProductOptions>
): Click2MailProductOptions {
  if (!overrides) return { ...base }
  const next = { ...base }
  for (const key of Object.keys(overrides) as (keyof Click2MailProductOptions)[]) {
    const value = overrides[key]
    if (value !== undefined) next[key] = value
  }
  return next
}

import {
  addressListPhase,
  assertClick2MailCallable,
  loadClick2MailConfig,
  mergeProduct,
  type Click2MailConfig,
} from "./config"
import { Click2MailError, redactSecrets } from "./errors"
import { interpretVendorJob } from "./job-status"
import { buildAddressListXml } from "./recipients"
import type {
  AddressListSnapshot,
  Click2MailClient,
  CreditPurchaseResult,
  DocumentCreated,
  JobCostSnapshot,
  EddmMailerInfo,
  EddmPostOfficeSubmission,
  JobDraft,
  JobSnapshot,
  ProofSnapshot,
  PurchaseCreditInput,
  TrackingPiece,
  TrackingSnapshot,
} from "./types"
import {
  childText,
  childrenNamed,
  findChild,
  firstText,
  parseXml,
  type XmlElement,
} from "./xml"

const TRANSIENT_STATUS = 524
const MAX_ATTEMPTS = 3

export interface Click2MailHttpRequest {
  method: "GET" | "POST"
  path: string
  query?: Record<string, string>
  form?: Record<string, string>
  xml?: string
  fields?: Record<string, string>
  file?: { filename: string; bytes: Uint8Array<ArrayBufferLike>; contentType: string }
}

export interface Click2MailHttpResponse {
  status: number
  contentType: string
  body: string
  bytes: Uint8Array
}

export interface Click2MailTransport {
  send(request: Click2MailHttpRequest): Promise<Click2MailHttpResponse>
}

interface ResultFields {
  id?: string
  status: number | null
  description: string
  jobStatus?: string
  balance?: string
  pages?: string
  sessionId?: string
  proofId?: string
}

function authorizationHeader(username: string, password: string): string {
  return `Basic ${Buffer.from(`${username}:${password}`, "utf8").toString("base64")}`
}

export function createFetchTransport(
  config: Click2MailConfig,
  fetchImpl: typeof fetch = fetch
): Click2MailTransport {
  return {
    async send(request) {
      const url = new URL(`${config.baseUrl}${request.path}`)
      if (request.query) {
        for (const [key, value] of Object.entries(request.query)) {
          url.searchParams.set(key, value)
        }
      }

      const headers = new Headers()
      headers.set("Accept", "application/xml")
      headers.set("Authorization", authorizationHeader(config.username, config.password))
      headers.set("User-Agent", "ModernMail/click2mail")

      let body: BodyInit | undefined
      if (request.xml !== undefined) {
        headers.set("Content-Type", "application/xml; charset=utf-8")
        body = request.xml
      } else if (request.form) {
        headers.set("Content-Type", "application/x-www-form-urlencoded")
        body = new URLSearchParams(request.form).toString()
      } else if (request.file) {
        const form = new FormData()
        for (const [key, value] of Object.entries(request.fields ?? {})) form.append(key, value)
        const fileBytes = Uint8Array.from(request.file.bytes)
        form.append(
          "file",
          new Blob([fileBytes], { type: request.file.contentType }),
          request.file.filename
        )
        body = form
      }

      const response = await fetchImpl(url, { method: request.method, headers, body })
      const bytes = new Uint8Array(await response.arrayBuffer())
      const contentType = response.headers.get("content-type") ?? ""
      const asText = () => new TextDecoder().decode(bytes)
      const looksXml =
        contentType.includes("xml") ||
        contentType.includes("text") ||
        contentType === "" ||
        bytes[0] === 0x3c
      return {
        status: response.status,
        contentType,
        body: looksXml || !contentType.includes("pdf") ? asText() : "",
        bytes,
      }
    },
  }
}

function secretsFor(config: Click2MailConfig, extra: readonly string[] = []): string[] {
  return [config.username, config.password, ...extra].filter((value) => value.length > 0)
}

function readResult(root: XmlElement): ResultFields {
  const statusText = firstText(root, ["status"])
  const status =
    statusText !== undefined && /^-?\d+$/.test(statusText) ? Number(statusText) : null
  const proof = findChild(root, "proof")
  return {
    id: firstText(root, ["id"]),
    status,
    description: firstText(root, ["description"]) ?? "",
    jobStatus: firstText(root, ["jobStatus"]),
    balance: firstText(root, ["balance"]),
    pages: firstText(root, ["pages"]),
    sessionId:
      firstText(root, ["sessionId", "sessionID"]) ??
      (proof ? firstText(proof, ["sessionId", "sessionID"]) : undefined),
    proofId:
      firstText(root, ["proofId", "proofID"]) ??
      (proof ? firstText(proof, ["id", "proofId"]) : undefined),
  }
}

function fail(
  response: Click2MailHttpResponse,
  result: ResultFields,
  secrets: readonly string[]
): Click2MailError {
  const description = redactSecrets(result.description || snippet(response.body), secrets)
  const http = response.status ? `HTTP ${response.status}` : "Click2Mail"
  const code = result.status === null ? "" : ` status ${result.status}`
  return new Click2MailError(`${http}${code}: ${description || "request failed"}`, {
    httpStatus: response.status,
    resultCode: result.status,
    resultDescription: description,
  })
}

/**
 * Job 1304272 quoted cost 337.92 and tax 0.16. The Java client only maps `cost`,
 * so tax is added here. A totalCost that already includes tax is used as-is.
 */
export function jobCostTotal(root: XmlElement): number | null {
  const tax = firstMoney(root, ["tax", "taxAmount", "salesTax"]) ?? 0
  const explicit = firstMoney(root, ["totalCost", "grandTotal"])
  const flat = firstMoney(root, ["cost"])
  if (explicit !== null) {
    const preTax = flat ?? explicit
    if (tax > 0 && explicit + 0.001 < preTax + tax) return roundCents(explicit + tax)
    return roundCents(explicit)
  }
  if (flat !== null) return roundCents(flat + tax)

  let sum = 0
  let found = false
  for (const name of ["productionCost", "standardCost", "nonstandardCost", "nonStandardCost", "internationalCost", "postageCost"]) {
    const node = findChild(root, name)
    if (!node) continue
    const subtotal = money(childText(node, "subtotal") ?? node.text)
    if (subtotal === null) continue
    sum += subtotal
    found = true
  }
  if (tax > 0) {
    sum += tax
    found = true
  }
  return found ? roundCents(sum) : null
}

function firstMoney(element: XmlElement, names: readonly string[]): number | null {
  for (const name of names) {
    const value = money(childText(element, name))
    if (value !== null) return value
  }
  return null
}

function money(value: string | undefined): number | null {
  if (!value) return null
  const cleaned = value.replace(/[$,]/g, "").trim()
  if (!/^-?\d+(\.\d+)?$/.test(cleaned)) return null
  const amount = Number(cleaned)
  return Number.isFinite(amount) ? amount : null
}

function roundCents(amount: number): number {
  return Math.round(amount * 100) / 100
}

function snippet(body: string): string {
  const compact = body.replace(/\s+/g, " ").trim()
  if (!compact || compact.startsWith("<!DOCTYPE") || compact.startsWith("<html")) {
    return "Click2Mail did not return XML."
  }
  return compact.slice(0, 240)
}

function parseBody(response: Click2MailHttpResponse, secrets: readonly string[]): XmlElement {
  try {
    return parseXml(response.body)
  } catch (error) {
    const message = error instanceof Error ? error.message : "Click2Mail returned XML that could not be read."
    throw new Click2MailError(redactSecrets(message, secrets), { httpStatus: response.status })
  }
}

function isPdf(response: Click2MailHttpResponse): boolean {
  return response.contentType.includes("pdf") || response.bytes[0] === 0x25
}

export function createClick2MailClient(options: {
  config: Click2MailConfig
  transport?: Click2MailTransport
  sleep?: (ms: number) => Promise<void>
}): Click2MailClient {
  const config = options.config
  const transport = options.transport ?? createFetchTransport(config)
  const sleep = options.sleep ?? ((ms: number) => new Promise((resolve) => setTimeout(resolve, ms)))
  const secrets = secretsFor(config)

  async function send(request: Click2MailHttpRequest): Promise<Click2MailHttpResponse> {
    let last: Click2MailHttpResponse | null = null
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
      last = await transport.send(request)
      if (last.status !== TRANSIENT_STATUS || attempt === MAX_ATTEMPTS) return last
      await sleep(400 * attempt)
    }
    return last as Click2MailHttpResponse
  }

  function requireId(result: ResultFields, response: Click2MailHttpResponse, label: string): string {
    if (!result.id) throw fail(response, { ...result, description: result.description || `${label} id was missing` }, secrets)
    return result.id
  }

  return {
    async getCredit() {
      const response = await send({ method: "GET", path: "/credit" })
      const result = readResult(parseBody(response, secrets))
      if (response.status < 200 || response.status >= 300) throw fail(response, result, secrets)
      if (result.status !== null && result.status !== 0) throw fail(response, result, secrets)
      if (!result.balance) throw fail(response, { ...result, description: "Credit balance was missing." }, secrets)
      const balance = Number(result.balance)
      if (!Number.isFinite(balance)) {
        throw fail(response, { ...result, description: "Credit balance was not a number." }, secrets)
      }
      return { balance, status: result.status, description: result.description }
    },

    async getJobCost(jobId, paymentType) {
      const response = await send({
        method: "GET",
        path: `/jobs/${encodeURIComponent(jobId)}/cost`,
        query: { paymentType },
      })
      const root = parseBody(response, secrets)
      const result = readResult(root)
      if (response.status < 200 || response.status >= 300) throw fail(response, result, secrets)
      if (result.status !== null && result.status !== 0) throw fail(response, result, secrets)
      const total = jobCostTotal(root)
      if (total === null) {
        throw fail(response, { ...result, description: result.description || "Job cost was missing." }, secrets)
      }
      return { total, status: result.status, description: result.description } satisfies JobCostSnapshot
    },

    async purchaseCredit(input) {
      assertPurchase(input)
      if (config.environment === "prod" && input.billingNumber === "4111111111111111") {
        throw new Click2MailError("The staging test card cannot be used in production.")
      }
      const response = await send({
        method: "POST",
        path: "/credit/purchase",
        form: purchaseForm(input),
      })
      const cardSecrets = secretsFor(config, [input.billingNumber, input.billingCvv])
      const result = readResult(parseBody(response, cardSecrets))
      if (response.status < 200 || response.status >= 300 || result.status !== 0) {
        throw fail(response, result, cardSecrets)
      }
      return { status: result.status, description: result.description } satisfies CreditPurchaseResult
    },

    async createDocument(input) {
      const response = await send({
        method: "POST",
        path: "/documents",
        fields: {
          documentFormat: input.documentFormat,
          documentName: input.documentName,
          documentClass: input.documentClass,
        },
        file: {
          filename: input.fileName,
          bytes: input.bytes,
          contentType: "application/pdf",
        },
      })
      const result = readResult(parseBody(response, secrets))
      if (response.status < 200 || response.status >= 300 || result.status !== 0) {
        throw fail(response, result, secrets)
      }
      return {
        id: requireId(result, response, "Document"),
        status: result.status,
        description: result.description,
        pages: result.pages ?? "",
      } satisfies DocumentCreated
    },

    async createAddressList(input) {
      const response = await send({
        method: "POST",
        path: "/addressLists",
        xml: buildAddressListXml(input),
      })
      return readAddressList(response, secrets, config)
    },

    async getAddressList(id) {
      const response = await send({ method: "GET", path: `/addressLists/${encodeURIComponent(id)}` })
      return readAddressList(response, secrets, config, id)
    },

    async createJob(input) {
      const response = await send({
        method: "POST",
        path: "/jobs",
        form: jobForm(input),
      })
      const result = readResult(parseBody(response, secrets))
      if (response.status < 200 || response.status >= 300 || result.status !== 0) {
        throw fail(response, result, secrets)
      }
      return toJob(result, response, secrets, "EDITING")
    },

    async createJobFromTemplate(input) {
      const created = await send({
        method: "POST",
        path: "/jobs/jobTemplate",
        form: { templateName: input.templateName },
      })
      const createdResult = readResult(parseBody(created, secrets))
      if (created.status < 200 || created.status >= 300 || createdResult.status !== 0) {
        throw fail(created, createdResult, secrets)
      }
      const job = toJob(createdResult, created, secrets, "EDITING")
      const updated = await send({
        method: "POST",
        path: `/jobs/${encodeURIComponent(job.id)}/update`,
        form: {
          documentId: input.documentId,
          quantity: String(input.quantity),
        },
      })
      const updatedResult = readResult(parseBody(updated, secrets))
      if (updated.status < 200 || updated.status >= 300 || (updatedResult.status !== null && updatedResult.status !== 0)) {
        throw fail(updated, updatedResult, secrets)
      }
      return toJob({ ...updatedResult, id: updatedResult.id ?? job.id }, updated, secrets, job.jobStatus || "EDITING")
    },

    async createProof(jobId) {
      const response = await send({
        method: "POST",
        path: `/jobs/${encodeURIComponent(jobId)}/proof`,
      })
      return readProof(response, secrets)
    },

    async getProof(jobId, proofId, sessionId) {
      const response = await send({
        method: "GET",
        path: `/jobs/${encodeURIComponent(jobId)}/proof/${encodeURIComponent(proofId)}/${encodeURIComponent(sessionId)}`,
      })
      if (isPdf(response) && response.status >= 200 && response.status < 300) {
        return {
          id: proofId,
          sessionId,
          status: 0,
          description: "Proof file",
          bytes: response.bytes,
        }
      }
      return readProof(response, secrets)
    },

    async submitJob(jobId, billingType) {
      const response = await send({
        method: "POST",
        path: `/jobs/${encodeURIComponent(jobId)}/submit`,
        form: { billingType },
      })
      const result = readResult(parseBody(response, secrets))
      if (response.status < 200 || response.status >= 300 || result.status !== 0) {
        throw fail(response, result, secrets)
      }
      return toJob(result, response, secrets, "ORDER_SUBMITTED")
    },

    async getJob(jobId) {
      const response = await send({ method: "GET", path: `/jobs/${encodeURIComponent(jobId)}` })
      const result = readResult(parseBody(response, secrets))
      if (response.status < 200 || response.status >= 300) throw fail(response, result, secrets)
      const lifecycle = interpretVendorJob({
        resultCode: result.status,
        description: result.description,
        jobStatusField: result.jobStatus,
      })
      if (result.status !== null && result.status !== 0 && !lifecycle) {
        throw fail(response, result, secrets)
      }
      return toJob(result, response, secrets, lifecycle ?? "")
    },

    async getEddm(jobId) {
      return readJob(await send({ method: "GET", path: `/jobs/${encodeURIComponent(jobId)}/eddm` }), secrets, jobId)
    },

    async setEddmInfo(jobId, info) {
      return readJob(
        await send({
          method: "POST",
          path: `/jobs/${encodeURIComponent(jobId)}/eddmInfo`,
          form: eddmInfoForm(info),
        }),
        secrets,
        jobId
      )
    },

    async setEddmRoute(jobId, route) {
      return readJob(
        await send({
          method: "POST",
          path: `/jobs/${encodeURIComponent(jobId)}/eddmRoute`,
          form: {
            poName: route.poName,
            route: route.route,
            postalCode: route.postalCode,
            totalPieces: String(route.totalPieces),
          },
        }),
        secrets,
        jobId
      )
    },

    async setEddmPostOffice(jobId, office) {
      return readJob(
        await send({
          method: "POST",
          path: `/jobs/${encodeURIComponent(jobId)}/eddmPo`,
          form: eddmPoForm(office),
        }),
        secrets,
        jobId
      )
    },

    async updateEddmJob(jobId, input) {
      return readJob(
        await send({
          method: "POST",
          path: `/jobs/${encodeURIComponent(jobId)}/update`,
          form: { crid: input.crid, quantity: String(input.quantity) },
        }),
        secrets,
        jobId
      )
    },

    async getTracking(jobId, trackingType = "IMB") {
      const response = await send({
        method: "GET",
        path: `/jobs/${encodeURIComponent(jobId)}/tracking`,
        query: { trackingType },
      })
      const root = parseBody(response, secrets)
      const result = readResult(root)
      if (response.status < 200 || response.status >= 300 || (result.status !== null && result.status !== 0)) {
        throw fail(response, result, secrets)
      }
      const tracking = findChild(root, "tracking")
      const pieces = tracking
        ? childrenNamed(tracking, "mailPiece").map(readPiece)
        : []
      return {
        id: result.id ?? jobId,
        status: result.status,
        description: result.description,
        pieces,
      } satisfies TrackingSnapshot
    },
  }
}

function readAddressList(
  response: Click2MailHttpResponse,
  secrets: readonly string[],
  config: Click2MailConfig,
  fallbackId?: string
): AddressListSnapshot {
  const result = readResult(parseBody(response, secrets))
  if (response.status < 200 || response.status >= 300) throw fail(response, result, secrets)
  if (result.status === null) {
    throw fail(response, { ...result, description: result.description || "Address list status was missing." }, secrets)
  }
  if (addressListPhase(result.status, config) === "error") throw fail(response, result, secrets)
  const id = result.id ?? fallbackId
  if (!id) {
    throw fail(response, { ...result, description: result.description || "Address list id was missing." }, secrets)
  }
  return {
    id,
    status: result.status,
    description: result.description,
  }
}

function toJob(
  result: ResultFields,
  response: Click2MailHttpResponse,
  secrets: readonly string[],
  fallbackStatus: string
): JobSnapshot {
  if (!result.id) throw fail(response, result, secrets)
  const lifecycle =
    interpretVendorJob({
      resultCode: result.status,
      description: result.description,
      jobStatusField: result.jobStatus,
      fallback: fallbackStatus,
    }) ?? fallbackStatus
  return {
    id: result.id,
    status: result.status,
    description: result.description,
    jobStatus: lifecycle,
  }
}

function readProof(response: Click2MailHttpResponse, secrets: readonly string[]): ProofSnapshot {
  if (isPdf(response) && response.status >= 200 && response.status < 300) {
    return { id: "inline", sessionId: "", status: 0, description: "Proof file", bytes: response.bytes }
  }
  const result = readResult(parseBody(response, secrets))
  if (response.status < 200 || response.status >= 300) throw fail(response, result, secrets)
  if (result.status !== null && result.status !== 0) throw fail(response, result, secrets)
  return {
    id: result.proofId ?? result.id ?? "",
    sessionId: result.sessionId ?? "",
    status: result.status,
    description: result.description,
  }
}

function readPiece(element: XmlElement): TrackingPiece {
  return {
    barCode: firstText(element, ["barCode", "barcode"]) ?? "",
    address: firstText(element, ["address"]) ?? "",
    status: firstText(element, ["status"]) ?? "",
    dateTime: firstText(element, ["dateTime"]) ?? "",
    statusLocation: firstText(element, ["statusLocation"]) ?? "",
  }
}

function purchaseForm(input: PurchaseCreditInput): Record<string, string> {
  return {
    billingName: input.billingName,
    billingAddress1: input.billingAddress1,
    billingCity: input.billingCity,
    billingState: input.billingState,
    billingZip: input.billingZip,
    billingAmount: input.billingAmount,
    billingNumber: input.billingNumber,
    billingMonth: input.billingMonth,
    billingYear: input.billingYear,
    billingCvv: input.billingCvv,
    billingCcType: input.billingCcType,
  }
}

function readJob(
  response: Click2MailHttpResponse,
  secrets: readonly string[],
  fallbackId: string
): JobSnapshot {
  const result = readResult(parseBody(response, secrets))
  if (response.status < 200 || response.status >= 300 || (result.status !== null && result.status !== 0)) {
    throw fail(response, result, secrets)
  }
  return toJob({ ...result, id: result.id ?? fallbackId }, response, secrets, result.jobStatus || "")
}

function eddmInfoForm(info: EddmMailerInfo): Record<string, string> {
  const form: Record<string, string> = {
    mailerName: info.name,
    mailerAddress1: info.address,
    mailerCity: info.city,
    mailerState: info.state,
    mailerPostalcode: info.zip,
  }
  if (info.organization?.trim()) form.mailerOrganization = info.organization.trim()
  if (info.address2?.trim()) form.mailerAddress2 = info.address2.trim()
  if (info.address3?.trim()) form.mailerAddress3 = info.address3.trim()
  if (info.phone?.trim()) form.mailerPhone = info.phone.trim()
  return form
}

function eddmPoForm(office: EddmPostOfficeSubmission): Record<string, string> {
  const form: Record<string, string> = {
    poName: office.name,
    deliveryType: office.deliveryType,
    totalPieces: String(office.totalPieces),
    poAddress: office.address,
    poCity: office.city,
    poState: office.state,
    poPostalCode: office.zip,
    routeType: office.routeType,
  }
  if (office.phone?.trim()) form.phone = office.phone.trim()
  if (office.hours?.trim()) form.hours = office.hours.trim()
  return form
}

function assertPurchase(input: PurchaseCreditInput): void {
  const amount = Number(input.billingAmount)
  if (!Number.isFinite(amount) || amount < 10) {
    throw new Click2MailError("Click2Mail credit purchases start at $10.")
  }
}

function jobForm(input: JobDraft): Record<string, string> {
  const product = input.product
  const form: Record<string, string> = {
    documentClass: product.documentClass,
    layout: product.layout,
    productionTime: product.productionTime,
    envelope: product.envelope,
    color: product.color,
    paperType: product.paperType,
    printOption: product.printOption,
    mailClass: product.mailClass,
    documentId: input.documentId,
    appSignature: "Modern Mail",
  }
  if (input.addressId) form.addressId = input.addressId
  // Quantity is only for products that do not use an address list.
  // Sending it on a postcard job can price the piece as something other than a postcard.
  if (input.quantity !== undefined && !input.addressId) form.quantity = String(input.quantity)
  const address = input.returnAddress
  if (!address) return form
  const pairs: Array<[keyof typeof address, string]> = [
    ["rtnName", "rtnName"],
    ["rtnOrganization", "rtnOrganization"],
    ["rtnaddress1", "rtnaddress1"],
    ["rtnaddress2", "rtnaddress2"],
    ["rtnCity", "rtnCity"],
    ["rtnState", "rtnState"],
    ["rtnZip", "rtnZip"],
  ]
  for (const [field, key] of pairs) {
    const value = address[field]?.trim()
    if (value) form[key] = value
  }
  return form
}

export function createClick2MailClientFromEnv(
  env: NodeJS.ProcessEnv = process.env,
  productOverrides?: Partial<Click2MailConfig["product"]>
): { client: Click2MailClient; config: Click2MailConfig } {
  const loaded = loadClick2MailConfig(env)
  const config = { ...loaded, product: mergeProduct(loaded.product, productOverrides) }
  assertClick2MailCallable(config)
  return { client: createClick2MailClient({ config }), config }
}

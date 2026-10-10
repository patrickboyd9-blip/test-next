/**
 * Click2Mail staging smoke test.
 *
 * Uses C2M_USERNAME and C2M_PASSWORD from the environment. It prints ids and
 * statuses only. It does not print the username, password, or card number.
 *
 *   npm run c2m:smoke
 *   npm run c2m:smoke -- --buy-credit
 *   npm run c2m:smoke -- --submit --paper-type "White 80# Gloss with UV Coating"
 *
 * --buy-credit adds $10 with Click2Mail's published staging test card when the
 * balance is under $1. It refuses to run that purchase when C2M_ENV=prod.
 * --submit pays the job with User Credit (or C2M_BILLING_TYPE). Without it,
 * the job stays in editing and nothing is charged.
 */
import { createClick2MailClientFromEnv } from "../lib/click2mail/client"
import { addressListPhase, mergeProduct, type Click2MailProductOptions } from "../lib/click2mail/config"
import { waitForAddressList } from "../lib/click2mail/order"
import type { Recipient } from "../lib/click2mail/recipients"
import type { PurchaseCreditInput } from "../lib/click2mail/types"
import { renderSamplePostcardPdf } from "../lib/print-spec/render-campaign-postcard-pdf"

const SAMPLE_RECIPIENT: Recipient = {
  first: "Test",
  last: "Recipient",
  organization: "",
  address1: "715 S Calhoun St",
  address2: "",
  city: "Fort Wayne",
  state: "IN",
  zip: "46802",
}

const STAGING_TEST_PURCHASE: PurchaseCreditInput = {
  billingName: "Modern Mail Staging",
  billingAddress1: "221B Baker St",
  billingCity: "Springfield",
  billingState: "MO",
  billingZip: "34567",
  billingAmount: "10",
  billingNumber: "4111111111111111",
  billingMonth: "12",
  billingYear: "2030",
  billingCvv: "123",
  billingCcType: "VI",
}

const FLAG_TO_PRODUCT: Record<string, keyof Click2MailProductOptions> = {
  "document-class": "documentClass",
  "document-format": "documentFormat",
  layout: "layout",
  "production-time": "productionTime",
  envelope: "envelope",
  color: "color",
  "paper-type": "paperType",
  "print-option": "printOption",
  "mail-class": "mailClass",
  "billing-type": "billingType",
  "address-mapping-id": "addressMappingId",
}

function printHelp(): void {
  console.log(`Usage: npm run c2m:smoke -- [flags]

Checks staging credit, uploads a sample 5x8 PDF, creates one address,
creates a job, and requests a proof.

  --buy-credit     If balance < $1, add $10 with the staging test card
  --submit         Submit the job with User Credit after the proof
  --document-class "Postcard 5 x 8"
  --layout "Double Sided Postcard"
  --paper-type "White Matte with Gloss UV Finish"
  --print-option "Printing both sides"
  --mail-class "First Class"
  --production-time "Next Day"
  --color "Full Color"
  --envelope ""
  --document-format PDF
  --billing-type "User Credit"
  --address-mapping-id 1

Flags accept --name value or --name=value.
`)
}

function parseArgs(argv: string[]): {
  buyCredit: boolean
  submit: boolean
  product: Partial<Click2MailProductOptions>
} {
  const product: Partial<Click2MailProductOptions> = {}
  let buyCredit = false
  let submit = false
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index] ?? ""
    if (token === "--help" || token === "-h") {
      printHelp()
      process.exit(0)
    }
    if (token === "--buy-credit") {
      buyCredit = true
      continue
    }
    if (token === "--submit") {
      submit = true
      continue
    }
    const inline = token.match(/^--([a-z0-9-]+)=(.*)$/)
    const name = inline ? inline[1] : token.startsWith("--") ? token.slice(2) : ""
    if (!name || !token.startsWith("--")) {
      throw new Error(`Unknown argument ${token}. Try --help.`)
    }
    const value = inline ? (inline[2] ?? "") : (argv[(index += 1)] ?? "")
    const key = FLAG_TO_PRODUCT[name]
    if (!key) throw new Error(`Unknown flag --${name}. Try --help.`)
    product[key] = value
  }
  return { buyCredit, submit, product }
}

function line(step: string, fields: Record<string, string | number | null | undefined>): void {
  const parts = Object.entries(fields)
    .filter(([, value]) => value !== undefined && value !== null && value !== "")
    .map(([key, value]) => `${key}=${value}`)
  console.log(`${step}  ${parts.join("  ")}`)
}

async function main(): Promise<void> {
  const flags = parseArgs(process.argv.slice(2))
  const { client, config } = createClick2MailClientFromEnv(process.env, flags.product)
  const product = mergeProduct(config.product, flags.product)

  console.log(`Click2Mail smoke (${config.environment})`)
  console.log(`base ${config.baseUrl}`)
  line("product", {
    documentClass: product.documentClass,
    layout: product.layout,
    paperType: product.paperType,
    printOption: product.printOption,
    mailClass: product.mailClass,
    productionTime: product.productionTime,
    color: product.color,
    envelope: product.envelope === "" ? '""' : product.envelope,
  })

  const credit = await client.getCredit()
  line("credit", { balance: credit.balance.toFixed(2), status: credit.status ?? "ok" })

  if (credit.balance < 1) {
    if (!flags.buyCredit) {
      console.log("Balance is under $1. Re-run with --buy-credit to add $10 of staging test credit.")
      process.exit(1)
    }
    if (config.environment === "prod") {
      console.log("Refusing to buy credit with the staging test card while C2M_ENV=prod.")
      process.exit(1)
    }
    const purchased = await client.purchaseCredit(STAGING_TEST_PURCHASE)
    line("purchase", { amount: "10.00", status: purchased.status, description: purchased.description })
    const after = await client.getCredit()
    line("credit", { balance: after.balance.toFixed(2), status: after.status ?? "ok" })
  }

  const pdf = await renderSamplePostcardPdf()
  line("pdf", { bytes: pdf.byteLength, pages: 2, points: "612x396" })

  const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d+Z$/, "Z")
  const document = await client.createDocument({
    documentName: `mm-smoke-${stamp}`,
    documentFormat: product.documentFormat,
    documentClass: product.documentClass,
    fileName: "file.pdf",
    bytes: pdf,
  })
  line("document", { id: document.id, status: document.status, description: document.description, pages: document.pages })

  const list = await client.createAddressList({
    name: `mm-smoke-${stamp}`,
    mappingId: product.addressMappingId,
    recipients: [SAMPLE_RECIPIENT],
  })
  line("addressList", { id: list.id, status: list.status, description: list.description })

  const ready = await waitForAddressList({
    client,
    config,
    id: list.id,
    timeoutMs: 45_000,
    intervalMs: 2_000,
  })
  line("addressList", { id: ready.id, status: ready.status, description: ready.description })
  if (addressListPhase(ready.status, config) !== "ready") {
    console.log("Address list is not ready yet. Run the smoke test again in a minute, or raise C2M_ADDRESS_LIST_READY_MIN if Click2Mail uses a different ready code.")
    process.exit(1)
  }

  const job = await client.createJob({
    documentId: document.id,
    addressId: ready.id,
    product,
    quantity: 1,
    returnAddress: { rtnOrganization: "Modern Mail Test" },
  })
  line("job", { id: job.id, status: job.status, jobStatus: job.jobStatus, description: job.description })

  const proof = await client.createProof(job.id)
  line("proof", {
    id: proof.id,
    sessionId: proof.sessionId,
    status: proof.status,
    description: proof.description,
    bytes: proof.bytes?.byteLength,
  })
  if (proof.id && proof.sessionId && !proof.bytes) {
    const file = await client.getProof(job.id, proof.id, proof.sessionId)
    line("proofFile", { id: file.id, bytes: file.bytes?.byteLength, description: file.description })
  }

  if (!flags.submit) {
    console.log("Job was not submitted. Re-run with --submit to pay with User Credit.")
    return
  }

  const submitted = await client.submitJob(job.id, product.billingType)
  line("submit", {
    id: submitted.id,
    status: submitted.status,
    jobStatus: submitted.jobStatus,
    description: submitted.description,
    billingType: product.billingType,
  })

  const current = await client.getJob(job.id)
  line("status", {
    id: current.id,
    status: current.status,
    jobStatus: current.jobStatus,
    description: current.description,
  })
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "Smoke test failed."
  console.error(message)
  process.exit(1)
})

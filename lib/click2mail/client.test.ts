import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import path from "node:path"
import { test } from "node:test"

import {
  assertClick2MailCallable,
  loadClick2MailConfig,
  PROD_BASE_URL,
  STAGE_BASE_URL,
} from "./config"
import {
  createClick2MailClient,
  createClick2MailClientFromEnv,
  type Click2MailHttpResponse,
  type Click2MailTransport,
} from "./client"
import { Click2MailError } from "./errors"
import { jobStatusLabel } from "./job-status"

function fixture(name: string): string {
  return readFileSync(path.join(process.cwd(), "lib/click2mail/fixtures", name), "utf8")
}

function xml(status: number, body: string): Click2MailHttpResponse {
  return {
    status,
    contentType: "application/xml",
    body,
    bytes: new TextEncoder().encode(body),
  }
}

function stageConfig(password = "super-secret-password") {
  return loadClick2MailConfig({
    C2M_ENV: "stage",
    C2M_USERNAME: "stage-user",
    C2M_PASSWORD: password,
    C2M_PAPER_TYPE: "White 80# Gloss with UV Coating",
  } as NodeJS.ProcessEnv)
}

test("config defaults to staging and keeps product strings overridable", () => {
  const config = loadClick2MailConfig({} as NodeJS.ProcessEnv)
  assert.equal(config.environment, "stage")
  assert.equal(config.baseUrl, STAGE_BASE_URL)
  assert.equal(config.allowProduction, false)
  assert.equal(config.product.documentClass, "Postcard 5 x 8")
  assert.equal(config.product.layout, "Double Sided Postcard")
  assert.equal(config.product.paperType, "White Matte with Gloss UV Finish")
  assert.equal(config.product.envelope, "")
  assert.equal(config.addressListReadyMinStatus, 3)
  assert.equal(config.addressListErrorStatus, 9)

  const custom = loadClick2MailConfig({
    C2M_ENV: "prod",
    C2M_ALLOW_PRODUCTION: "true",
    C2M_DOCUMENT_CLASS: "Postcard custom",
    C2M_ENVELOPE: "",
    C2M_ADDRESS_LIST_READY_MIN: "5",
  } as NodeJS.ProcessEnv)
  assert.equal(custom.environment, "prod")
  assert.equal(custom.baseUrl, PROD_BASE_URL)
  assert.equal(custom.allowProduction, true)
  assert.equal(custom.product.documentClass, "Postcard custom")
  assert.equal(custom.product.envelope, "")
  assert.equal(custom.addressListReadyMinStatus, 5)
})

test("production calls stay locked unless the flag is exactly true", () => {
  const locked = loadClick2MailConfig({
    C2M_ENV: "prod",
    C2M_USERNAME: "user",
    C2M_PASSWORD: "secret",
    C2M_ALLOW_PRODUCTION: "yes",
  } as NodeJS.ProcessEnv)
  assert.throws(() => assertClick2MailCallable(locked), /locked/)
  assert.throws(
    () => createClick2MailClientFromEnv({ C2M_ENV: "prod", C2M_USERNAME: "user", C2M_PASSWORD: "secret" } as NodeJS.ProcessEnv),
    /locked/
  )
})

test("client reads fixture XML and retries HTTP 524", async () => {
  const responses = [
    xml(524, "<html>timeout</html>"),
    xml(524, "<html>timeout</html>"),
    xml(200, fixture("credit-balance.xml")),
  ]
  let hits = 0
  const transport: Click2MailTransport = {
    async send() {
      hits += 1
      const next = responses.shift()
      if (!next) throw new Error("missing scripted response")
      return next
    },
  }
  const client = createClick2MailClient({
    config: stageConfig(),
    transport,
    sleep: async () => undefined,
  })
  const credit = await client.getCredit()
  assert.equal(credit.balance, 12.5)
  assert.equal(hits, 3)
})

test("document, list, job, proof, and tracking use recorded XML", async () => {
  const sent: Array<{ path: string; form?: Record<string, string>; xml?: string; fields?: Record<string, string> }> = []
  const queue = [
    fixture("document-created.xml"),
    fixture("address-list-ready.xml"),
    fixture("address-list-pending.xml"),
    fixture("job-created.xml"),
    fixture("proof-created.xml"),
    fixture("job-editing.xml"),
    fixture("job-awaiting.xml"),
    fixture("tracking.xml"),
  ]
  const transport: Click2MailTransport = {
    async send(request) {
      sent.push({ path: request.path, form: request.form, xml: request.xml, fields: request.fields })
      const body = queue.shift()
      if (!body) throw new Error(`no fixture for ${request.path}`)
      return xml(200, body)
    },
  }
  const client = createClick2MailClient({ config: stageConfig(), transport })

  const document = await client.createDocument({
    documentName: "sample",
    documentFormat: "PDF",
    documentClass: "Postcard 5 x 8",
    fileName: "file.pdf",
    bytes: new Uint8Array([1, 2, 3]),
  })
  assert.equal(document.id, "12902503")
  assert.equal(sent[0]?.fields?.documentClass, "Postcard 5 x 8")

  const created = await client.createAddressList({
    name: "List",
    mappingId: "1",
    recipients: [
      {
        first: "Ann & Jo",
        last: "Lee",
        organization: "",
        address1: "1 Main St",
        address2: "",
        city: "Austin",
        state: "TX",
        zip: "78701",
      },
    ],
  })
  assert.equal(created.status, 3)
  assert.match(sent[1]?.xml ?? "", /Ann &amp; Jo/)
  assert.match(sent[1]?.xml ?? "", /<addressMappingId>1<\/addressMappingId>/)

  const pending = await client.getAddressList("472743")
  assert.equal(pending.status, 0)

  const job = await client.createJob({
    documentId: document.id,
    addressId: created.id,
    product: stageConfig().product,
    quantity: 1,
    returnAddress: { rtnOrganization: "Modern Mail Test" },
  })
  assert.equal(job.id, "13331417")
  assert.equal(job.jobStatus, "EDITING")
  assert.equal(sent[3]?.form?.paperType, "White 80# Gloss with UV Coating")
  assert.equal(sent[3]?.form?.envelope, "")
  assert.equal(sent[3]?.form?.mailClass, "First Class")
  assert.equal(sent[3]?.form?.rtnOrganization, "Modern Mail Test")

  const proof = await client.createProof(job.id)
  assert.equal(proof.id, "987654")
  assert.equal(proof.sessionId, "session-1")

  const editing = await client.getJob("8675309")
  assert.equal(editing.jobStatus, "EDITING")
  assert.equal(editing.status, 9)

  const awaiting = await client.getJob("1297313")
  assert.equal(awaiting.id, "1297313")
  assert.equal(awaiting.status, 4)
  assert.equal(awaiting.description, "Awaiting Production")
  assert.equal(awaiting.jobStatus, "AWAITING_PRODUCTION")
  assert.equal(jobStatusLabel(awaiting.jobStatus), "Waiting for the printer")

  const tracking = await client.getTracking("8675309")
  assert.equal(tracking.pieces.length, 1)
  assert.equal(tracking.pieces[0]?.barCode, "00270200802005045061")
})

test("a non-zero XML status fails even when HTTP is 200, and secrets are not echoed", async () => {
  const transport: Click2MailTransport = {
    async send() {
      return xml(200, fixture("job-rejected.xml"))
    },
  }
  const client = createClick2MailClient({ config: stageConfig(), transport })
  await assert.rejects(
    () =>
      client.createJob({
        documentId: "1",
        addressId: "2",
        product: stageConfig().product,
      }),
    (error: unknown) => {
      assert.ok(error instanceof Click2MailError)
      assert.equal(error.resultCode, 9)
      assert.equal(error.message.includes("super-secret-password"), false)
      assert.match(error.message, /Product not authorized/)
      return true
    }
  )
})

test("address list status 9 is an error and status 5 is ready", async () => {
  const bodies = [fixture("address-list-error.xml"), addressXml(5)]
  const transport: Click2MailTransport = {
    async send() {
      return xml(200, bodies.shift() ?? "")
    },
  }
  const client = createClick2MailClient({ config: stageConfig(), transport })
  await assert.rejects(() => client.getAddressList("472743"), /status 9/)
  const ready = await client.getAddressList("472743")
  assert.equal(ready.status, 5)
})

function addressXml(status: number): string {
  return `<?xml version="1.0"?><addressList><id>472743</id><status>${status}</status><description>Ready</description></addressList>`
}

import assert from "node:assert/strict"
import { test } from "node:test"

import { createClick2MailClient, type Click2MailHttpRequest, type Click2MailTransport } from "./client"
import { loadClick2MailConfig } from "./config"
import { placeEddmOrder } from "./eddm-order"
import { createMockClick2MailClient } from "./mock-client"
import type { EddmRouteSnapshot } from "@/lib/eddm/routes"

const routes: EddmRouteSnapshot[] = [
  {
    id: "10001C071",
    zip: "10001",
    route: "C071",
    cityState: "NEW YORK, NY",
    residential: 400,
    business: 20,
    total: 420,
    medianAge: 50,
    medianIncome: 160000,
    householdSize: 1.7,
    postOfficeName: "JAMES A FARLEY",
  },
]

const mailer = {
  name: "Harbor Roofing",
  organization: "Harbor Roofing",
  address: "1 Main St",
  city: "New York",
  state: "NY",
  zip: "10001",
  phone: "(619) 555-0148",
}

test("an EDDM order does not call Click2Mail while staging submit is off", async () => {
  const client = createMockClick2MailClient()
  const order = await placeEddmOrder({
    client,
    config: loadClick2MailConfig({ C2M_ENV: "stage", C2M_USERNAME: "stage", C2M_PASSWORD: "secret" } as unknown as NodeJS.ProcessEnv),
    pdf: new Uint8Array([1]),
    size: "6.5x9",
    coverage: "residential",
    routes,
    mailer,
    uspsAccountId: "",
    submitEnabled: false,
    documentName: "eddm",
    artwork: "type-plate",
    submit: true,
    proof: true,
    now: () => "2026-10-22T00:00:00.000Z",
  })
  assert.equal(client.calls.length, 0)
  assert.match(order.error ?? "", /C2M_EDDM_SUBMIT/)
  assert.equal(order.submitted, false)
  assert.match(order.estimatedCostLabel, /Postage estimate/)
})

test("production refuses an EDDM order even when the flag is on", async () => {
  const client = createMockClick2MailClient()
  const order = await placeEddmOrder({
    client,
    config: loadClick2MailConfig({
      C2M_ENV: "prod",
      C2M_ALLOW_PRODUCTION: "true",
      C2M_USERNAME: "prod",
      C2M_PASSWORD: "secret",
    } as unknown as NodeJS.ProcessEnv),
    pdf: new Uint8Array([1]),
    size: "6.25x11",
    coverage: "residential",
    routes,
    mailer,
    uspsAccountId: "123456",
    submitEnabled: true,
    documentName: "eddm",
    artwork: "type-plate",
    submit: true,
    proof: true,
    now: () => "2026-10-22T00:00:00.000Z",
  })
  assert.equal(client.calls.length, 0)
  assert.match(order.error ?? "", /staging/i)
})

test("a staging EDDM order sends routes, the post office, the mailer, and the USPS account id", async () => {
  const requests: Click2MailHttpRequest[] = []
  const transport: Click2MailTransport = {
    async send(request) {
      requests.push(request)
      const path = request.path
      const id = path.includes("/documents") ? "doc-9" : "job-9"
      const xml = `<?xml version="1.0"?><job><id>${id}</id><status>0</status><description>Success</description></job>`
      return {
        status: 200,
        contentType: "application/xml",
        body: xml,
        bytes: new TextEncoder().encode(xml),
      }
    },
  }
  const config = loadClick2MailConfig({
    C2M_ENV: "stage",
    C2M_USERNAME: "stage-user",
    C2M_PASSWORD: "secret",
  } as unknown as NodeJS.ProcessEnv)
  const client = createClick2MailClient({ config, transport })
  const order = await placeEddmOrder({
    client,
    config,
    pdf: new Uint8Array([1]),
    size: "6.5x9",
    coverage: "residential",
    routes,
    mailer,
    uspsAccountId: "MID-42",
    submitEnabled: true,
    documentName: "eddm-card",
    artwork: "type-plate",
    submit: false,
    proof: false,
    now: () => "2026-10-22T00:00:00.000Z",
  })
  assert.equal(order.error, undefined)
  assert.equal(order.jobId, "job-9")
  assert.equal(order.submitted, false)
  assert.equal(order.eddm?.prepared, true)
  const paths = requests.map((request) => request.path)
  assert.deepEqual(paths, [
    "/documents",
    "/jobs",
    "/jobs/job-9/eddmInfo",
    "/jobs/job-9/eddmRoute",
    "/jobs/job-9/eddmPo",
    "/jobs/job-9/update",
  ])
  const job = requests[1]
  assert.equal(job?.form?.documentClass, "Postcard 6.5 x 9")
  assert.equal(job?.form?.quantity, "400")
  assert.equal(job?.form?.addressId, undefined)
  const route = requests[3]?.form
  assert.equal(route?.route, "C071")
  assert.equal(route?.postalCode, "10001")
  assert.equal(route?.poName, "JAMES A FARLEY")
  assert.equal(route?.totalPieces, "400")
  assert.equal(requests[5]?.form?.crid, "MID-42")
  assert.equal(requests[5]?.form?.quantity, "400")
  const info = requests[2]?.form
  assert.equal(info?.name, "Harbor Roofing")
  assert.equal(info?.zip, "10001")
})

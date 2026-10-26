import assert from "node:assert/strict"
import { test } from "node:test"

import type { EddmRouteSnapshot } from "@/lib/eddm/routes"
import { eddmPaymentBlockedMessage } from "@/lib/fulfillment/payment-clearance"

import { createClick2MailClient, type Click2MailHttpRequest, type Click2MailTransport } from "./client"
import { describePrintMailMode, loadClick2MailConfig } from "./config"
import { EDDM_MAIL_CLASS, eddmCreditShortMessage, placeEddmOrder } from "./eddm-order"
import { createMockClick2MailClient } from "./mock-client"

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
    postOfficeStreet: "421 8TH AVE",
    postOfficePhone: "212-330-3296",
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

const stageEnv = {
  C2M_ENV: "stage",
  C2M_USERNAME: "stage",
  C2M_PASSWORD: "secret",
} as unknown as NodeJS.ProcessEnv

test("an EDDM order does not call Click2Mail while staging submit is off", async () => {
  const client = createMockClick2MailClient()
  const order = await placeEddmOrder({
    client,
    config: loadClick2MailConfig(stageEnv),
    pdf: new Uint8Array([1]),
    size: "6.5x9",
    coverage: "residential",
    routes,
    mailer,
    submitEnabled: false,
    paymentCleared: true,
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

test("an unpaid EDDM order makes no Click2Mail calls", async () => {
  const client = createMockClick2MailClient()
  const order = await placeEddmOrder({
    client,
    config: loadClick2MailConfig(stageEnv),
    pdf: new Uint8Array([1]),
    size: "6.5x9",
    coverage: "residential",
    routes,
    mailer,
    submitEnabled: true,
    paymentCleared: false,
    documentName: "eddm",
    artwork: "type-plate",
    submit: true,
    proof: true,
    now: () => "2026-10-22T00:00:00.000Z",
  })
  assert.equal(client.calls.length, 0)
  assert.equal(order.error, eddmPaymentBlockedMessage())
  assert.equal(order.submitted, false)
})

test("a route with no delivering post office blocks checkout before any call", async () => {
  const client = createMockClick2MailClient()
  const order = await placeEddmOrder({
    client,
    config: loadClick2MailConfig(stageEnv),
    pdf: new Uint8Array([1]),
    size: "6.5x9",
    coverage: "residential",
    routes: [{ ...routes[0], postOfficeName: "" }],
    mailer,
    submitEnabled: true,
    paymentCleared: true,
    documentName: "eddm",
    artwork: "type-plate",
    submit: true,
    proof: false,
    now: () => "2026-10-22T00:00:00.000Z",
  })
  assert.equal(client.calls.length, 0)
  assert.match(order.error ?? "", /can't tell which post office delivers route C071/)
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
    submitEnabled: true,
    paymentCleared: true,
    documentName: "eddm",
    artwork: "type-plate",
    submit: true,
    proof: true,
    now: () => "2026-10-22T00:00:00.000Z",
  })
  assert.equal(client.calls.length, 0)
  assert.match(order.error ?? "", /staging/i)
})

test("a route with no street or phone blocks checkout before any call", async () => {
  const client = createMockClick2MailClient()
  const order = await placeEddmOrder({
    client,
    config: loadClick2MailConfig(stageEnv),
    pdf: new Uint8Array([1]),
    size: "6.5x9",
    coverage: "residential",
    routes: [{ ...routes[0], postOfficeStreet: "", postOfficePhone: "" }],
    mailer,
    submitEnabled: true,
    paymentCleared: true,
    documentName: "eddm",
    artwork: "type-plate",
    submit: true,
    proof: false,
    now: () => "2026-10-22T00:00:00.000Z",
  })
  assert.equal(client.calls.length, 0)
  assert.match(order.error ?? "", /street address or a phone number/)
  assert.match(order.error ?? "", /JAMES A FARLEY/)
})

test("card billing is refused before any Click2Mail call", async () => {
  const client = createMockClick2MailClient()
  const order = await placeEddmOrder({
    client,
    config: loadClick2MailConfig(stageEnv),
    pdf: new Uint8Array([1]),
    size: "6.5x9",
    coverage: "residential",
    routes,
    mailer,
    submitEnabled: true,
    paymentCleared: true,
    documentName: "eddm",
    artwork: "type-plate",
    submit: true,
    proof: false,
    env: { ...stageEnv, C2M_EDDM_BILLING_TYPE: "Credit Card" } as NodeJS.ProcessEnv,
    now: () => "2026-10-22T00:00:00.000Z",
  })
  assert.equal(client.calls.length, 0)
  assert.match(order.error ?? "", /User Credit/)
  assert.equal(order.submitted, false)
})

test("a paid staging order sends the accepted mail class, post office, then routes", async () => {
  const requests: Click2MailHttpRequest[] = []
  const transport: Click2MailTransport = {
    async send(request) {
      requests.push(request)
      if (request.path === "/credit") {
        return xmlResponse(
          `<?xml version="1.0"?><credit><balance>500.00</balance><status>0</status><description>Success</description></credit>`
        )
      }
      const id = request.path.includes("/documents") ? "doc-9" : "job-9"
      return xmlResponse(
        `<?xml version="1.0"?><job><id>${id}</id><status>0</status><description>Success</description></job>`
      )
    },
  }
  const config = loadClick2MailConfig({
    C2M_ENV: "stage",
    C2M_STAGE_USERNAME: "stage-user",
    C2M_STAGE_PASSWORD: "secret",
    C2M_USERNAME: "other",
    C2M_PASSWORD: "other-secret",
  } as unknown as NodeJS.ProcessEnv)
  assert.equal(config.username, "stage-user")
  assert.equal(config.password, "secret")
  assert.equal(config.baseUrl, "https://stage-rest.click2mail.com/molpro")
  const client = createClick2MailClient({ config, transport })
  const order = await placeEddmOrder({
    client,
    config,
    pdf: new Uint8Array([1]),
    size: "6.5x9",
    coverage: "residential",
    routes,
    mailer,
    submitEnabled: true,
    paymentCleared: true,
    documentName: "eddm-card",
    artwork: "type-plate",
    submit: true,
    proof: false,
    now: () => "2026-10-22T00:00:00.000Z",
  })
  assert.equal(order.error, undefined)
  assert.equal(order.jobId, "job-9")
  assert.equal(order.submitted, true)
  const paths = requests.map((request) => request.path)
  assert.equal(EDDM_MAIL_CLASS, "Postage Paid in Advance")
  assert.deepEqual(paths, [
    "/documents",
    "/jobs",
    "/jobs/job-9/eddmInfo",
    "/jobs/job-9/eddmPo",
    "/jobs/job-9/eddmRoute",
    "/credit",
    "/jobs/job-9/submit",
  ])
  assert.equal(paths.some((path) => path.endsWith("/update")), false)
  const job = requests[1]?.form
  assert.equal(job?.documentClass, "EDDM Mailer 6.5 x 9")
  assert.equal(job?.layout, "We Prep and Mail")
  assert.equal(job?.mailClass, "Postage Paid in Advance")
  assert.equal(job?.paperType, "White Matte")
  assert.equal(job?.quantity, "400")
  assert.equal(job?.addressId, undefined)
  const info = requests[2]?.form
  assert.equal(info?.mailerName, "Harbor Roofing")
  assert.equal(info?.mailerAddress1, "1 Main St")
  assert.equal(info?.mailerCity, "New York")
  assert.equal(info?.mailerState, "NY")
  assert.equal(info?.mailerPostalcode, "10001")
  assert.equal(info?.mailerPhone, "(619) 555-0148")
  assert.equal(info?.name, undefined)
  assert.equal(info?.crid, undefined)
  const office = requests[3]?.form
  assert.equal(office?.poName, "JAMES A FARLEY")
  assert.equal(office?.poCity, "NEW YORK")
  assert.equal(office?.poState, "NY")
  assert.equal(office?.poPostalCode, "10001")
  assert.equal(office?.poAddress, "421 8TH AVE")
  assert.equal(office?.phone, "212-330-3296")
  assert.equal(office?.deliveryType, "Residential")
  assert.equal(office?.routeType, "City")
  const route = requests[4]?.form
  assert.equal(route?.route, "10001-C071")
  assert.equal(route?.postalCode, "10001")
  assert.equal(route?.poName, "JAMES A FARLEY")
  assert.equal(route?.totalPieces, "400")
  assert.equal(requests[6]?.form?.billingType, "User Credit")
  assert.equal(requests[6]?.form?.crid, undefined)
})

test("a short User Credit balance stops the order before submit", async () => {
  const requests: Click2MailHttpRequest[] = []
  const transport: Click2MailTransport = {
    async send(request) {
      requests.push(request)
      if (request.path === "/credit") {
        return xmlResponse(
          `<?xml version="1.0"?><credit><balance>0.00</balance><status>0</status><description>Success</description></credit>`
        )
      }
      const id = request.path.includes("/documents") ? "doc-1" : "job-1"
      return xmlResponse(
        `<?xml version="1.0"?><job><id>${id}</id><status>0</status><description>Success</description></job>`
      )
    },
  }
  const config = loadClick2MailConfig(stageEnv)
  const client = createClick2MailClient({ config, transport })
  const order = await placeEddmOrder({
    client,
    config,
    pdf: new Uint8Array([1]),
    size: "6.5x9",
    coverage: "residential",
    routes,
    mailer,
    submitEnabled: true,
    paymentCleared: true,
    documentName: "eddm-card",
    artwork: "type-plate",
    submit: true,
    proof: false,
    now: () => "2026-10-22T00:00:00.000Z",
  })
  assert.equal(order.submitted, false)
  assert.equal(order.eddm?.prepared, true)
  assert.equal(order.error, eddmCreditShortMessage(0, 104))
  assert.equal(requests.at(-1)?.path, "/credit")
  assert.equal(requests.some((request) => request.path.endsWith("/submit")), false)
})

test("a job template starts the Every Door job when one is named", async () => {
  const requests: Click2MailHttpRequest[] = []
  const transport: Click2MailTransport = {
    async send(request) {
      requests.push(request)
      const id = request.path.includes("/documents") ? "doc-3" : "job-3"
      const xml = `<?xml version="1.0"?><job><id>${id}</id><status>0</status><description>Success</description></job>`
      return {
        status: 200,
        contentType: "application/xml",
        body: xml,
        bytes: new TextEncoder().encode(xml),
      }
    },
  }
  const config = loadClick2MailConfig(stageEnv)
  const client = createClick2MailClient({ config, transport })
  const order = await placeEddmOrder({
    client,
    config,
    pdf: new Uint8Array([1]),
    size: "6.25x11",
    coverage: "residential",
    routes,
    mailer,
    submitEnabled: true,
    paymentCleared: true,
    documentName: "eddm-card",
    artwork: "type-plate",
    submit: false,
    proof: false,
    jobTemplateName: "Modern Mail EDDM 6.25 x 11",
    now: () => "2026-10-22T00:00:00.000Z",
  })
  assert.equal(order.error, undefined)
  assert.equal(order.submitted, false)
  assert.equal(requests[1]?.path, "/jobs/jobTemplate")
  assert.equal(requests[1]?.form?.templateName, "Modern Mail EDDM 6.25 x 11")
  assert.equal(requests[2]?.path, "/jobs/job-3/update")
  assert.equal(requests[2]?.form?.documentId, "doc-3")
  assert.equal(requests[2]?.form?.quantity, "400")
  assert.equal(requests[2]?.form?.crid, undefined)
  assert.equal(requests[0]?.fields?.documentClass, "EDDM Mailer 6.25 x 11")
})

function xmlResponse(xml: string) {
  return {
    status: 200,
    contentType: "application/xml",
    body: xml,
    bytes: new TextEncoder().encode(xml),
  }
}

test("staging submit does not require a CRID, and production never enables it", () => {
  const stage = describePrintMailMode({
    C2M_ENV: "stage",
    C2M_STAGE_USERNAME: "u",
    C2M_STAGE_PASSWORD: "p",
    C2M_EDDM_SUBMIT: "true",
  } as unknown as NodeJS.ProcessEnv)
  assert.equal(stage.eddmSubmitEnabled, true)
  assert.equal(stage.eddmPaymentCleared, false)
  const assumed = describePrintMailMode({
    C2M_ENV: "stage",
    C2M_USERNAME: "u",
    C2M_PASSWORD: "p",
    C2M_EDDM_SUBMIT: "true",
    C2M_EDDM_ASSUME_PAID: "true",
  } as unknown as NodeJS.ProcessEnv)
  assert.equal(assumed.eddmPaymentCleared, true)
  const production = describePrintMailMode({
    C2M_ENV: "prod",
    C2M_ALLOW_PRODUCTION: "true",
    C2M_USERNAME: "u",
    C2M_PASSWORD: "p",
    C2M_EDDM_SUBMIT: "true",
    C2M_EDDM_ASSUME_PAID: "true",
    C2M_STAGE_USERNAME: "stage-user",
  } as unknown as NodeJS.ProcessEnv)
  assert.equal(production.eddmSubmitEnabled, false)
  assert.equal(production.eddmPaymentCleared, false)
  assert.equal(loadClick2MailConfig({
    C2M_ENV: "prod",
    C2M_USERNAME: "prod-user",
    C2M_PASSWORD: "prod-secret",
    C2M_STAGE_USERNAME: "stage-user",
    C2M_STAGE_PASSWORD: "stage-secret",
  } as unknown as NodeJS.ProcessEnv).username, "prod-user")
})

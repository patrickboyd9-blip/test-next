import assert from "node:assert/strict"
import { test } from "node:test"

import type { EddmRouteSnapshot } from "@/lib/eddm/routes"

import { createClick2MailClient, type Click2MailHttpRequest, type Click2MailTransport } from "./client"
import { loadClick2MailConfig } from "./config"
import { runStagingEddmOrder } from "./eddm-stage-run"

const route: EddmRouteSnapshot = {
  id: "10001C071",
  zip: "10001",
  route: "C071",
  cityState: "NEW YORK, NY",
  residential: 400,
  business: 0,
  total: 400,
  medianAge: null,
  medianIncome: null,
  householdSize: null,
  postOfficeName: "JAMES A FARLEY",
  postOfficeStreet: "421 8TH AVE",
  postOfficePhone: "212-330-3296",
}

const mailer = {
  name: "Modern Mail Staging",
  address: "1 Main St",
  city: "New York",
  state: "NY",
  zip: "10001",
  phone: "212-555-0100",
}

const options = `<?xml version="1.0"?><productOptions><productOption>
  <documentClass>EDDM Mailer 6.5 x 9</documentClass>
  <layout>We Prep and Mail</layout>
  <productionTime>Next Day</productionTime>
  <envelope> </envelope>
  <color>Full Color</color>
  <paperType>White Matte</paperType>
  <printOption>Printing both sides</printOption>
  <mailClass>PM EDDM (Full Service): includes the Click2Mail permit</mailClass>
</productOption></productOptions>`

function stageConfig() {
  return loadClick2MailConfig({
    C2M_ENV: "stage",
    C2M_STAGE_USERNAME: "stage-user",
    C2M_STAGE_PASSWORD: "stage-secret",
  } as unknown as NodeJS.ProcessEnv)
}

test("a staging run pays with User Credit and returns the job id, status, and cost", async () => {
  const requests: Click2MailHttpRequest[] = []
  const transport: Click2MailTransport = {
    async send(request) {
      requests.push(request)
      if (request.path.endsWith("/productOptions/advanced")) {
        return xml(options)
      }
      if (request.path.endsWith("/cost")) {
        return xml(`<?xml version="1.0"?><job><cost>337.92</cost><tax>0.16</tax><status>0</status><description>Success</description></job>`)
      }
      if (request.path === "/credit") {
        return xml(`<?xml version="1.0"?><credit><balance>347.40</balance><status>0</status><description>Success</description></credit>`)
      }
      const id = request.path.includes("/documents") ? "doc-1" : "job-44"
      return xml(`<?xml version="1.0"?><job><id>${id}</id><status>0</status><description>Success</description><jobStatus>EDITING</jobStatus></job>`)
    },
  }
  const config = stageConfig()
  const client = createClick2MailClient({ config, transport })
  const result = await runStagingEddmOrder({
    client,
    config,
    pdf: new Uint8Array([1]),
    size: "6.5x9",
    crid: "123456789",
    routes: [route],
    mailer,
    env: { C2M_EDDM_BILLING_TYPE: "Invoice" } as NodeJS.ProcessEnv,
  })
  assert.equal(result.error, undefined)
  assert.equal(result.submitted, true)
  assert.equal(result.jobId, "job-44")
  assert.equal(result.cost, 338.08)
  assert.equal(requests.at(-1)?.form?.billingType, "User Credit")
  assert.equal(requests.some((request) => request.path.endsWith("/submit")), true)
  const dumped = JSON.stringify(requests)
  assert.equal(dumped.includes("stage-secret"), false)
  assert.equal(dumped.includes("stage-user"), false)
})

test("a production config makes no Click2Mail calls", async () => {
  const requests: Click2MailHttpRequest[] = []
  const config = loadClick2MailConfig({
    C2M_ENV: "prod",
    C2M_ALLOW_PRODUCTION: "true",
    C2M_USERNAME: "prod-user",
    C2M_PASSWORD: "prod-secret",
  } as unknown as NodeJS.ProcessEnv)
  const client = createClick2MailClient({
    config,
    transport: {
      async send(request) {
        requests.push(request)
        return xml(`<?xml version="1.0"?><job><id>nope</id><status>0</status></job>`)
      },
    },
  })
  const result = await runStagingEddmOrder({
    client,
    config,
    pdf: new Uint8Array([1]),
    size: "6.5x9",
    crid: "123456789",
    routes: [route],
    mailer,
  })
  assert.equal(requests.length, 0)
  assert.equal(result.submitted, false)
  assert.match(result.error ?? "", /staging/)
})

function xml(body: string) {
  return {
    status: 200,
    contentType: "application/xml",
    body,
    bytes: new TextEncoder().encode(body),
  }
}

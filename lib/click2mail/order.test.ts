import assert from "node:assert/strict"
import { test } from "node:test"

import { loadClick2MailConfig } from "./config"
import { createMockClick2MailClient } from "./mock-client"
import { placeClick2MailOrder, refreshClick2MailOrder } from "./order"
import { parseRecipientCsv, normalizeRecipient, normalizeZip } from "./recipients"

const recipient = {
  first: "Ada",
  last: "Lovelace",
  organization: "",
  address1: "1 Main St",
  address2: "",
  city: "Austin",
  state: "TX",
  zip: "78701",
}

test("CSV validation normalizes state and ZIP and reports bad rows", () => {
  assert.equal(normalizeZip("78701-1234"), "78701-1234")
  assert.equal(normalizeZip("787011234"), "78701-1234")
  const parsed = parseRecipientCsv(
    "first,last,address1,address2,city,state,zip\nAda,Lovelace,1 Main St,,Austin,Texas,78701\n,, ,,,nope,\n"
  )
  assert.equal(parsed.recipients.length, 1)
  assert.equal(parsed.recipients[0]?.state, "TX")
  assert.equal(parsed.recipients[0]?.zip, "78701")
  assert.ok(parsed.errors.some((error) => error.includes("Row 3")))

  const quoted = parseRecipientCsv(
    'first,last,address1,address2,city,state,zip\n"Ann, A.",Lee,"1 Main St, Apt 2",,Austin,TX,78701\n'
  )
  assert.equal(quoted.errors.length, 0)
  assert.equal(quoted.recipients[0]?.address1, "1 Main St, Apt 2")

  const self = normalizeRecipient({
    first: "Ada",
    last: "Lovelace",
    address1: "1 Main St",
    city: "Austin",
    state: "tx",
    zip: "78701",
  })
  assert.equal(self.errors.length, 0)
  assert.equal(self.recipient?.state, "TX")
})

test("mock client places a staging order and polls status", async () => {
  const mock = createMockClick2MailClient({ addressStatuses: [0, 5] })
  let clock = 0
  const config = loadClick2MailConfig({
    C2M_ENV: "stage",
    C2M_USERNAME: "user",
    C2M_PASSWORD: "secret",
    C2M_LAYOUT: "Double Sided Postcard",
  } as NodeJS.ProcessEnv)

  const order = await placeClick2MailOrder({
    client: mock,
    config,
    pdf: new Uint8Array([1]),
    recipients: [recipient],
    documentName: "sample",
    addressListName: "sample list",
    artwork: "type-plate",
    submit: true,
    proof: true,
    returnAddress: { rtnOrganization: "Modern Mail Test" },
    sleep: async () => {
      clock += 2_000
    },
    clock: () => clock,
    now: () => "2026-10-10T00:00:00.000Z",
    pollTimeoutMs: 10_000,
  })

  assert.equal(order.mode, "test")
  assert.equal(order.environment, "stage")
  assert.equal(order.documentId, "doc-1")
  assert.equal(order.addressListId, "list-1")
  assert.equal(order.addressListStatus, 5)
  assert.equal(order.jobId, "job-1")
  assert.equal(order.proofId, "proof-1")
  assert.equal(order.submitted, true)
  assert.equal(order.jobStatus, "ORDER_SUBMITTED")
  assert.equal(order.error, undefined)
  assert.equal(mock.lastJob?.product.layout, "Double Sided Postcard")
  assert.equal(mock.lastJob?.returnAddress?.rtnOrganization, "Modern Mail Test")
  assert.deepEqual(mock.calls.filter((call) => call.startsWith("getAddressList")), [
    "getAddressList:list-1",
    "getAddressList:list-1",
  ])

  const refreshed = await refreshClick2MailOrder({
    client: mock,
    order,
    now: () => "2026-10-10T00:01:00.000Z",
  })
  assert.equal(refreshed.jobStatus, "AWAITING_PRODUCTION")
  assert.equal(refreshed.trackingPieceCount, 0)
  assert.equal(refreshed.lastPolledAt, "2026-10-10T00:01:00.000Z")
})

test("a list that stays pending is saved without a job", async () => {
  const mock = createMockClick2MailClient({ addressStatuses: [1, 1, 1, 1] })
  const config = loadClick2MailConfig({
    C2M_ENV: "stage",
    C2M_USERNAME: "user",
    C2M_PASSWORD: "secret",
  } as NodeJS.ProcessEnv)
  const order = await placeClick2MailOrder({
    client: mock,
    config,
    pdf: new Uint8Array([1]),
    recipients: [recipient],
    documentName: "sample",
    addressListName: "sample list",
    artwork: "final-photo",
    submit: true,
    proof: true,
    sleep: async () => undefined,
    clock: () => 0,
    pollTimeoutMs: 0,
  })
  assert.equal(order.jobId, undefined)
  assert.match(order.error ?? "", /still processing/)
  assert.equal(mock.calls.includes("createJob"), false)
})

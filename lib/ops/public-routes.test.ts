import assert from "node:assert/strict"
import { test } from "node:test"

import { GET as printSpec } from "@/app/api/print-spec/postcard-5x8/route"
import { GET as template } from "@/app/api/templates/postcard/route"
import { POST as cardsImport } from "@/app/api/cards/import/route"
import { POST as cardsPeople } from "@/app/api/cards/people/route"
import { POST as cardLock } from "@/app/api/cards/[id]/lock/route"
import { PATCH as cardPatch } from "@/app/api/cards/[id]/route"
import { GET as studioImage } from "@/app/api/studio-image/[campaignId]/[file]/route"
import { GET as uploadedDesign } from "@/app/api/uploaded-design/[campaignId]/[file]/route"
import { GET as designFile } from "@/app/api/design-requests/[id]/[file]/route"
import { POST as campaignDesign } from "@/app/api/campaigns/[id]/design/route"
import { GET as jobProof } from "@/app/api/campaigns/[id]/job-proof/route"
import { GET as printProof } from "@/app/api/campaigns/[id]/print-proof/[face]/route"
import { GET as cron } from "@/app/api/cron/design-library/route"
import { POST as benchmark } from "@/app/api/design-benchmark/route"
import { POST as blueprints } from "@/app/api/design-library/blueprints/route"
import { POST as librarySync } from "@/app/api/design-library/sync/route"
import { GET as vision } from "@/app/api/design-library/vision-taste/route"
import { POST as mcp } from "@/app/api/mcp/route"
import { POST as stripeHook } from "@/app/api/stripe/webhook/route"
import { POST as paymentHook } from "@/app/api/payments/webhook/route"
import { GET as oauthMeta } from "@/app/.well-known/oauth-authorization-server/route"
import { limitPublic } from "@/lib/ops/public-rate"

test("an anonymous caller cannot open private files, cards, or paid jobs", async () => {
  const cases: Array<[string, Response | Promise<Response>]> = [
    ["print spec", printSpec(new Request("http://localhost/api/print-spec/postcard-5x8"))],
    ["template", template(new Request("http://localhost/api/templates/postcard?size=5x8"))],
    ["card import", cardsImport(new Request("http://localhost/api/cards/import", { method: "POST", body: "{}" }))],
    ["card people", cardsPeople(new Request("http://localhost/api/cards/people", { method: "POST", body: "{}" }))],
    ["card lock", cardLock(new Request("http://localhost/api/cards/x/lock", { method: "POST" }), { params: Promise.resolve({ id: "x" }) })],
    ["card edit", cardPatch(new Request("http://localhost/api/cards/x", { method: "PATCH", body: "{}" }), { params: Promise.resolve({ id: "x" }) })],
    ["studio image", studioImage(new Request("http://localhost/api/studio-image/x/a.png"), { params: Promise.resolve({ campaignId: "x", file: "a.png" }) })],
    ["uploaded design", uploadedDesign(new Request("http://localhost/api/uploaded-design/x/front.png"), { params: Promise.resolve({ campaignId: "x", file: "front.png" }) })],
    ["design request file", designFile(new Request("http://localhost/api/design-requests/x/logo.png"), { params: Promise.resolve({ id: "x", file: "logo.png" }) })],
    ["campaign design", campaignDesign(new Request("http://localhost/api/campaigns/x/design", { method: "POST" }), { params: Promise.resolve({ id: "x" }) })],
    ["job proof", jobProof(new Request("http://localhost/api/campaigns/x/job-proof"), { params: Promise.resolve({ id: "x" }) })],
    ["print proof", printProof(new Request("http://localhost/api/campaigns/x/print-proof/front"), { params: Promise.resolve({ id: "x", face: "front" }) })],
    ["cron", cron(new Request("http://localhost/api/cron/design-library"))],
    ["benchmark", benchmark(new Request("http://localhost/api/design-benchmark", { method: "POST" }))],
    ["blueprints", blueprints(new Request("http://localhost/api/design-library/blueprints", { method: "POST", body: "{}" }))],
    ["library sync", librarySync(new Request("http://localhost/api/design-library/sync", { method: "POST" }))],
    ["vision taste", vision(new Request("http://localhost/api/design-library/vision-taste"))],
    ["mcp", mcp(new Request("http://localhost/api/mcp", { method: "POST", body: "{}" }))],
  ]
  for (const [name, pending] of cases) {
    const response = await pending
    assert.equal(response.status, 401, name)
  }
})

test("a webhook without a signature does not mark anything paid", async () => {
  const stripe = await stripeHook(new Request("http://localhost/api/stripe/webhook", { method: "POST", body: "{}" }))
  const stripeBody = (await stripe.json()) as { charged?: boolean }
  assert.equal(stripe.status, 400)
  assert.equal(stripeBody.charged, false)
  const payment = await paymentHook(
    new Request("http://localhost/api/payments/webhook", {
      method: "POST",
      body: JSON.stringify({ eventId: "e", orderId: "o", outcome: "succeeded", currency: "usd", amountCents: 1 }),
    }),
  )
  const paymentBody = (await payment.json()) as { ok?: boolean; mailed?: boolean }
  assert.equal(payment.status, 400)
  assert.equal(paymentBody.ok, false)
  assert.equal(paymentBody.mailed, false)
})

test("the assistant sign-in discovery page stays public", async () => {
  const response = await oauthMeta(new Request("http://localhost/.well-known/oauth-authorization-server"))
  assert.equal(response.status, 200)
})

test("a public burst from one address is slowed", async () => {
  const name = `burst-${Date.now()}`
  const request = new Request("http://localhost/r/x", { headers: { "x-forwarded-for": `203.0.113.${name.length}` } })
  assert.equal(await limitPublic(request, name, 2), null)
  assert.equal(await limitPublic(request, name, 2), null)
  const blocked = await limitPublic(request, name, 2)
  assert.equal(blocked?.status, 429)
})

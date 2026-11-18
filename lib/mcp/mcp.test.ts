import assert from "node:assert/strict"
import { createHash, randomBytes } from "node:crypto"
import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { after, before, test } from "node:test"

import { createCampaignRepository, type CampaignRepository } from "@/lib/campaign-creator/repository"
import type { UploadedDesignStore } from "@/lib/bring-your-own-design/store"
import { createFileJourneyStore, type JourneyStore } from "@/lib/mail-journey/job"
import { createMemoryDocumentStore } from "@/lib/storage/document-store"
import { readAudit } from "@/lib/ops/audit"
import { setSpendingCap } from "@/lib/ops/spend-cap"

import { principalFromAuthorization } from "./http"
import { resetCustomerLists } from "./lists"
import { exchangeAuthorizationCode, exchangeRefreshToken, issueAuthorizationCode, registerOAuthClient, resetOAuthStore } from "./oauth"
import { handleMcp } from "./protocol"
import { leaksInternalText, toPublic } from "./public"
import { callMcpTool, toolCatalog, type McpContext } from "./tools"
import { createAssistantToken, resetAssistantTokens, resolveAssistantToken } from "./tokens"

const PNG =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=="

const CSV = ["first,last,address,city,state,zip", "Ada,Lovelace,1 Main St,Austin,TX,78701", "Grace,Hopper,2 Main St,Austin,TX,78702"].join("\n")

let repository: CampaignRepository
let journey: JourneyStore
let directory = ""

before(async () => {
  resetAssistantTokens()
  resetCustomerLists()
  resetOAuthStore()
  directory = await mkdtemp(path.join(tmpdir(), "mm-mcp-"))
  repository = createCampaignRepository(createMemoryDocumentStore())
  journey = createFileJourneyStore(directory)
})

after(async () => {
  if (directory) await rm(directory, { recursive: true, force: true })
})

test("a token works for one account and stops when it is revoked", async () => {
  const minted = await createAssistantToken({ userId: "ada-token", name: "Desk" })
  assert.match(minted.secret, /^mm_/)
  assert.equal((await resolveAssistantToken(minted.secret))?.userId, "ada-token")
  assert.equal((await principalFromAuthorization(`Bearer ${minted.secret}`))?.userId, "ada-token")
  const { revokeAssistantToken } = await import("./tokens")
  assert.equal(await revokeAssistantToken("ada-token", minted.id), true)
  assert.equal(await resolveAssistantToken(minted.secret), null)
  assert.equal(await principalFromAuthorization("Bearer nope"), null)
})

test("sign-in codes become a token only when the check matches", async () => {
  const registered = await registerOAuthClient({
    client_name: "Desk",
    redirect_uris: ["http://127.0.0.1:9/callback"],
  })
  assert.ok(!("error" in registered))
  const verifier = randomBytes(32).toString("base64url")
  const challenge = createHash("sha256").update(verifier).digest("base64url")
  const issued = await issueAuthorizationCode({
    userId: "ada-oauth",
    clientId: registered.client_id,
    redirectUri: "http://127.0.0.1:9/callback",
    challenge,
    method: "S256",
  })
  assert.ok(!("error" in issued))
  const bad = await exchangeAuthorizationCode({
    code: issued.code,
    clientId: registered.client_id,
    redirectUri: "http://127.0.0.1:9/callback",
    verifier: "not-the-check",
  })
  assert.ok("error" in bad)
  const again = await issueAuthorizationCode({
    userId: "ada-oauth",
    clientId: registered.client_id,
    redirectUri: "http://127.0.0.1:9/callback",
    challenge,
    method: "S256",
  })
  assert.ok(!("error" in again))
  const exchanged = await exchangeAuthorizationCode({
    code: again.code,
    clientId: registered.client_id,
    redirectUri: "http://127.0.0.1:9/callback",
    verifier,
  })
  assert.ok(!("error" in exchanged))
  assert.equal((await resolveAssistantToken(exchanged.access_token))?.userId, "ada-oauth")
  const refreshed = await exchangeRefreshToken(exchanged.refresh_token)
  assert.ok(!("error" in refreshed))
  assert.equal(await resolveAssistantToken(exchanged.access_token), null)
  assert.equal((await resolveAssistantToken(refreshed.access_token))?.userId, "ada-oauth")
})

test("creating a mailer requires a name and a size, and the price is the full price", async () => {
  const ctx = context("ada-create")
  const missing = await callMcpTool("create_mailer", { brief: "A spring postcard for neighbors." }, ctx)
  assert.equal(missing.isError, true)
  assert.match(missing.text, /campaign name/)
  const sized = await callMcpTool("create_mailer", { name: "Spring", brief: "A spring postcard for neighbors." }, ctx)
  assert.equal(sized.isError, true)
  assert.match(sized.text, /5x8 or 6x9/)
  const created = body(await callMcpTool("create_mailer", { name: "Spring", size: "5x8", brief: "A spring postcard for neighbors near the shop." }, ctx))
  assert.equal(created.charged, false)
  assert.equal(created.mailed, false)
  assert.equal(created.size, "5x8")
  const events = await readAudit()
  assert.equal(events.some((event) => event.action === "create" && event.actorId === "ada-create" && event.subjectId === created.campaignId), true)

  const listed = body(await callMcpTool("upload_list", { campaignId: created.campaignId, name: "Neighbors", csv: CSV }, ctx))
  assert.equal(listed.accepted, 2)
  const price = body(await callMcpTool("get_proof_and_price", { campaignId: created.campaignId }, ctx))
  assert.equal(price.postageOnly, false)
  assert.equal(price.fullPrice, true)
  assert.equal(price.label, "Placeholder")
  assert.match(String(price.detail), /Full price/)
  assert.match(String(price.detail), /Not postage by itself/)
  assert.equal(price.charged, false)
  assert.equal(price.mailed, false)

  const priced = body(await callMcpTool("get_proof_and_price", { campaignId: created.campaignId }, context("ada-create", priceEnv(100))))
  assert.equal(priced.label, "$2.00")
  assert.equal(priced.postageOnly, false)
  assert.doesNotMatch(JSON.stringify(priced), /perPiece|margin|postage only/i)
})

test("an assistant can ask for approval and cannot approve, print, or charge", async () => {
  const ctx = context("ada-approve", priceEnv(100))
  const created = body(await callMcpTool("create_mailer", { name: "Approve me", size: "6x9", brief: "A note for past customers about a free check." }, ctx))
  await callMcpTool("upload_list", { campaignId: created.campaignId, name: "Past", csv: CSV }, ctx)
  await setSpendingCap("ada-approve", 100)
  const asked = body(await callMcpTool("request_approval", { campaignId: created.campaignId }, ctx))
  assert.equal(asked.approved, false)
  assert.equal(asked.charged, false)
  assert.equal(asked.mailed, false)
  assert.equal(asked.postageOnly, false)
  assert.match(String(asked.message), /Modern Mail/)
  assert.match(String(asked.cap), /spending cap/)
  const events = await readAudit()
  assert.equal(events.some((event) => event.action === "approve" && event.subjectId === created.campaignId), false)
  assert.equal(events.some((event) => event.action === "charge" && event.subjectId === created.campaignId && (event.after as { charged?: boolean }).charged === true), false)
  assert.equal(toolCatalog().some((tool) => /cap|approve|charge|print/i.test(tool.name)), false)
})

test("one account cannot see another account's mailer or list", async () => {
  const ada = context("ada-wall")
  const bea = context("bea-wall")
  const created = body(await callMcpTool("create_mailer", { name: "Ada private", size: "5x8", brief: "A private note for Ada's own customers only." }, ada))
  const list = body(await callMcpTool("upload_list", { campaignId: created.campaignId, name: "Ada list", csv: CSV }, ada))
  const peeked = await callMcpTool("mailer_status", { campaignId: created.campaignId }, bea)
  assert.equal(peeked.isError, true)
  assert.doesNotMatch(peeked.text, /Ada private/)
  const stolen = await callMcpTool("choose_list", { campaignId: created.campaignId, listId: list.listId }, bea)
  assert.equal(stolen.isError, true)
  assert.match(stolen.text, /not found/)
  const copy = body(await callMcpTool("duplicate_mailer", { campaignId: created.campaignId }, ada))
  assert.notEqual(copy.campaignId, created.campaignId)
  assert.equal(copy.approved, false)
  assert.equal(copy.charged, false)
  const beaCopy = await callMcpTool("mailer_status", { campaignId: copy.campaignId }, bea)
  assert.equal(beaCopy.isError, true)
})

test("gallery, upload, and status stay inside the customer's own words", async () => {
  const ctx = context("ada-gallery")
  const created = body(await callMcpTool("create_mailer", { name: "Gallery", size: "5x8", brief: "A roof check for homeowners on this street." }, ctx))
  const gallery = body(await callMcpTool("list_gallery", { industry: "roofing" }, ctx))
  const templates = gallery.templates as { id: string; summary: string }[]
  assert.ok(templates.length > 0)
  assert.equal(leaksInternalText(JSON.stringify(gallery)), false)
  assert.doesNotMatch(JSON.stringify(gallery), /sourcePattern|gold\//)
  const six = body(await callMcpTool("create_mailer", { name: "Big", size: "6x9", brief: "A larger card for the same roof check offer." }, ctx))
  const refused = await callMcpTool("use_gallery_template", { campaignId: six.campaignId, templateId: "roofing-free-inspection" }, ctx)
  assert.equal(refused.isError, true)
  assert.match(refused.text, /5×8/)
  const used = body(await callMcpTool("use_gallery_template", { campaignId: created.campaignId, templateId: templates[0].id }, ctx))
  assert.equal(used.charged, false)
  assert.equal(leaksInternalText(JSON.stringify(used)), false)
  const status = body(await callMcpTool("mailer_status", { campaignId: created.campaignId }, ctx))
  assert.equal(status.results && (status.results as { scans: string }).scans, "Not recorded yet")
  assert.equal(status.mailed, false)

  const uploaded = body(
    await callMcpTool(
      "upload_design",
      {
        campaignId: six.campaignId,
        face: "front",
        fileName: "front.png",
        contentBase64: PNG,
        businessName: "Harbor Roofing",
        street: "1 Main St",
        city: "Austin",
        state: "TX",
        postalCode: "78701",
      },
      ctx
    )
  )
  assert.equal(uploaded.charged, false)
  assert.equal(uploaded.front, true)
  assert.equal(leaksInternalText(JSON.stringify(uploaded)), false)
})

test("assistant replies hide partners, costs, and prompts, and a burst slows down", async () => {
  const hidden = toPublic({ note: "We print at click2mail and the margin is 40." })
  assert.match(JSON.stringify(hidden), /stays inside Modern Mail/)
  assert.equal(leaksInternalText(JSON.stringify(hidden)), false)
  const opened = await handleMcp({ jsonrpc: "2.0", id: 1, method: "initialize" }, context("ada-proto"))
  assert.equal(leaksInternalText(JSON.stringify(opened)), false)
  assert.equal(leaksInternalText(JSON.stringify(toolCatalog())), false)
  const ctx = context("ada-burst")
  let blocked = false
  for (let i = 0; i < 31; i += 1) {
    const result = await callMcpTool("list_lists", {}, ctx)
    if (result.isError && /Too many requests/.test(result.text)) blocked = true
  }
  assert.equal(blocked, true)
  const events = await readAudit()
  assert.equal(events.some((event) => event.actorId === "ada-burst" && event.action === "status"), true)
})

function context(userId: string, env?: NodeJS.ProcessEnv): McpContext {
  return {
    userId,
    origin: "https://mail.example",
    repository,
    journey,
    designs: memoryDesigns(),
    env,
  }
}

function body(result: { text: string; isError: boolean }): Record<string, unknown> {
  assert.equal(result.isError, false, result.text)
  return JSON.parse(result.text) as Record<string, unknown>
}

function priceEnv(perPieceCents: number): NodeJS.ProcessEnv {
  return {
    ...process.env,
    MAIL_APPROVED_PRICE_JSON: JSON.stringify({
      id: "sched",
      status: "approved",
      currency: "usd",
      perPieceCents,
      termsVersion: "v1",
      effectiveUntil: "2099-01-01T00:00:00.000Z",
    }),
  }
}

function memoryDesigns(): UploadedDesignStore {
  const files = new Map<string, Buffer>()
  return {
    async put(campaignId, key, bytes) {
      files.set(`${campaignId}/${key}`, Buffer.from(bytes))
    },
    async get(campaignId, key) {
      const found = files.get(`${campaignId}/${key}`)
      return found ? { bytes: found } : null
    },
  }
}

import assert from "node:assert/strict"
import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { test } from "node:test"

import { POST as designUpload } from "@/app/api/campaigns/[id]/design/route"
import { GET as printProof } from "@/app/api/campaigns/[id]/print-proof/[face]/route"
import { GET as designRequestFile } from "@/app/api/design-requests/[id]/[file]/route"
import { GET as studioImage } from "@/app/api/studio-image/[campaignId]/[file]/route"
import { GET as uploadedDesign } from "@/app/api/uploaded-design/[campaignId]/[file]/route"
import { createDraftCampaign } from "@/lib/campaign-creator/actions"
import { createCampaignRepository } from "@/lib/campaign-creator/repository"
import { honestCustomerSnapshot } from "@/lib/command-center/data"
import { designRequestsForAccount } from "@/lib/design-requests/visibility"
import { saveDesignRequest } from "@/lib/design-requests/save"
import { createFileDesignRequestStore } from "@/lib/design-requests/store"
import type { DesignRequest } from "@/lib/design-requests/types"
import { createFileDocumentStore } from "@/lib/storage/document-store"

import { CampaignAccessError, requireOwnedCampaign } from "./campaign-access"
import { quarantinedRecordIds } from "./ownership"
import { getSession, runAs, signSessionToken, verifySessionToken, type AccountSession } from "./session"

const alice: AccountSession = {
  userId: "alice@example.com",
  email: "alice@example.com",
  name: "Alice Nguyen",
  businessName: "Alice Co",
  fixture: false,
}
const bob: AccountSession = {
  userId: "bob@example.com",
  email: "bob@example.com",
  name: "Bob Singh",
  businessName: "Bob Co",
  fixture: false,
}

test("a session fails closed without a provider, and a dev fixture never runs in production", { concurrency: false }, async () => {
  const previousNode = process.env.NODE_ENV
  const previousMode = process.env.AUTH_MODE
  const previousSecret = process.env.AUTH_SECRET
  delete process.env.AUTH_MODE
  delete process.env.AUTH_SECRET
  try {
    const env = process.env as { NODE_ENV?: string }
    assert.equal(await getSession(), null)
    env.NODE_ENV = "development"
    process.env.AUTH_MODE = "dev-fixture"
    const fixture = await getSession()
    assert.equal(fixture?.fixture, true)
    assert.equal(fixture?.userId, "jordan@jordansplumbing.com")
    env.NODE_ENV = "production"
    assert.equal(await getSession(), null)
  } finally {
    ;(process.env as { NODE_ENV?: string }).NODE_ENV = previousNode
    if (previousMode === undefined) delete process.env.AUTH_MODE
    else process.env.AUTH_MODE = previousMode
    if (previousSecret === undefined) delete process.env.AUTH_SECRET
    else process.env.AUTH_SECRET = previousSecret
  }
})

test("a signed token opens only the account it names", () => {
  const secret = "test-secret"
  const token = signSessionToken(alice, secret, 1_000)
  const opened = verifySessionToken(token, secret, 1_000)
  assert.equal(opened?.userId, alice.userId)
  assert.equal(opened?.fixture, false)
  assert.equal(verifySessionToken(token, "other-secret", 1_000), null)
  assert.equal(verifySessionToken(`${token}x`, secret, 1_000), null)
  assert.equal(verifySessionToken(token, secret, 1_000 + 15 * 24 * 60 * 60 * 1000), null)
})

test("one account cannot read or write another account's campaign, and a blank owner is not assigned", async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "mm-owners-"))
  try {
    const repository = createCampaignRepository(createFileDocumentStore(directory))
    const aliceCampaign = await repository.createCampaign(alice.userId)
    const bobCampaign = await repository.createCampaign(bob.userId)
    const unowned = await repository.createCampaign("")
    const before = unowned.ownerId

    const loaded = await runAs(alice, () => requireOwnedCampaign(aliceCampaign.id, repository))
    assert.equal(loaded.id, aliceCampaign.id)

    await assert.rejects(
      () => runAs(bob, () => requireOwnedCampaign(aliceCampaign.id, repository)),
      (error: unknown) => error instanceof CampaignAccessError && error.status === 404
    )
    await assert.rejects(
      () => runAs(null, () => requireOwnedCampaign(aliceCampaign.id, repository)),
      (error: unknown) => error instanceof CampaignAccessError && error.status === 401
    )
    await assert.rejects(
      () => runAs(alice, () => requireOwnedCampaign(unowned.id, repository)),
      (error: unknown) => error instanceof CampaignAccessError && error.status === 404
    )
    await assert.rejects(
      () => runAs(bob, () => requireOwnedCampaign(bobCampaign.id, repository)).then(() => requireOwnedCampaign(aliceCampaign.id, repository)),
      (error: unknown) => error instanceof CampaignAccessError && error.status === 401
    )

    const again = await repository.getCampaign(unowned.id)
    assert.equal(again?.ownerId, before)
    assert.deepEqual(quarantinedRecordIds([aliceCampaign, bobCampaign, unowned]), [unowned.id])
    assert.equal((await repository.getCampaign(aliceCampaign.id))?.ownerId, alice.userId)
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
})

test("a signed-out caller cannot open a draft, and the dashboard snapshot is not the sample campaign", async () => {
  await assert.rejects(
    () => runAs(null, () => createDraftCampaign()),
    (error: unknown) => error instanceof CampaignAccessError && error.status === 401
  )
  const snapshot = honestCustomerSnapshot(alice)
  const text = JSON.stringify(snapshot)
  assert.equal(text.includes("Spring Tune-Up"), false)
  assert.equal(text.includes("29%"), false)
  assert.equal(snapshot.metrics.length, 0)
  assert.equal(snapshot.confidence, null)
  assert.equal(snapshot.mailStatus, null)
  assert.equal(snapshot.greetingName, "Alice")
})

test("design requests stay with the account that owns them", async () => {
  const rows = [
    { id: "a", ownerId: alice.userId },
    { id: "b", ownerId: bob.userId },
    { id: "c" },
  ] as DesignRequest[]
  assert.deepEqual(designRequestsForAccount(rows, alice).map((row) => row.id), ["a"])
  assert.deepEqual(designRequestsForAccount(rows, null), [])

  const directory = await mkdtemp(path.join(tmpdir(), "mm-request-owner-"))
  try {
    const requests = createFileDesignRequestStore(directory)
    const saved = await saveDesignRequest(
      {
        companyName: "Harbor Roofing",
        address: "100 Main St, Austin, TX 78701",
        vibe: "Calm and local",
        offer: "Free inspection",
        responseMethods: ["phone"],
        phone: "(512) 555-0148",
      },
      {},
      { requests, ownerId: alice.userId }
    )
    assert.equal(saved.ok, true)
    if (!saved.ok) return
    const listed = await requests.list()
    assert.equal(listed[0]?.ownerId, alice.userId)
    assert.deepEqual(designRequestsForAccount(listed, bob), [])
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
})

test("campaign and design-request files refuse a signed-out request", async () => {
  const params = Promise.resolve({ campaignId: "camp", file: "logo-abcdef12.png", id: "camp", face: "front" })
  const studio = await runAs(null, () =>
    studioImage(new Request("http://localhost/api/studio-image/camp/logo-abcdef12.png"), {
      params: Promise.resolve({ campaignId: "camp", file: "logo-abcdef12.png" }),
    })
  )
  const uploaded = await runAs(null, () =>
    uploadedDesign(new Request("http://localhost/api/uploaded-design/camp/front.png"), {
      params: Promise.resolve({ campaignId: "camp", file: "front.png" }),
    })
  )
  const proof = await runAs(null, () =>
    printProof(new Request("http://localhost/api/campaigns/camp/print-proof/front"), {
      params: Promise.resolve({ id: "camp", face: "front" }),
    })
  )
  const requestFile = await runAs(null, () =>
    designRequestFile(new Request("http://localhost/api/design-requests/req/logo.png"), {
      params: Promise.resolve({ id: "req", file: "logo.png" }),
    })
  )
  const upload = await runAs(null, () =>
    designUpload(new Request("http://localhost/api/campaigns/camp/design", { method: "POST" }), {
      params: Promise.resolve({ id: "camp" }),
    })
  )
  assert.equal(studio.status, 401)
  assert.equal(uploaded.status, 401)
  assert.equal(proof.status, 401)
  assert.equal(requestFile.status, 401)
  assert.equal(upload.status, 401)
  assert.equal(studio.headers.get("cache-control"), "private, no-store")
  void params
})

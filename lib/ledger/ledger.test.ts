import assert from "node:assert/strict"
import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { test } from "node:test"

import { runAs, type AccountSession } from "@/lib/auth/session"
import { createCampaignRepository } from "@/lib/campaign-creator/repository"
import { createFileDocumentStore } from "@/lib/storage/document-store"

import { createFileLedgerStore, paidAmount, type LedgerEvent } from "./event"
import { historyForCampaign, noteEvent } from "./note"

const alice: AccountSession = {
  userId: "alice@example.com",
  email: "alice@example.com",
  name: "Alice",
  businessName: "Alice Co",
  fixture: false,
}
const bob: AccountSession = { ...alice, userId: "bob@example.com", email: "bob@example.com", name: "Bob", businessName: "Bob Co" }

function event(partial: Partial<LedgerEvent> & Pick<LedgerEvent, "type" | "outcome" | "versionKey">): Omit<LedgerEvent, "id"> {
  return {
    ownerId: alice.userId,
    campaignId: "camp",
    occurredAt: "2026-11-08T00:00:00.000Z",
    creativeVersion: "proof-1",
    listHash: "abc",
    listCount: 2,
    amountCents: null,
    note: "2 addresses accepted. The rows themselves are not stored in this history.",
    ...partial,
  }
}

test("duplicate and out-of-order events do not invent a payment", async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "mm-ledger-"))
  try {
    const ledger = createFileLedgerStore(directory)
    const first = event({ type: "list_reviewed", outcome: "completed", versionKey: "list-1" })
    const again = await Promise.all([noteEvent(ledger, first), noteEvent(ledger, { ...first, occurredAt: "2026-11-08T01:00:00.000Z" })])
    assert.equal(again[0].event.id, again[1].event.id)
    assert.equal(again.filter((item) => item.created).length, 1)
    assert.equal(first.note.includes("Main St"), false)
    await noteEvent(ledger, event({
      type: "payment_recorded",
      outcome: "unknown",
      versionKey: "evt-unknown",
      amountCents: null,
      note: "The provider has not confirmed this charge.",
      occurredAt: "2026-11-08T02:00:00.000Z",
    }))
    await noteEvent(ledger, event({
      type: "checkout_blocked",
      outcome: "failed",
      versionKey: "blocked-1",
      amountCents: null,
      note: "No approved price is configured. Nothing was charged.",
      occurredAt: "2026-11-08T03:00:00.000Z",
    }))
    const events = await ledger.list(alice.userId, "camp")
    assert.equal(events.length, 3)
    assert.equal(paidAmount(events), null)
    assert.equal(events.some((item) => item.outcome === "unknown" && item.amountCents === null), true)
    assert.equal(events.some((item) => item.outcome === "failed"), true)
    const bobEvents = await ledger.list(bob.userId, "camp")
    assert.equal(bobEvents.length, 0)
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
})

test("history follows the campaign owner and keeps the saved creative version", async () => {
  const campaigns = await mkdtemp(path.join(tmpdir(), "mm-ledger-camp-"))
  const events = await mkdtemp(path.join(tmpdir(), "mm-ledger-events-"))
  try {
    const repository = createCampaignRepository(createFileDocumentStore(campaigns))
    const ledger = createFileLedgerStore(events)
    const campaign = await repository.createCampaign(alice.userId)
    await noteEvent(ledger, event({
      ownerId: alice.userId,
      campaignId: campaign.id,
      type: "guidance_saved",
      outcome: "completed",
      versionKey: "guide-1",
      creativeVersion: "src-abc",
      listHash: null,
      listCount: null,
      note: "Guidance saved. No replies were measured.",
    }))
    const owned = await runAs(alice, () => historyForCampaign(campaign.id, repository, ledger))
    assert.equal(owned.events.length, 1)
    assert.equal(owned.events[0]?.creativeVersion, "src-abc")
    assert.equal(paidAmount(owned.events), null)
    await assert.rejects(
      () => runAs(bob, () => historyForCampaign(campaign.id, repository, ledger)),
      (error: unknown) => error instanceof Error && "status" in error && (error as { status: number }).status === 404
    )
  } finally {
    await rm(campaigns, { recursive: true, force: true })
    await rm(events, { recursive: true, force: true })
  }
})

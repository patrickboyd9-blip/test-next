import assert from "node:assert/strict"
import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { test } from "node:test"

import type { JobCreative } from "@/lib/campaign-creator/types"

import { importEvents } from "./import"
import { emptyPolicy, type FollowUpPolicy } from "./policy"
import { buildProposal, handoffBlockers } from "./proposal"
import { createFileFollowUpStore } from "./store"

const csv = [
  "source,event id,status,last contact,permission,first,last,address,apt,city,state,zip",
  "shop-file,e1,open,2026-10-01,yes,Ada,Lovelace,123 Main St,Apt 4B,San Diego,CA,92101",
  "shop-file,e1,open,2026-10-01,yes,Ada,Lovelace,123 Main St,Apt 4B,San Diego,CA,92101",
  "shop-file,e2,converted,2026-09-01,yes,Grace,Hopper,1 Navy Way,,Arlington,VA,22201",
  "shop-file,e3,opt-out,2026-08-01,yes,Ken,Opt,9 Oak,,Austin,TX,78701",
  "shop-file,e4,open,2026-11-07,yes,Recent,Touch,4 Pine,,Dallas,TX,75201",
  "shop-file,e5,open,,no,No,Permit,8 Elm,,Boise,ID,83702",
  "shop-file,e6,open,2026-01-01,yes,Open,Job,2 Oak,,Tulsa,OK,74103",
].join("\n")

function policy(): FollowUpPolicy {
  return {
    playSelected: true,
    cap: 2,
    recentContactDays: 14,
    excludeConverted: true,
    excludeOptOut: true,
    mailPermission: true,
    photoPermission: true,
    storyPermission: true,
  }
}

function job(): JobCreative {
  return {
    rightsConfirmedAt: "2026-11-01T00:00:00.000Z",
    trade: "roofing",
    serviceAction: "Replacement",
    photos: [
      {
        id: "photo1",
        role: "job-photo",
        fileName: "job-photo1.png",
        width: 800,
        height: 600,
        keep: { x: 0.2, y: 0.2, w: 0.4, h: 0.4 },
        protect: "service-object",
        detail: "ok",
        createdAt: "2026-11-01T00:00:00.000Z",
      },
    ],
    frontPhotoId: "photo1",
    back: { treatment: "text", photoId: null },
  }
}

test("a first-party file keeps the apartment, reports bad rows, and rejects neighbor data", () => {
  const imported = importEvents(csv)
  assert.equal(imported.headerError, null)
  assert.equal(imported.events[0]?.address2, "Apt 4B")
  assert.equal(imported.duplicates.length, 1)
  assert.match(imported.validationNote, /not a postal/)
  const neighbor = importEvents("neighbor,event id\nnearby,1\n")
  assert.match(neighbor.headerError ?? "", /Neighbor/)
})

test("explicit policy excludes converted, opt-out, recent, no-permission, and over-cap rows", () => {
  const imported = importEvents(csv)
  const { proposal, selection } = buildProposal({
    ownerId: "alice@example.com",
    campaignId: "camp",
    policy: { ...policy(), cap: 1 },
    events: imported.events,
    offer: "Free inspection",
    trade: "roofing",
    job: job(),
    guidanceVersion: "src",
    nowIso: "2026-11-08T00:00:00.000Z",
  })
  const byId = Object.fromEntries(selection.rows.map((row) => [row.externalId, row]))
  assert.equal(byId.e2?.decision, "excluded")
  assert.match(byId.e2?.reason ?? "", /converted/)
  assert.match(byId.e3?.reason ?? "", /Opt-out/)
  assert.match(byId.e4?.reason ?? "", /14 days/)
  assert.match(byId.e5?.reason ?? "", /permission is no/)
  assert.equal(proposal.frozen.includedCount <= 2, true)
  assert.match(selection.rows.find((row) => row.reason.includes("cap"))?.reason ?? "Over the cap you set.", /cap/)
  assert.equal(JSON.stringify(proposal).includes("123 Main"), false)
})

test("repeat uploads and concurrent saves share one proposal and do not send", async () => {
  const imported = importEvents(csv)
  const input = {
    ownerId: "alice@example.com",
    campaignId: "camp",
    policy: policy(),
    events: imported.events,
    offer: "Free inspection",
    trade: "roofing",
    job: job(),
    guidanceVersion: "src",
    nowIso: "2026-11-08T00:00:00.000Z",
  }
  const first = buildProposal(input)
  const second = buildProposal({ ...input, events: [...imported.events].reverse(), nowIso: "2026-11-09T00:00:00.000Z" })
  assert.equal(first.proposal.id, second.proposal.id)
  const directory = await mkdtemp(path.join(tmpdir(), "mm-follow-"))
  try {
    const left = createFileFollowUpStore(directory)
    const right = createFileFollowUpStore(directory)
    const [a, b] = await Promise.all([left.save(first.proposal), right.save(second.proposal)])
    assert.equal(a.proposal.id, b.proposal.id)
    assert.equal([a.created, b.created].filter(Boolean).length, 1)
    await assert.rejects(() => left.save({ ...first.proposal, ownerId: "bob@example.com" }), /another account/)
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
  const previousMail = process.env.MAIL_MODE
  const previousPay = process.env.PAYMENT_MODE
  process.env.MAIL_MODE = "live"
  process.env.PAYMENT_MODE = "live"
  const handoff = handoffBlockers({
    proposal: first.proposal,
    trade: "roofing",
    offer: "Free inspection",
    job: job(),
    guidanceVersion: "src",
    scheduleConfigured: false,
  })
  assert.equal(handoff.sent, false)
  assert.equal(handoff.charged, false)
  assert.equal(handoff.externalCalls, 0)
  assert.equal(handoff.ready, false)
  assert.match(handoff.blockers.join(" "), /no approved price/i)
  assert.equal(JSON.stringify(handoff).includes("$"), false)
  if (previousMail === undefined) delete process.env.MAIL_MODE
  else process.env.MAIL_MODE = previousMail
  if (previousPay === undefined) delete process.env.PAYMENT_MODE
  else process.env.PAYMENT_MODE = previousPay
})

test("a changed offer invalidates approval, and an unknown trade is not a home-service plan", () => {
  const imported = importEvents(csv)
  const built = buildProposal({
    ownerId: "alice@example.com",
    campaignId: "camp",
    policy: emptyPolicy(),
    events: imported.events,
    offer: "Free inspection",
    trade: "unknown",
    job: null,
    guidanceVersion: null,
    nowIso: "2026-11-08T00:00:00.000Z",
  })
  const handoff = handoffBlockers({
    proposal: built.proposal,
    trade: "unknown",
    offer: "A different offer",
    job: null,
    guidanceVersion: null,
    scheduleConfigured: true,
  })
  const text = handoff.blockers.join(" ")
  assert.match(text, /Approve it again/)
  assert.match(text, /No home-service creative was substituted/)
  assert.match(text, /Choose the unsold-estimate/)
  assert.equal(handoff.sent, false)
})

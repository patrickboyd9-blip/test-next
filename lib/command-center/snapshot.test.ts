import assert from "node:assert/strict"
import { test } from "node:test"

import { createEmptyCampaignCreative, type Campaign } from "@/lib/campaign-creator/types"

import { emptySnapshot, labeledSampleSnapshot, resultsCsv, snapshotFrom } from "./snapshot"

test("an account with no mail shows empty counts and does not invent scans or spend", () => {
  const snap = emptySnapshot()
  assert.equal(snap.sample, false)
  assert.equal(snap.printing, 0)
  assert.equal(snap.mailed, 0)
  assert.equal(snap.delivered, 0)
  assert.equal(snap.scansToday, null)
  assert.equal(snap.callsToday, null)
  assert.equal(snap.spendThisMonthCents, null)
  assert.equal(snap.inProgress.length, 0)
  assert.match(snap.suggestions[0] ?? "", /No campaigns are in progress/)
  assert.match(snap.suggestions.join(" "), /No scans are recorded/)
  assert.match(snap.suggestions.join(" "), /No charges are recorded/)
  assert.equal(snap.analytics.every((row) => row.value === "Not recorded"), true)
})

test("a submitted job counts as mailed, and an uncharged checkout is not spend", () => {
  const snap = snapshotFrom(
    [draft("one", "Spring"), mailed("two", "Heater")],
    [
      {
        id: "a",
        at: "2026-11-18T01:00:00.000Z",
        actorId: "ada",
        action: "charge",
        subjectId: "two",
        before: null,
        after: { charged: false, amountCents: 18600 },
      },
    ],
    "2026-11-18T12:00:00.000Z"
  )
  assert.equal(snap.sample, false)
  assert.equal(snap.mailed, 1)
  assert.equal(snap.printing, 0)
  assert.equal(snap.spendThisMonthCents, null)
  assert.equal(snap.inProgress.length, 2)
  assert.match(resultsCsv([draft("one", "Spring")]), /"Spring",Designing,,/)
})

test("the labeled sample is marked sample on every figure", () => {
  const sample = labeledSampleSnapshot()
  assert.equal(sample.sample, true)
  assert.match(sample.suggestions[0] ?? "", /Sample/)
  assert.match(sample.analytics[0]?.value ?? "", /sample/)
})

function draft(id: string, name: string): Campaign {
  return base(id, name, "draft")
}

function mailed(id: string, name: string): Campaign {
  return {
    ...base(id, name, "launched"),
    mailOrder: {
      id: "order",
      mode: "test",
      environment: "stage",
      pieceCount: 10,
      estimatedCostLabel: "Placeholder",
      artwork: "type-plate",
      submitted: true,
      jobStatus: "In the mail",
      product: {
        documentClass: "Postcard",
        layout: "Double Sided Postcard",
        paperType: "White",
        printOption: "Color",
        mailClass: "First Class",
        productionTime: "Next Day",
        color: "Full",
      },
      createdAt: "2026-11-18T00:00:00.000Z",
      updatedAt: "2026-11-18T00:00:00.000Z",
    },
  }
}

function base(id: string, name: string, status: Campaign["status"]): Campaign {
  return {
    id,
    ownerId: "ada",
    name,
    status,
    brief: {},
    creative: createEmptyCampaignCreative(),
    transcript: [],
    readyForBriefReview: false,
    createdAt: "2026-11-18T00:00:00.000Z",
    updatedAt: "2026-11-18T00:00:00.000Z",
  }
}

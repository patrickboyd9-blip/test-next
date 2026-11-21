import assert from "node:assert/strict"
import { test } from "node:test"

import { createEmptyCampaignCreative, type Campaign } from "@/lib/campaign-creator/types"

import { emptySnapshot, labeledSampleSnapshot, resultsCsv, snapshotFrom } from "./snapshot"

test("an account with no mail explains the empty state and does not invent calls", () => {
  const snap = emptySnapshot()
  assert.equal(snap.sample, false)
  assert.equal(snap.stages.length, 0)
  assert.match(snap.mailNote, /after a job is sent to the printer/)
  assert.equal(snap.scansTotal, 0)
  assert.equal(snap.scanRate, null)
  assert.equal(snap.callTaps, null)
  assert.equal(snap.bookingTaps, null)
  assert.equal(snap.leads, null)
  assert.equal(snap.spendThisMonthCents, null)
  assert.match(snap.suggestions.join(" "), /Scans appear after your mail lands/)
  assert.doesNotMatch(snap.suggestions.join(" "), /call/i)
  assert.equal(JSON.stringify(snap).includes("Not recorded"), false)
})

test("a mailed job counts pieces, and an uncharged checkout is not spend", () => {
  const snap = snapshotFrom(
    [draft("one", "Spring"), mailed("two", "Heater", "MAILED", 10)],
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
  assert.equal(snap.stages.find((row) => row.id === "mailed")?.pieces, 10)
  assert.equal(snap.spendThisMonthCents, null)
  assert.deepEqual(snap.inProgress, [{ id: "two", name: "Heater", status: "Mailed" }])
  assert.match(snap.suggestions.join(" "), /Heater is mailed/)
  assert.doesNotMatch(snap.suggestions.join(" "), /Untitled campaign/)
  assert.match(resultsCsv([draft("one", "Spring")]), /"Spring",,/)
})

test("the labeled sample is marked sample and does not show calls", () => {
  const sample = labeledSampleSnapshot()
  assert.equal(sample.sample, true)
  assert.match(sample.suggestions[0] ?? "", /Sample/)
  assert.equal(JSON.stringify(sample).includes("Calls"), false)
})

function draft(id: string, name: string): Campaign {
  return base(id, name, "draft")
}

function mailed(id: string, name: string, jobStatus: string, pieceCount: number): Campaign {
  return {
    ...base(id, name, "launched"),
    mailOrder: {
      id: "order",
      mode: "test",
      environment: "stage",
      pieceCount,
      estimatedCostLabel: "Placeholder",
      artwork: "type-plate",
      submitted: true,
      jobStatus,
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

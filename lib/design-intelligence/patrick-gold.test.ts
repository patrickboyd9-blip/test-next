import assert from "node:assert/strict"
import { test } from "node:test"

import { selectReferences } from "./select"
import {
  artDirectorGoldText,
  leaksReferenceIdentity,
  PATRICK_GOLD,
  patrickGoldForBrief,
  tooCloseToGold,
} from "./patrick-gold"

test("gold reasoning has no client identity and a copied sentence is too close", () => {
  const notes = artDirectorGoldText()
  assert.equal(leaksReferenceIdentity(notes), false)
  assert.equal(leaksReferenceIdentity("Call 614-861-3100 today"), true)
  const card = PATRICK_GOLD.find((item) => item.id === "PM-066")!
  assert.equal(tooCloseToGold(card.reasoning, card), true)
  assert.equal(tooCloseToGold("A quiet offer and a clear next step.", card), false)
})

test("medicare gold stays off other briefs, and home insurance is not the word home", () => {
  assert.deepEqual(
    patrickGoldForBrief({ goal: "Replace the roof shingles", offer: "Free roof inspection" }).map((card) => card.id),
    []
  )
  assert.deepEqual(
    patrickGoldForBrief({ goal: "We serve Louisiana", offer: "A free estimate" }).map((card) => card.id),
    []
  )
  assert.ok(patrickGoldForBrief({ goal: "Review homeowners insurance", offer: "A home insurance quote" }).some((card) => card.id === "PM-068"))
  assert.deepEqual(
    patrickGoldForBrief({ goal: "Review Medicare coverage", offer: "A Medicare plan review" }).map((card) => card.id),
    ["PM-069"]
  )
  assert.ok(patrickGoldForBrief({ goal: "Book a private chef", offer: "Meal prep this week" }).some((card) => card.id === "PM-070"))
})

test("a matching gold card leads the art-director picks and carries no image", () => {
  const selection = selectReferences([], { goal: "Ask for an auto insurance quote", offer: "A written quote" })
  assert.equal(selection.anchors[0]?.id, "PM-066")
  assert.equal(selection.imageIds.includes("PM-066"), false)
  assert.equal(leaksReferenceIdentity(selection.anchors.map((pick) => pick.principle).join(" ")), false)
  const roof = selectReferences([], { goal: "Replace the roof", offer: "Free roof inspection" })
  assert.equal(roof.anchors.some((pick) => pick.id.startsWith("PM-06")), false)
})

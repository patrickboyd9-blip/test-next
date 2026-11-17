import assert from "node:assert/strict"
import { test } from "node:test"

import { ACCOMPLISH_QUESTION, ACTION_CHOICES, ACTION_QUESTION, AUDIENCE_QUESTION, interviewReply, proposalFor } from "./interview"
import {
  approvePreview,
  canApprove,
  canContinue,
  composeSteps,
  countAddresses,
  emptyDraft,
  firstMailerEffort,
  LIST_BEFORE_PROOF,
  mailerById,
  PLACEHOLDER_FULL_PRICE,
  proofFromDraft,
  SAMPLE_MAILERS,
  statusNeedsYou,
  STATUS_LABEL,
} from "./flow"

test("a list file counts people and keeps every data row", () => {
  const csv = ["name,address", "Ada,1 Main", "Ben,2 Main Apt 4", ""].join("\n")
  assert.equal(countAddresses(csv), 2)
  assert.equal(countAddresses("just a header"), 0)
  assert.equal(countAddresses(""), 0)
})

test("the list comes after the proof unless the flag says otherwise", () => {
  assert.equal(LIST_BEFORE_PROOF, false)
  assert.deepEqual(composeSteps(), ["what", "proof", "to"])
  assert.deepEqual(composeSteps(true), ["to", "what", "proof"])
  const draft = emptyDraft()
  assert.equal(canContinue("what", draft), false)
  draft.brief = "$50 off a tune-up this month"
  assert.equal(canContinue("what", draft), true)
  assert.equal(canContinue("proof", draft), true)
  assert.equal(canApprove(draft), false)
  draft.listId = "nearby-homes"
  assert.equal(canApprove(draft), true)
  const proof = proofFromDraft(draft)
  assert.equal(proof.line, "$50 off a tune-up this month")
  assert.equal(proof.people, 240)
  assert.equal(proof.qr, null)
  draft.website = "jordans.example/book"
  assert.equal(proofFromDraft(draft).qr, "jordans.example/book")
  assert.equal(PLACEHOLDER_FULL_PRICE.label, "Placeholder")
  assert.match(PLACEHOLDER_FULL_PRICE.detail, /Full price/)
  assert.doesNotMatch(PLACEHOLDER_FULL_PRICE.detail, /postage by itself is the price|\$0\.495/)
  const effort = firstMailerEffort()
  assert.equal(effort.screens, 4)
  assert.equal(effort.clicks, 5)
})

test("an uploaded list replaces the saved one", () => {
  const draft = { ...emptyDraft(), listId: "last-year", uploadedName: "tuesday.csv", uploadedPeople: 3 }
  assert.equal(canContinue("to", draft), true)
  const proof = proofFromDraft(draft)
  assert.equal(proof.people, 3)
  assert.equal(proof.to, "tuesday.csv")
})

test("approve is a preview and does not mail or charge", () => {
  const result = approvePreview()
  assert.equal(result.status, "printing")
  assert.equal(result.mailed, false)
  assert.equal(result.charged, false)
  assert.equal(result.externalCalls, 0)
})

test("the chat asks the documented goal questions, then writes the card", () => {
  const goal = interviewReply("We're opening a restaurant and want to promote our grand opening.")
  assert.equal(goal.ready, false)
  assert.equal(goal.reply, ACTION_QUESTION)
  assert.ok(goal.choices.includes("Call you"))
  assert.deepEqual([...goal.choices], [...ACTION_CHOICES])
  const action = interviewReply("Call you", goal.brief)
  assert.equal(action.reply, AUDIENCE_QUESTION)
  const audience = interviewReply("Homeowners in specific ZIP codes", action.brief)
  assert.equal(audience.ready, true)
  const card = proposalFor({ ...audience.brief, businessInfo: { name: "Tony's Brick Oven Pizza" }, goal: "Fill slow weeknights" })
  assert.equal(card.line, "Tuesday 2-for-1 large pizzas")
  assert.match(card.why, /weeknight/)
  assert.equal(ACCOMPLISH_QUESTION, "What would you like to accomplish?")
})

test("sample mailers use plain statuses and amber only when a proof is waiting", () => {
  assert.deepEqual(STATUS_LABEL, {
    designing: "Designing",
    proof_ready: "Proof ready",
    printing: "Printing",
    in_the_mail: "In the mail",
    delivered: "Delivered",
  })
  const waiting = SAMPLE_MAILERS.filter((item) => statusNeedsYou(item.status))
  assert.equal(waiting.length, 1)
  assert.equal(waiting[0]?.id, "spring-proof")
  assert.equal(mailerById("missing"), null)
  const spoken = SAMPLE_MAILERS.map((item) => `${item.name} ${STATUS_LABEL[item.status]}`).join(" ")
  assert.doesNotMatch(spoken, /campaign|direction|sku/i)
})

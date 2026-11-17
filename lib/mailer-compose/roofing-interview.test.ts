import assert from "node:assert/strict"
import { test } from "node:test"

import { interviewReply, reactToProposal, proposalFor } from "./interview"

test("the roofing interview names the trade, the appointment, and the ZIP audience", () => {
  const goal = interviewReply("I want to send mailers for my roofing company")
  assert.equal(goal.ready, false)
  assert.match(goal.reply, /Sample/)
  assert.match(goal.reply, /Roofing/)
  assert.doesNotMatch(goal.reply, /Got it/)

  const action = interviewReply("Book an appointment", goal.brief)
  assert.equal(action.ready, false)
  assert.match(action.reply, /book an appointment/i)
  assert.doesNotMatch(action.reply, /Got it/)

  const audience = interviewReply("Homeowners in specific ZIP codes", action.brief)
  assert.equal(audience.ready, true)
  const card = proposalFor(audience.brief)
  assert.match(card.why, /Business: roofing/i)
  assert.match(card.why, /book an appointment/i)
  assert.match(card.why, /Homeowners in specific ZIP codes/)
  assert.match(card.line, /roofing/i)
  assert.match(card.line, /Homeowners in specific ZIP codes/)
  assert.doesNotMatch(`${card.shop} ${card.line} ${card.why}`, /Your business: book a time/)

  const lighter = reactToProposal(card, "Make it more fun")
  const again = reactToProposal(lighter, "Make it more fun")
  assert.notEqual(lighter.line, card.line)
  assert.notEqual(again.line, lighter.line)
  assert.notEqual(again.why, lighter.why)
  assert.match(lighter.why, /lighter/)
  assert.match(again.why, /pass 2/)
})

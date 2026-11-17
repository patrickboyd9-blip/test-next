import assert from "node:assert/strict"
import { test } from "node:test"

import { SAMPLE_MAILERS } from "@/lib/mailer-compose/flow"

import { cometHomeNote } from "./home-note"

test("the home note uses statuses only and does not invent a reply rate", () => {
  const note = cometHomeNote(SAMPLE_MAILERS, true)
  assert.equal(note.sample, true)
  assert.equal(note.name, "Comet")
  assert.match(note.snapshot, /No reply count/)
  assert.match(note.recommendations[0] ?? "", /Approve Spring tune-up/)
  assert.match(note.recommendations.join(" "), /no follow-up/i)
  assert.doesNotMatch(JSON.stringify(note), /%|response rate|non-responders/i)
})

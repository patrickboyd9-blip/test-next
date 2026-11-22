import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

import { phoneFieldEmpty, phoneOnFrontAfterEdit } from "./phone-on-front"

test("the front-phone checkbox is checked once a number is entered and off when the phone is empty", () => {
  assert.equal(phoneFieldEmpty(""), true)
  assert.equal(phoneFieldEmpty("   "), true)
  assert.equal(phoneFieldEmpty("(619) 555-0148"), false)

  assert.equal(phoneOnFrontAfterEdit("", "", false), false)
  assert.equal(phoneOnFrontAfterEdit("", "(619) 555-0148", false), true)
  assert.equal(phoneOnFrontAfterEdit("(619) 555-0148", "(619) 555-0199", false), false)
  assert.equal(phoneOnFrontAfterEdit("(619) 555-0148", "(619) 555-0199", true), true)
  assert.equal(phoneOnFrontAfterEdit("(619) 555-0148", " ", true), false)

  const form = readFileSync("components/mail-gallery/LockedHeroMailer.tsx", "utf8")
  assert.match(form, /Show my phone number on the front/)
  assert.match(form, /phoneOnFrontAfterEdit/)
  assert.match(form, /disabled=\{phoneFieldEmpty\(input\.phone\)\}/)
  assert.match(form, /checked=\{!phoneFieldEmpty\(input\.phone\) && phoneOnFront\}/)
  assert.match(form, /phoneOnFront: phoneFieldEmpty\(input\.phone\) \? false : phoneOnFront/)
  assert.doesNotMatch(form, /gemini|openai|anthropic|\$\d|prompt/i)
})

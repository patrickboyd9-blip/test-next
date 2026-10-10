import assert from "node:assert/strict"
import { test } from "node:test"

import { toCreativeCanvas } from "@/lib/campaign-creator/creative-canvas"
import { POSTCARD_5X8_V1 } from "@/lib/mail-catalog/pieces/postcard-5x8"

import { repairCustomerVoice, repairSpecCustomerVoice } from "./customer-voice"
import { buildGenerateSystemPrompt } from "./prompts/generate"
import { buildRefineSystemPrompt } from "./prompts/refine"
import { SPEC_FIELD_RULES } from "./prompts/shared"

test("a third-person booking offer speaks to the reader", () => {
  assert.equal(
    repairCustomerVoice("Free roof inspection if they book an appointment"),
    "Free roof inspection if you book an appointment"
  )
  assert.equal(
    repairCustomerVoice("When they schedule a visit"),
    "When you schedule a visit"
  )
  assert.equal(repairCustomerVoice("Their roof can wait"), "Your roof can wait")
  assert.equal(repairCustomerVoice("We help them book"), "We help you book")
})

test("they that means the problem stays they", () => {
  const body =
    "Get a free roof inspection and catch problems before they show up inside your home."
  assert.equal(repairCustomerVoice(body), body)
  assert.equal(repairCustomerVoice("Small leaks start quiet before they spread."), "Small leaks start quiet before they spread.")
})

test("a plain offer and a second pass stay put", () => {
  assert.equal(repairCustomerVoice("Free roof inspection"), "Free roof inspection")
  const once = repairCustomerVoice("Free roof inspection if they book an appointment")
  assert.equal(repairCustomerVoice(once), once)
  assert.equal(
    repairSpecCustomerVoice({ offer: "Free roof inspection", body: "Licensed local crew." }).offer,
    "Free roof inspection"
  )
})

test("generate and refine prompts tell the model to address the reader", () => {
  const canvas = toCreativeCanvas(POSTCARD_5X8_V1)
  const generate = buildGenerateSystemPrompt(canvas, { principles: [] })
  const refine = buildRefineSystemPrompt(canvas, { principles: [] })
  for (const text of [SPEC_FIELD_RULES, generate, refine]) {
    assert.match(text, /you, your/)
    assert.match(text, /Do not write the reader as they, their, or them/)
  }
})

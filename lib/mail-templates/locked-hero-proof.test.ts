import assert from "node:assert/strict"
import test from "node:test"

import { HERO_DESIGNING, HERO_EDIT_FAILED, HERO_NEED_NOTE, HERO_PROOF_READY } from "@/lib/image-edit/messages"

import {
  beginLockedHeroEdit,
  finishLockedHeroEdit,
  requestLockedHeroChanges,
  restartLockedHeroForm,
} from "./locked-hero-proof"

const proof = {
  ok: true as const,
  frontSrc: "data:image/jpeg;base64,front",
  backSrc: "data:image/jpeg;base64,back",
  proof: true,
}

test("continue stays on the form until the details are complete, then shows progress", () => {
  const blocked = beginLockedHeroEdit("Describe exactly what you want changed.")
  assert.equal(blocked.run, false)
  assert.equal(blocked.state.phase, "form")
  assert.equal(blocked.state.frontSrc, null)

  const started = beginLockedHeroEdit(null)
  assert.equal(started.run, true)
  assert.equal(started.state.phase, "designing")
  assert.equal(started.state.message, HERO_DESIGNING)
  assert.equal(started.state.editSource, null)
})

test("a mocked edit becomes a proof, a change note edits that proof, and start over keeps the fields", () => {
  const started = beginLockedHeroEdit(null)
  const ready = finishLockedHeroEdit(started.state, proof)
  assert.equal(ready.phase, "proof")
  assert.equal(ready.message, HERO_PROOF_READY)
  assert.equal(ready.frontSrc, proof.frontSrc)
  assert.equal(ready.backSrc, proof.backSrc)
  assert.equal(ready.proof, true)
  assert.equal(ready.editSource, proof.frontSrc)

  const blank = requestLockedHeroChanges(ready, "  ")
  assert.equal(blank.run, false)
  assert.equal(blank.state.phase, "proof")
  assert.equal(blank.state.message, HERO_NEED_NOTE)

  const again = requestLockedHeroChanges(ready, "  Make the phone larger  ")
  assert.equal(again.run, true)
  assert.equal(again.note, "Make the phone larger")
  assert.equal(again.state.phase, "designing")
  assert.equal(again.state.editSource, proof.frontSrc)
  assert.equal(again.state.frontSrc, proof.frontSrc)

  const fields = { businessName: "Harbor Roofing", instructions: "Keep the dog photo." }
  const form = restartLockedHeroForm()
  assert.equal(form.phase, "form")
  assert.equal(form.frontSrc, null)
  assert.equal(form.editSource, null)
  assert.equal(fields.businessName, "Harbor Roofing")
  assert.equal(fields.instructions, "Keep the dog photo.")
})

test("a failed edit stays retryable and does not drop a proof already on screen", () => {
  const started = beginLockedHeroEdit(null)
  const failed = finishLockedHeroEdit(started.state, { ok: false, message: HERO_EDIT_FAILED })
  assert.equal(failed.phase, "error")
  assert.equal(failed.message, HERO_EDIT_FAILED)
  assert.equal(failed.frontSrc, null)

  const ready = finishLockedHeroEdit(started.state, proof)
  const revision = requestLockedHeroChanges(ready, "Use gold type")
  const lost = finishLockedHeroEdit(revision.state, { ok: false, message: HERO_EDIT_FAILED })
  assert.equal(lost.phase, "error")
  assert.equal(lost.frontSrc, proof.frontSrc)
  assert.equal(lost.editSource, proof.frontSrc)
})

import test from "node:test"
import assert from "node:assert/strict"
import { compliantLine, headlineCompliant, hasTriggerTerm } from "./compliance"
import { fitsSpecialOffer } from "./guard"

test("financing copy keeps only 'Financing available' or an APR rate", () => {
  assert.equal(compliantLine("Get a free quote and lock in 0% financing for 18 months."), "Financing available.")
  assert.equal(compliantLine("0% APR financing available"), "0% APR financing available")
  assert.equal(compliantLine("Only $89/mo with $0 down"), "Financing available")
  assert.equal(hasTriggerTerm("No payments for 12 months"), true)
  assert.equal(hasTriggerTerm("Financing available"), false)
})

test("free-with-purchase, guarantees, lifetime and banned claims are rewritten", () => {
  assert.equal(compliantLine("Free gutters with purchase*", "new roof"), "gutters included")
  assert.match(compliantLine("Fixed right or it's free"), /we come back at no charge/)
  assert.match(compliantLine("Lifetime warranty"), /for as long as you own the home/)
  assert.equal(compliantLine("You have hail damage!"), "Did it hit your roof?")
  assert.doesNotMatch(compliantLine("Go solar. Claim the federal tax credit."), /tax credit/i)
  assert.equal(compliantLine("How old is your water heater?"), "Is your water heater more than 10 years old?")
})

test("headlines carry one service and no financing", () => {
  assert.equal(headlineCompliant("A new roof, 0% financing"), false)
  assert.equal(headlineCompliant("New roof and new windows this fall"), false)
  assert.equal(headlineCompliant("Replace the roof, keep the savings."), true)
  assert.equal(fitsSpecialOffer("Did it hit your roof?", "Free storm damage inspection"), true)
  assert.equal(fitsSpecialOffer("Free gutters with purchase of a roof", "$500 off"), false)
})

test("back-of-card financing and question marks", async () => {
  const { normalizeQuestion } = await import("./compliance")
  assert.equal(compliantLine("0% financing"), "0% APR financing available")
  assert.equal(compliantLine("0% financing for 18 months"), "Financing available")
  assert.equal(normalizeQuestion("Is Your Roof Ready"), "Is Your Roof Ready?")
  assert.equal(normalizeQuestion("Storm season is coming. Is your roof ready?"), "Storm season is coming. Is your roof ready?")
  assert.equal(normalizeQuestion("Replace the roof, keep the savings."), "Replace the roof, keep the savings.")
})

test("storm headlines need a storm-damage photo", async () => {
  const { alignStormHeadlines, DAMAGE_SCENE } = await import("@/lib/design-intelligence/persuasion")
  const views = [
    { role: "threat", spec: { headline: "Did it hit your roof?", visualDirection: "Sunny intact home" } },
    { role: "outcome", spec: { headline: "Know your roof before the next storm", visualDirection: "Sunny intact home" } },
    { role: "trust", spec: { headline: "A local crew you can call", visualDirection: "Roofer on a ladder" } },
  ]
  alignStormHeadlines(views)
  assert.equal(views[0]!.spec.headline, "Did it hit your roof?")
  assert.match(views[0]!.spec.visualDirection, DAMAGE_SCENE)
  assert.doesNotMatch(views[1]!.spec.headline, /storm/i)
  assert.equal(views[2]!.spec.headline, "A local crew you can call")
})

import assert from "node:assert/strict"
import test from "node:test"

import { isEmptyHeadline, fitsSpecialOffer, copiesLibrary, headlineFitsOffer, headlinePasses, lineOverlap, makesClaim, rememberLibraryLines, clearLibraryLines } from "./guard"
import { distinctRoofingHeadlines, headlineVariants } from "@/lib/design-intelligence/persuasion"

test("a line close to a library line is rejected, a fresh one is not", () => {
  rememberLibraryLines([{ headlines: ["STOP! Don't pay too much for your roof!"], offers: [] } as never])
  assert.equal(lineOverlap("Don't pay too much for a roof", "STOP! Don't pay too much for your roof!") >= 0.6, true)
  assert.equal(copiesLibrary("Stop paying too much for your roof"), true)
  assert.equal(copiesLibrary("Roof prices in Tulsa, explained"), false)
  assert.equal(copiesLibrary("Don't pay too much for your new roof!"), true)
  assert.equal(copiesLibrary("A sound roof costs seniors less in Scottsdale"), false)
  clearLibraryLines()
})

test("damage and 'you qualify' claims are rejected", () => {
  assert.equal(makesClaim("You have hail damage! We're here to help!"), true)
  assert.equal(makesClaim("You qualify for a FREE roof inspection!"), true)
  assert.equal(makesClaim("STORM DAMAGE ALERT."), true)
  assert.equal(makesClaim("Hail damage hides. We find it."), false)
  assert.equal(makesClaim("Hail Hit Your Roof Last Week"), true)
  assert.equal(makesClaim("Ice Dams Damaging Your Roof?"), true)
})

test("a headline must match the offer type", () => {
  assert.equal(headlineFitsOffer("A free roof inspection, this week", "0% financing for 18 months"), false)
  assert.equal(headlineFitsOffer("A new roof now, paid over time", "0% financing for 18 months"), true)
  assert.equal(headlinePasses({ headline: "You have hail damage! We're here to help!", offer: "15% senior discount" }), false)
})

test("the business name never picks the offer theme, and directions never share a headline", () => {
  const lines = headlineVariants({ offer: "$500 off a full roof replacement", goal: "Book a replacement estimate" })
  assert.equal(lines.some((line) => /gutter/i.test(line)), false)
  const picked = distinctRoofingHeadlines({
    headlines: ["Roof checked, gutters cleared, one visit.", "", "", ""],
    offer: "$500 off a full roof replacement",
    businessName: "Hernandez & Sons Family Roofing and Gutter Company",
  })
  assert.equal(new Set(picked.map((line) => line.toLowerCase())).size, 4)
  assert.equal(/gutter/i.test(picked[0]!), false)
})

test("empty headlines and special offers are rejected", () => {
  for (const line of ["A New Roof", "A Repaired Roof", "A New Shingle Roof", "Denver's Roof Replacement Team", "Milwaukee's Licensed Roof Experts", "Tacoma's Roofing Specialists"]) assert.equal(isEmptyHeadline(line), true, line)
  assert.equal(isEmptyHeadline("Fix the leak before it finds the ceiling."), false)
  assert.equal(fitsSpecialOffer("Free Roof Check in Scottsdale", "15% senior discount"), false)
  assert.equal(fitsSpecialOffer("A sound roof costs seniors less in Scottsdale.", "15% senior discount"), true)
  assert.equal(fitsSpecialOffer("Fix the roof now. Pay later", "0% financing for 18 months"), false)
  assert.equal(fitsSpecialOffer("Cut your energy bill in half", "Free solar quote"), false)
  assert.equal(fitsSpecialOffer("Hail damage hides. We find it", "Free storm damage inspection"), false)
  assert.equal(fitsSpecialOffer("Retired? Your roof just got cheaper", "15% off a tile roof underlayment replacement"), false)
  assert.equal(fitsSpecialOffer("Hail damage hides. We find it.", "Free hurricane-season roof inspection"), false)
  assert.equal(fitsSpecialOffer("Storms Find Weak Roofs Fast", "Free hurricane-season roof inspection"), true)
})

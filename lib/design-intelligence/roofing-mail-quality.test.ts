import assert from "node:assert/strict"
import { test } from "node:test"

import type { CampaignBrief, CreativeDirection } from "@/lib/campaign-creator/types"

import { rankCandidates } from "./candidate-board"
import { critiqueCard } from "./critic"
import { composeGridCard, rectsIntersect, textInsideSafe } from "./grid-composer"
import { heroLockup, offerIsFigure } from "./offer-copy"
import { headlineForRole } from "./persuasion"

const env = {
  DESIGN_DIRECTOR: "rules",
  DESIGN_CRITIC: "machine",
  DESIGN_CANDIDATE_RENDERS: "off",
} as NodeJS.ProcessEnv

function directions(offer: string): CreativeDirection[] {
  return [0, 1, 2].map((index) => ({
    id: `d-${index}`,
    name: `Direction ${index}`,
    rationale: "One next step for this homeowner.",
    designedToDrive: "calls",
    tags: [],
    spec: {
      headline: "See the roof",
      offer,
      phone: "(512) 555-0190",
      website: "summitpeak.example/estimate",
    },
    recommended: index === 0,
    createdAt: "2026-10-17T00:00:00.000Z",
  }))
}

async function boardFor(brief: CampaignBrief, offer: string) {
  return rankCandidates({
    brief,
    directions: directions(offer),
    trim: "5x8",
    env,
    records: [],
    tastes: [],
  })
}

test("a percent stays one figure, and a phrase is not split into a fake numeral", () => {
  assert.equal(offerIsFigure("0% financing for 18 months"), true)
  assert.equal(offerIsFigure("$500 off a full roof replacement"), true)
  assert.equal(offerIsFigure("Free roof inspection"), true)
  assert.equal(offerIsFigure("Storm damage inspection"), false)
  assert.deepEqual(heroLockup("0% financing for 18 months"), {
    numeral: "0%",
    rest: "financing for 18 months",
  })
  assert.deepEqual(heroLockup("$500 off"), { numeral: "$500", rest: "off" })
  assert.equal(heroLockup("Storm damage inspection").numeral, "Storm damage inspection")
  assert.equal(heroLockup("0% financing for 18 months").numeral.includes(" "), false)
})

test("the three directions stay three psychologies, and the line follows the client's offer and city", () => {
  const storm = headlineForRole({
    kind: "roofing",
    role: "threat",
    offer: "Storm damage inspection",
    goal: "Book a storm damage inspection",
    city: "Oklahoma City",
  })
  const priced = headlineForRole({
    kind: "roofing",
    role: "outcome",
    offer: "$500 off a full roof replacement",
    goal: "Book a replacement estimate",
    city: "Austin",
  })
  const trust = headlineForRole({
    kind: "roofing",
    role: "trust",
    offer: "Free roof inspection",
    goal: "Book a free roof inspection",
    businessName: "Northline Roofing",
    city: "San Diego",
  })
  assert.match(storm, /storm/i)
  assert.equal(/\b(?:january|march|expires|act now|\d{1,2}\/\d{1,2}|\d+\s+homes)\b/i.test(storm), false)
  assert.match(priced, /Austin/)
  assert.equal(/\$\s*500/.test(priced), false)
  assert.match(trust, /Northline Roofing/)
  assert.equal(new Set([storm, priced, trust]).size, 3)
})

test("a dollar offer leads, a long name fits, and the back repeats the offer", async () => {
  const name = "Summit Peak Roofing & Restoration of Greater Austin"
  const offer = "$500 off a full roof replacement"
  const brief: CampaignBrief = {
    goal: "Book a replacement estimate",
    offer,
    phone: "(512) 555-0190",
    website: "https://summitpeak.example/estimate",
    audience: { description: "Homeowners in Austin with an aging roof" },
    businessInfo: { name, city: "Austin", state: "TX", phone: "(512) 555-0190" },
  }
  const board = await boardFor(brief, offer)
  assert.deepEqual(board.surfaced.map((item) => item.rationale.grid.intentional_break), ["integrated", "full-bleed", "panel"])
  const outcome = board.surfaced[0]!
  const threat = board.surfaced[1]!
  const trust = board.surfaced[2]!
  assert.equal(outcome.rationale.scale_ratios.hero, "offer")
  assert.equal(threat.rationale.scale_ratios.hero, "offer")
  assert.equal(trust.rationale.scale_ratios.hero, "headline")
  assert.match(outcome.spec.headline ?? "", /Austin/)
  assert.equal(/\$\s*500/.test(outcome.spec.headline ?? ""), false)

  for (const card of [outcome, threat]) {
    const figure = card.card.front.texts.find((text) => text.role === "offer")
    const headline = card.card.front.texts.find((text) => text.role === "headline")
    assert.equal(figure?.text, "$500")
    assert.ok(figure && headline && figure.fontPt >= headline.fontPt * 1.5)
    assert.equal(card.card.front.texts.some((text) => text.text.includes("0 %")), false)
    const photo = card.card.front.photos[0]?.rect
    if (card.rationale.grid.intentional_break === "integrated" && photo) {
      for (const text of card.card.front.texts) {
        assert.equal(rectsIntersect(text.rect, photo), false, text.text)
      }
    }
  }

  assert.equal(threat.card.front.shapes.some((shape) => shape.role === "band"), true)
  assert.match(threat.card.back.texts.map((text) => text.text).join(" "), /\$500 off/)
  assert.equal(threat.card.back.texts.some((text) => /one proof line/i.test(text.text)), false)

  for (const item of board.surfaced) {
    assert.equal(item.card.front.overflows, false, item.rationale.persuasion?.role)
    assert.equal(item.card.back.overflows, false, item.rationale.persuasion?.role)
    const painted = [...item.card.front.texts, ...item.card.back.texts].map((text) => text.text).join(" ")
    assert.equal(painted.includes(name), true)
    assert.equal(painted.split(name).length - 1 <= 2, true)
    for (const text of [...item.card.front.texts, ...item.card.back.texts]) {
      assert.equal(textInsideSafe(text.rect, "5x8"), true, text.text)
    }
    const critique = critiqueCard(item.card, item.rationale, `${item.spec.headline} ${offer} ${name}`)
    assert.equal(critique.autoFails.includes("AF2"), false, critique.autoFails.join(","))
  }

  const trustNameHits = trust.card.front.texts.filter((text) => text.text.includes(name))
  assert.equal(trustNameHits.length <= 1, true)
})

test("financing keeps 0% together and a storm card does not invent a deadline", async () => {
  const finance = await boardFor({
    goal: "Start a financed roof project",
    offer: "0% financing for 18 months",
    businessInfo: { name: "Cedar & Copper Roofing", city: "Portland", state: "OR" },
    audience: { description: "Portland homeowners planning a roof this year" },
  }, "0% financing for 18 months")
  const lead = finance.surfaced[0]!
  assert.equal(lead.card.front.texts.some((text) => text.text === "0%"), true)
  assert.equal(lead.card.front.texts.some((text) => /0 %/.test(text.text)), false)
  assert.match(lead.card.back.texts.map((text) => text.text).join(" "), /0% financing/)

  const storm = await boardFor({
    goal: "Book a storm damage inspection",
    offer: "Storm damage inspection",
    businessInfo: { name: "Hail & Hammer Roof Co.", city: "Oklahoma City", state: "OK" },
    audience: { description: "Homeowners in Oklahoma City after hail" },
  }, "Storm damage inspection")
  const threat = storm.surfaced.find((item) => item.rationale.persuasion?.role === "threat")
  assert.ok(threat)
  assert.match(threat.spec.headline ?? "", /storm/i)
  const painted = threat.card.front.texts.map((text) => text.text).join(" ")
  assert.equal(/\b(?:expires|act now|only \d+|january|march \d+)\b/i.test(painted), false)
  assert.match(painted, /Storm damage inspection/)
})

test("a very long roofing name fits on the front and the address side", async () => {
  const name = "The Very Long Named Family Roofing Company of Northern California"
  const offer = "Free roof inspection"
  const result = await boardFor({
    goal: "Book a free inspection",
    offer,
    businessInfo: { name, city: "Sacramento", state: "CA", phone: "(916) 555-0104" },
    audience: { description: "Sacramento homeowners" },
  }, offer)
  for (const item of result.surfaced) {
    assert.equal(item.card.front.overflows, false)
    assert.equal(item.card.back.overflows, false)
    assert.equal(item.card.back.texts.some((text) => text.text.includes("Northern California")), true)
    const card = composeGridCard({
      rationale: { ...item.rationale, format: { trim: "6x9", orientation: "landscape" } },
      spec: item.spec,
      businessName: name,
    })
    assert.equal(card.front.overflows, false)
    assert.equal(card.back.overflows, false)
    const wideHeadline = card.front.texts.find((text) => text.role === "headline")
    if (item.rationale.scale_ratios.hero === "offer") {
      assert.ok(wideHeadline && wideHeadline.fontPt >= 12 * 2.5 - 0.6, `${item.rationale.persuasion?.role} ${wideHeadline?.fontPt}`)
    }
    for (const text of [...card.front.texts, ...card.back.texts]) {
      assert.equal(textInsideSafe(text.rect, "6x9"), true, text.text)
    }
    const longHost = composeGridCard({
      rationale: item.rationale,
      spec: { ...item.spec, website: "https://verylongfamilyroofing.example/book" },
      businessName: name,
    })
    assert.equal(longHost.front.overflows, false, item.rationale.persuasion?.role)
    assert.ok((longHost.front.lockup?.website?.lines.length ?? 0) >= 1)
  }
})

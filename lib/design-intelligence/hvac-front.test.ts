import assert from "node:assert/strict"
import test from "node:test"

import type { CampaignBrief, CreativeDirection } from "@/lib/campaign-creator/types"
import { fitText } from "@/lib/postcard-layouts/typefit"

import { rankCandidates } from "./candidate-board"
import { textInsideSafe } from "./grid-composer"

const env = {
  DESIGN_DIRECTOR: "rules",
  DESIGN_CRITIC: "machine",
  DESIGN_CANDIDATE_RENDERS: "off",
} as unknown as NodeJS.ProcessEnv

test("a headline does not leave a function word alone on a line", () => {
  const fitted = fitText({
    text: "Call before the AC quits.",
    rect: { x: 0, y: 0, w: 1.35, h: 1.6 },
    role: "headline",
    pairing: "trade",
    color: "#111111",
    minPt: 14,
    maxPt: 28,
  })
  assert.ok(fitted.lines.length > 1)
  for (const line of fitted.lines) {
    const words = line.replace(/[."']/g, "").split(/\s+/).filter(Boolean)
    if (words.length === 1) assert.equal(/^(?:the|a|an|of|to|and|or|for)$/i.test(words[0] ?? ""), false, line)
  }
})

test("every HVAC front shows the phone and the website, and the photo is not a cut-out", async () => {
  const brief: CampaignBrief = {
    goal: "Book an HVAC tune-up before the heat",
    offer: "FREE inspection",
    phone: "(619) 555-0199",
    website: "https://coastalcomfort.example/tune-up",
    audience: { description: "Homeowners before summer" },
    businessInfo: { name: "Coastal Comfort Heating & Air", phone: "(619) 555-0199", website: "https://coastalcomfort.example/tune-up" },
  }
  const directions: CreativeDirection[] = [0, 1, 2].map((index) => ({
    id: `hvac-${index}`,
    name: `Direction ${index + 1}`,
    rationale: "One next step for this homeowner.",
    designedToDrive: "calls",
    tags: [],
    spec: {
      headline: index === 1 ? "Call before the AC quits." : "The house cools down again.",
      offer: "FREE inspection",
    },
    recommended: index === 0,
    createdAt: "2026-10-27T00:00:00.000Z",
  }))
  const board = await rankCandidates({
    brief,
    directions,
    trim: "5x8",
    env,
    records: [],
    tastes: [],
  })
  assert.equal(board.surfaced.length, 3)
  for (const card of board.surfaced) {
    assert.match(card.card.front.lockup?.phone?.text ?? "", /555-0199/, card.directionIndex.toString())
    assert.match(card.card.front.lockup?.website?.text ?? "", /coastalcomfort\.example/, card.directionIndex.toString())
    assert.equal(card.card.front.missingContact.length, 0, card.directionIndex.toString())
    const lines = card.card.front.texts.filter((text) => text.role === "headline").flatMap((text) => text.lines)
    for (const line of lines) {
      const words = line.replace(/[."']/g, "").split(/\s+/).filter(Boolean)
      if (words.length === 1) assert.equal(/^(?:the|a|an|of|to|and|or|for)$/i.test(words[0] ?? ""), false, line)
    }
  }
  const outcome = board.surfaced.find((card) => card.directionIndex === 0)
  assert.equal(outcome?.card.front.photos.some((slot) => slot.treatment === "cutout"), false)
  assert.equal(outcome?.card.front.photos.some((slot) => slot.treatment === "cover"), true)
  const threat = board.surfaced.find((card) => card.directionIndex === 1)
  const band = threat?.card.front.shapes.find((shape) => shape.role === "band")
  const phone = threat?.card.front.lockup?.phone?.rect
  const website = threat?.card.front.lockup?.website?.rect
  assert.ok(band && phone && website && threat)
  assert.ok(phone.y >= band.rect.y - 0.08)
  assert.ok(phone.y + phone.h <= band.rect.y + band.rect.h + 0.08)
  assert.ok(website.y >= band.rect.y - 0.08)
  assert.ok(website.y + website.h <= band.rect.y + band.rect.h + 0.08)
  const bandBottom = band.rect.y + band.rect.h
  const lowest = Math.max(phone.y + phone.h, website.y + website.h)
  assert.ok(bandBottom - lowest <= 0.4, `empty band tail ${bandBottom - lowest}`)
  const wordmark = threat.card.front.texts.find((text) => text.role === "label" && /coastal comfort/i.test(text.text))
  const threatHeadlines = threat.card.front.texts.filter((text) => text.role === "headline")
  assert.ok(wordmark)
  assert.ok(threatHeadlines.length >= 1)
  const headlineBottom = Math.max(...threatHeadlines.map((text) => text.rect.y + text.rect.h))
  assert.ok(wordmark.rect.y - headlineBottom <= 0.28, "gap between the headline and the business name")
  const plateTop = threat.card.front.shapes.find((shape) => shape.role === "calm-field")?.rect.y ?? 0
  const spaceAbove = Math.min(...threatHeadlines.map((text) => text.rect.y)) - plateTop
  const spaceBelow = band.rect.y - (wordmark.rect.y + wordmark.rect.h)
  assert.ok(Math.abs(spaceAbove - spaceBelow) <= 0.55, `cream panel gap above ${spaceAbove} below ${spaceBelow}`)
  for (const text of threatHeadlines) {
    for (const line of text.lines) {
      assert.notEqual(line.replace(/[."']/g, "").trim().toLowerCase(), "before", line)
    }
  }
  const accentLine = threatHeadlines.find((text) => text.color !== threatHeadlines[0]?.color)
  if (accentLine) assert.match(accentLine.text, /^before\b/i)
  for (const card of board.surfaced) {
    const offer = card.card.front.texts.find((text) => text.role === "offer")
    assert.match(offer?.text ?? "", /FREE inspection/i, card.directionIndex.toString())
    assert.equal(card.card.front.texts.some((text) => text.role === "body" && /^inspection$/i.test(text.text)), false)
    assert.equal(card.card.front.overflows, false, card.directionIndex.toString())
    for (const text of card.card.front.texts) {
      assert.equal(textInsideSafe(text.rect, "5x8"), true, text.text)
    }
  }
  const leadOffer = outcome?.card.front.texts.find((text) => text.role === "offer")
  assert.ok(leadOffer && leadOffer.fontPt >= 16 && leadOffer.fontPt <= 32)
  for (const card of board.surfaced) {
    const headline = card.card.front.texts.filter((text) => text.role === "headline").map((text) => text.text).join(" ")
    assert.match(headline, /before|call|cool/i, headline)
  }
})

import assert from "node:assert/strict"
import test from "node:test"

import type { CampaignBrief, CreativeDirection } from "@/lib/campaign-creator/types"
import { fitText } from "@/lib/postcard-layouts/typefit"

import { rankCandidates } from "./candidate-board"

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
    offer: "$89 tune-up",
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
      offer: "$89 tune-up",
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
  assert.ok(band && phone && website)
  assert.ok(phone.y >= band.rect.y - 0.08)
  assert.ok(phone.y + phone.h <= band.rect.y + band.rect.h + 0.08)
  assert.ok(website.y >= band.rect.y - 0.08)
  assert.ok(website.y + website.h <= band.rect.y + band.rect.h + 0.08)
})

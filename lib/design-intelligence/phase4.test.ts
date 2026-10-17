import assert from "node:assert/strict"
import test from "node:test"

import { directDesign } from "./art-director"
import { measurePlanContrast } from "./backdrop"
import { critiqueCard } from "./critic"
import { composeGridCard, rectsIntersect } from "./grid-composer"
import { finishCardOnPhoto, improveFromWeakness } from "./improve-once"
import { analyzePhotoField } from "./photo-field"
import { designIntent, reviseFromNote } from "./refine-note"
import { selectReferences } from "./select"
import { parseRefinementReview } from "./vision-critic"

test("type sits on the calm side of a photograph and off the subject", () => {
  const width = 80
  const height = 50
  const rgba = Buffer.alloc(width * height * 4)
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = (y * width + x) * 4
      const busy = x < 34
      const noise = ((x * 17 + y * 13) % 50)
      rgba[index] = busy ? 180 + (noise % 40) : 214
      rgba[index + 1] = busy ? 90 + (noise % 20) : 228
      rgba[index + 2] = busy ? 60 : 240
      rgba[index + 3] = 255
    }
  }
  const reading = analyzePhotoField(rgba, width, height)
  assert.equal(reading.seat.side, "right")
  assert.equal(reading.seat.ink, "dark")
  assert.ok(reading.subject)
  assert.ok(reading.subject.x < 0.5)

  const brief = { goal: "Book a free roof inspection", offer: "$0 inspection", businessInfo: { name: "Northline Roofing" } }
  const selection = selectReferences([], brief)
  const directed = directDesign({ brief, selection, trim: "5x8", slot: 1 })
  const card = composeGridCard({
    rationale: { ...directed.rationale, type_seat: reading.seat },
    spec: { headline: "Free roof inspection", offer: "$0 inspection", phone: "(619) 555-0148", website: "northline.example/book" },
    businessName: "Northline Roofing",
  })
  const trimW = 8
  const subject = reading.subject
  const subjectRect = {
    x: subject.x * trimW,
    y: subject.y * 5,
    w: subject.w * trimW,
    h: subject.h * 5,
  }
  const qr = card.front.lockup?.qrRect
  assert.ok(qr)
  assert.equal(rectsIntersect(qr, subjectRect), false)
  for (const text of card.front.texts) {
    assert.equal(rectsIntersect(text.rect, subjectRect), false, text.role)
  }
  assert.equal(card.front.texts.some((text) => text.role === "offer" && text.text === "FREE"), true)
  assert.ok((card.front.lockup?.website?.fontPt ?? 0) >= 12)
  const qualifier = card.front.texts.find((text) => text.role === "body" || text.role === "proof")
  assert.ok((qualifier?.fontPt ?? 0) >= 12)
})

test("small type on a light photograph fails 7:1 until a scrim and dark ink", () => {
  const brief = { goal: "Book a free roof inspection", offer: "$0 inspection" }
  const selection = selectReferences([], brief)
  const directed = directDesign({ brief, selection, trim: "5x8", slot: 1 })
  const spec = { headline: "Wind damage? Free roof check.", offer: "$0 inspection", phone: "(619) 555-0148", website: "northline.example/book" }
  const bare = composeGridCard({ rationale: directed.rationale, spec, businessName: "Northline" })
  const light = flatPhoto(220, 220, 220)
  const washed = measurePlanContrast(bare.front, light)
  assert.ok(washed.smallFailing.length > 0)

  const seated = composeGridCard({
    rationale: {
      ...directed.rationale,
      type_seat: {
        side: "left",
        ink: "dark",
        scrim: true,
        shadow: true,
        rect: { x: 0.04, y: 0.06, w: 0.46, h: 0.78 },
      },
    },
    spec,
    businessName: "Northline",
  })
  const held = measurePlanContrast(seated.front, light)
  assert.equal(held.smallFailing.length, 0)
  assert.equal(seated.front.shapes.some((shape) => shape.role === "local-scrim"), true)
})

test("a centered smooth portrait reads as stock, and a noisy frame reads as cluttered", () => {
  const stock = Buffer.alloc(80 * 50 * 4)
  for (let i = 0; i < 80 * 50; i += 1) {
    const x = i % 80
    const y = Math.floor(i / 80)
    const cx = x - 40
    const cy = y - 25
    const face = cx * cx + cy * cy < 80
    const index = i * 4
    stock[index] = face ? 210 : 180
    stock[index + 1] = face ? 160 : 180
    stock[index + 2] = face ? 140 : 180
    stock[index + 3] = 255
  }
  assert.equal(analyzePhotoField(stock, 80, 50).stocky, true)

  const noise = Buffer.alloc(80 * 50 * 4)
  for (let i = 0; i < 80 * 50; i += 1) {
    const index = i * 4
    const value = (i * 37) % 255
    noise[index] = value
    noise[index + 1] = (value * 3) % 255
    noise[index + 2] = (value * 5) % 255
    noise[index + 3] = 255
  }
  assert.equal(analyzePhotoField(noise, 80, 50).cluttered, true)
})

test("plain-English refine notes become one design change and can be undone by a later note", () => {
  const brief = { goal: "Book a free roof inspection", offer: "$0 inspection", businessInfo: { name: "Northline Roofing" } }
  const rationale = directDesign({ brief, selection: selectReferences([], brief), trim: "5x8", slot: 1 }).rationale
  const spec = {
    headline: "Your roof is aging",
    offer: "Free inspection",
    phone: "(619) 555-0148",
    website: "abcroofers.com",
    visualDirection: "A roofer on a ladder at a worn shingle roof.",
    designRationale: rationale,
  }
  assert.equal(designIntent("the text is hard to see on photo 1"), "contrast")
  assert.equal(designIntent("make FREE bigger"), "offer-scale")
  assert.equal(designIntent("use a different photo"), "new-photo")
  assert.equal(designIntent("warmer colors"), "warmer")
  assert.equal(designIntent("rewrite the headline"), null)

  const contrast = reviseFromNote(spec, "the text is hard to see on photo 1")
  assert.equal(contrast.ok, true)
  assert.match(contrast.explanation, /calmer patch/)
  assert.equal(contrast.spec.designRationale && "type_seat" in contrast.spec.designRationale && contrast.spec.designRationale.type_seat?.scrim, true)

  const bigger = reviseFromNote(spec, "make FREE bigger")
  assert.equal(bigger.ok, true)
  assert.equal(bigger.spec.phone, spec.phone)

  const photo = reviseFromNote(spec, "use a different photo")
  assert.match(photo.spec.visualDirection ?? "", /Another angle/)

  const warmer = reviseFromNote(spec, "warmer colors")
  assert.equal(warmer.ok, true)
  const beforeAccent = rationale.palette.accent_hex
  const afterAccent = warmer.spec.designRationale && "palette" in warmer.spec.designRationale
    ? warmer.spec.designRationale.palette.accent_hex
    : ""
  assert.notEqual(afterAccent, beforeAccent)
})

test("the critic samples the real photograph, then one scrim round clears small type", () => {
  const brief = { goal: "Book a free roof inspection", offer: "$0 inspection" }
  const selection = selectReferences([], brief)
  const rationale = directDesign({ brief, selection, trim: "5x8", slot: 1 }).rationale
  const spec = {
    headline: "Wind damage? Free roof check.",
    offer: "$0 inspection",
    phone: "(619) 555-0148",
    website: "northline.example/book",
  }
  const light = flatPhoto(220, 220, 220)
  const bare = composeGridCard({ rationale, spec, businessName: "Northline" })
  const washed = critiqueCard(bare, rationale, `${spec.headline} ${spec.offer}`, light)
  assert.equal(washed.autoFails.includes("AF1"), true)

  const finished = finishCardOnPhoto({
    rationale,
    spec,
    businessName: "Northline",
    photo: light,
  })
  assert.equal(finished.critique.autoFails.includes("AF1"), false)
  assert.equal(finished.contrast.smallFailing.length, 0)
  assert.equal(finished.rationale.type_seat?.ink, "dark")
})

test("a named weakness becomes one change, and a seat change can be refused", () => {
  const brief = { goal: "Book a free roof inspection", offer: "$0 inspection" }
  const rationale = directDesign({ brief, selection: selectReferences([], brief), trim: "5x8", slot: 1 }).rationale
  const bigger = improveFromWeakness(rationale, "FREE is smaller than the headline.")
  assert.equal(bigger?.rationale.scale_ratios.hero, "offer")
  assert.ok((bigger?.rationale.scale_ratios.offer_to_headline_cap ?? 0) >= 1.85)

  const seated = {
    ...rationale,
    type_seat: {
      side: "left" as const,
      ink: "dark" as const,
      scrim: false,
      shadow: false,
      rect: { x: 0.04, y: 0.06, w: 0.46, h: 0.78 },
    },
  }
  const scrim = improveFromWeakness(seated, "Small type does not clear 7:1 on this photograph.")
  assert.equal(scrim?.rationale.type_seat?.scrim, true)
  assert.equal(improveFromWeakness(seated, "Small type does not clear 7:1 on this photograph.", { allowSeat: false }), null)
})

test("a refinement review parses the critic's verdict", () => {
  assert.deepEqual(parseRefinementReview('{"addressed": false, "regression": "The phone got smaller."}'), {
    addressed: false,
    regression: "The phone got smaller.",
  })
  assert.equal(parseRefinementReview("not json"), null)
})

function flatPhoto(r: number, g: number, b: number): { rgba: Buffer; width: number; height: number } {
  const width = 40
  const height = 24
  const rgba = Buffer.alloc(width * height * 4)
  for (let i = 0; i < width * height; i += 1) {
    rgba[i * 4] = r
    rgba[i * 4 + 1] = g
    rgba[i * 4 + 2] = b
    rgba[i * 4 + 3] = 255
  }
  return { rgba, width, height }
}

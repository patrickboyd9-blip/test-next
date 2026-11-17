import assert from "node:assert/strict"
import { test } from "node:test"

import { MockCreativeEngine } from "@/lib/campaign-creator/mock-creative-engine"
import { toCreativeCanvas } from "@/lib/campaign-creator/creative-canvas"
import { resolveCreativeImage } from "@/lib/campaign-creator/resolve-creative-image"
import { postcardIdentityFromBrief, resolveStudioContact } from "@/lib/campaign-creator/studio-contact"
import { buildPhotographyArtDirection } from "@/lib/campaign-creator/photography-art-direction"
import type { CampaignBrief } from "@/lib/campaign-creator/types"
import { POSTCARD_5X8_V1 } from "@/lib/mail-catalog/pieces/postcard-5x8"

import { composeGridCard } from "./grid-composer"
import { offerPhraseStaysTogether } from "./offer-copy"
import { customerDeclinedQr, headlineForRole, persuasionVertical } from "./persuasion"

/**
 * The eight messages Patrick sent, kept as he typed them.
 * 123 Main Street and 111-222-3344 are test values. 90000 is not treated as a checked ZIP.
 */
export const JP_PIZZA_CUSTOMER_LINES = [
  "I want to send 1,000 postcards to this neighborhood for my pizza shop. the offer is for a free drink with physical redemption of this mailer. no QR code. but put phone number on there to call for take-out or delivery. phone number is 111-222-3344. I have a logo to use. I want a warm and friendly vibe.",
  "JP's Pizza",
  "123 Main Street San Diego, CA. 90000",
  "yes a slice of pizza on there",
] as const

/** What the assistant said it would make, from the last recap. Not a generated brief. */
export const JP_PIZZA_RECAP =
  "1,000 postcards to the neighborhood around JP's Pizza, featuring your logo and a pizza slice image, offering a free drink with in-person redemption, your phone number for take-out/delivery orders, warm and friendly tone, and no QR code."

/** Structured handoff of those messages. No logo file was uploaded. */
export const JP_PIZZA_BRIEF: CampaignBrief = {
  goal: JP_PIZZA_CUSTOMER_LINES[0],
  offer: "Free drink with physical redemption of the mailer",
  audience: { description: "this neighborhood", quantity: 1000 },
  phone: "111-222-3344",
  emotionalTone: "warm and friendly",
  desiredRecipientAction: "Call for take-out or delivery",
  otherRequirements: "no QR code. A slice of pizza on the card. I have a logo to use. The logo file was not uploaded.",
  businessInfo: {
    name: "JP's Pizza",
    phone: "111-222-3344",
    address: "123 Main Street San Diego, CA. 90000",
  },
}

test("an unknown trade does not become a home-service crew or a house photo", async () => {
  const brief: CampaignBrief = {
    goal: "Send a note to nearby offices",
    offer: "A thank-you for stopping by",
    businessInfo: { name: "Northwind" },
  }
  assert.equal(persuasionVertical(brief), "general")
  const engine = new MockCreativeEngine()
  const result = await engine.generateDirections({
    brief,
    canvas: toCreativeCanvas(POSTCARD_5X8_V1),
  })
  for (const direction of result.directions) {
    const text = `${direction.name} ${direction.spec.headline}`
    assert.doesNotMatch(text, /crew|homeowner|leak|before it spreads|result you wanted/i)
    assert.equal(direction.spec.imageryRole, "none")
    const image = resolveCreativeImage(direction.spec.imagery, direction.spec.imageryRole, null, {
      libraryFallback: true,
      campaign: brief,
    })
    assert.equal(image.src, null)
  }
})

test("the pizza brief is not routed as a home-service crew, and a bakery is not either", () => {
  assert.equal(persuasionVertical(JP_PIZZA_BRIEF), "pizza")
  assert.equal(customerDeclinedQr(JP_PIZZA_BRIEF.goal ?? ""), true)
  assert.equal(offerPhraseStaysTogether(JP_PIZZA_BRIEF.offer ?? ""), true)
  assert.match(JP_PIZZA_RECAP, /pizza slice/)
  assert.match(JP_PIZZA_RECAP, /no QR code/)
  assert.doesNotMatch(JP_PIZZA_RECAP, /free pizza|minimum|expires|expir/i)

  const bakery = persuasionVertical({
    businessInfo: { name: "Sunrise Bakery" },
    offer: "A morning bun",
  })
  assert.equal(bakery, "food")
  assert.notEqual(
    headlineForRole({ kind: bakery, role: "trust", offer: "A morning bun", businessName: "Sunrise Bakery" }),
    "A local crew takes the next step."
  )

  assert.equal(
    persuasionVertical({ goal: "Book a free roof inspection", offer: "FREE inspection", businessInfo: { name: "Northline Roofing" } }),
    "roofing"
  )
})

test("JP's Pizza cards keep the drink offer, the phone, the slice, and no QR or invented terms", async () => {
  const engine = new MockCreativeEngine()
  const result = await engine.generateDirections({
    brief: JP_PIZZA_BRIEF,
    canvas: toCreativeCanvas(POSTCARD_5X8_V1),
  })
  assert.equal(result.directions.length, 3)
  const headlines = result.directions.map((direction) => direction.spec.headline ?? "")
  assert.equal(headlines.some((line) => /result you wanted|small problem grows|local crew/i.test(line)), false)
  assert.equal(result.directions.some((direction) => /before it spreads|the outcome|local proof/i.test(direction.name)), false)

  for (const direction of result.directions) {
    const spec = direction.spec
    assert.equal(spec.phone, "111-222-3344")
    assert.equal(spec.website ?? "", "")
    assert.equal(spec.qrDestination ?? "", "")
    assert.equal(JP_PIZZA_BRIEF.brandAssets, undefined)
    assert.match(spec.visualDirection ?? "", /slice of pizza/i)
    assert.doesNotMatch(`${spec.headline} ${spec.body} ${spec.subheadline} ${spec.offer}`, /free pizza|minimum purchase|expires|licensed|abcair/i)
    assert.equal(JP_PIZZA_BRIEF.businessInfo?.address, "123 Main Street San Diego, CA. 90000")

    const rationale = spec.designRationale
    assert.ok(rationale)
    const card = composeGridCard({
      rationale,
      spec,
      businessName: "JP's Pizza",
    })
    const offer = card.front.texts.filter((text) => text.role === "offer").map((text) => text.text).join(" ")
    assert.match(offer, /drink/i)
    assert.match(offer, /redemption/i)
    assert.notEqual(offer.trim(), "FREE")
    const offerLine = card.front.texts.find((text) => text.role === "offer")
    assert.ok(offerLine && offerLine.fontPt >= 14, `offer is ${offerLine?.fontPt}pt`)
    assert.equal(offerLine?.lines.some((line) => /^(?:with|physical|of|the)$/i.test(line)), false)
    assert.equal(card.front.lockup?.qrLabel ?? "", "")
    const contact = resolveStudioContact(spec, postcardIdentityFromBrief(JP_PIZZA_BRIEF))
    assert.equal(contact.qrPayload, null)
    assert.match(card.front.lockup?.phone?.text ?? "", /111-222-3344/)
    const image = resolveCreativeImage(spec.imagery, spec.imageryRole, null, {
      libraryFallback: true,
      campaign: JP_PIZZA_BRIEF,
    })
    assert.match(image.src ?? "", /pizza-slice-stand-in/)
    assert.doesNotMatch(image.src ?? "", /stock_generic_local|handshake/)
  }

  const photo = buildPhotographyArtDirection({
    imageryRole: "neighborhood",
    leadJob: "offer",
    occupancy: "field",
    visualDirection: result.directions[0]?.spec.visualDirection ?? "",
    campaign: JP_PIZZA_BRIEF,
  })
  assert.match(photo.subject, /slice of pizza/i)
  assert.doesNotMatch(photo.subject, /residential street|local crew|handshake/)
})

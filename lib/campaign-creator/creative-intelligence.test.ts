import assert from "node:assert/strict"
import { test } from "node:test"

import type { CreativeCanvas } from "./creative-canvas"
import {
  rationaleHasUnsupportedPerformanceClaim,
  validateGenerationSet,
} from "./creative-engine-guards"
import {
  CREATIVE_DIRECT_MAIL_PRINCIPLES,
  CREATIVE_PRINCIPLE_KINDS,
  HOME_SERVICES_PRINCIPLES,
  buildCreativeIntelligenceContext,
  formatCreativeIntelligenceContext,
} from "./creative-intelligence"
import { buildGenerateSystemPrompt } from "./prompts/generate"
import type { CampaignBrief, CreativeDirection } from "./types"

const hvacBrief: CampaignBrief = {
  goal: "Book more service appointments",
  audience: { description: "Homeowners in Irvine" },
  businessInfo: { name: "ABC Air Conditioning" },
  offer: "15% off your first service call",
  primarySuccessMetric: { type: "appointment", description: "Appointment bookings" },
}

const roofingBrief: CampaignBrief = {
  goal: "Book more roof inspections",
  audience: { description: "Homeowners after recent storms" },
  businessInfo: { name: "Summit Roofing" },
  offer: "Free roof inspection",
  primarySuccessMetric: { type: "appointment", description: "Inspection bookings" },
}

const restaurantBrief: CampaignBrief = {
  goal: "Fill more weekend tables",
  audience: { description: "Nearby diners" },
  businessInfo: { name: "Harbor Pizza" },
  offer: "Free garlic knots with any large pizza",
  primarySuccessMetric: { type: "coupon_redemption", description: "Coupon redemptions" },
}

const plumbingBriefWithoutOffer: CampaignBrief = {
  goal: "Get more plumbing service calls",
  audience: { description: "Homeowners with older pipes" },
  businessInfo: { name: "Harbor Drain & Plumbing" },
}

const canvas: CreativeCanvas = {
  catalogId: "postcard_5x8",
  catalogVersion: 1,
  family: "postcard",
  displayName: "5×8 Postcard",
  trimSizeInches: { shortInches: 5, longInches: 8 },
  faces: ["front", "back"],
  addressFace: "back",
  reservedRegionRoles: [
    "delivery_address",
    "return_address",
    "postage_indicia",
    "barcode_clear_zone",
  ],
  fullBleedExpected: true,
}

function principlesFor(
  context: ReturnType<typeof buildCreativeIntelligenceContext>,
  vertical?: string
) {
  return context.principles.filter((principle) =>
    vertical ? principle.verticalCluster === vertical : !principle.verticalCluster
  )
}

test("general principles are typed with a valid epistemic kind", () => {
  const context = buildCreativeIntelligenceContext(restaurantBrief)
  const general = principlesFor(context)

  assert.equal(general.length, CREATIVE_DIRECT_MAIL_PRINCIPLES.length)
  assert.equal(general.length, 15)
  assert.deepEqual(
    general.map((principle) => principle.id),
    CREATIVE_DIRECT_MAIL_PRINCIPLES.map((principle) => principle.id)
  )

  for (const principle of general) {
    assert.equal(typeof principle.id, "string")
    assert.equal(principle.id.length > 0, true)
    assert.equal(typeof principle.statement, "string")
    assert.equal(principle.statement.length > 0, true)
    assert.equal(
      (CREATIVE_PRINCIPLE_KINDS as readonly string[]).includes(principle.kind),
      true
    )
    assert.equal(principle.verticalCluster, undefined)
  }
})

test("urgency principle no longer contains unsupported performance language", () => {
  const urgency = CREATIVE_DIRECT_MAIL_PRINCIPLES.find(
    (principle) => principle.id === "dm-urgency-frame"
  )

  assert.ok(urgency)
  assert.equal(urgency.kind, "heuristic")
  assert.doesNotMatch(urgency.statement, /outperform/i)
  assert.doesNotMatch(urgency.statement, /roi/i)
  assert.doesNotMatch(urgency.statement, /convert/i)
  assert.doesNotMatch(urgency.statement, /lift/i)
  assert.equal(rationaleHasUnsupportedPerformanceClaim(urgency.statement), false)
  assert.match(urgency.statement, /appropriate creative frame/i)
})

test("roofing and HVAC briefs receive the home-services principle slice", () => {
  for (const brief of [roofingBrief, hvacBrief]) {
    const context = buildCreativeIntelligenceContext(brief)
    const homeServices = principlesFor(context, "home-services")

    assert.equal(homeServices.length, HOME_SERVICES_PRINCIPLES.length)
    assert.deepEqual(
      homeServices.map((principle) => principle.id),
      HOME_SERVICES_PRINCIPLES.map((principle) => principle.id)
    )
    assert.equal(
      homeServices.every((principle) => principle.verticalCluster === "home-services"),
      true
    )
    assert.equal(principlesFor(context, "plumbing").length, 0)
    assert.match(homeServices.map((principle) => principle.id).join(" "), /hs-offer-classes/)
  }
})

test("research-derived imagery principles are observed_pattern and do not duplicate consequence", () => {
  const roofing = buildCreativeIntelligenceContext(roofingBrief)
  const restaurant = buildCreativeIntelligenceContext(restaurantBrief)

  const consequence = HOME_SERVICES_PRINCIPLES.filter(
    (principle) => principle.id === "hs-consequence-imagery"
  )
  assert.equal(consequence.length, 1)
  assert.equal(consequence[0].kind, "observed_pattern")
  assert.equal(consequence[0].appliesTo?.join(","), "imagery")
  assert.match(consequence[0].statement, /Name that role only/)
  assert.match(consequence[0].statement, /job-site fact/)
  assert.match(consequence[0].statement, /illustrative category situation/)
  assert.match(consequence[0].statement, /cheap fear/)
  assert.doesNotMatch(consequence[0].statement, /do not invent a photograph/)
  assert.doesNotMatch(consequence[0].statement, /or visual the brief does not support/)

  const crew = roofing.principles.find((principle) => principle.id === "hs-crew-imagery")
  assert.ok(crew)
  assert.equal(crew.kind, "observed_pattern")
  assert.equal(crew.verticalCluster, "home-services")
  assert.deepEqual(crew.appliesTo, ["imagery", "trust"])
  assert.match(crew.statement, /imageryRole crew/)
  assert.match(crew.statement, /Name the role only/)
  assert.match(crew.statement, /actual team/)
  assert.match(crew.statement, /illustrative work situation/)
  assert.equal(
    restaurant.principles.some((principle) => principle.id === "hs-crew-imagery"),
    false
  )

  const recipientProperty = restaurant.principles.find(
    (principle) => principle.id === "dm-recipient-property-not-neighborhood"
  )
  assert.ok(recipientProperty)
  assert.equal(recipientProperty.kind, "observed_pattern")
  assert.equal(recipientProperty.verticalCluster, undefined)
  assert.deepEqual(recipientProperty.appliesTo, ["imagery"])
  assert.match(recipientProperty.statement, /not generic neighborhood stock/)
  assert.match(recipientProperty.statement, /imageryRole neighborhood/)

  const formatted = formatCreativeIntelligenceContext(roofing)
  assert.equal((formatted.match(/\[hs-consequence-imagery\]/g) ?? []).length, 1)
  assert.doesNotMatch(formatted, /MMR-\d+/)
  assert.doesNotMatch(formatted, /https?:\/\//i)
  assert.doesNotMatch(formatted, /\.jpg\b/i)
})

test("non-home-services brief does not receive the home-services slice", () => {
  const context = buildCreativeIntelligenceContext(restaurantBrief)

  assert.equal(principlesFor(context, "home-services").length, 0)
  assert.equal(principlesFor(context, "plumbing").length, 0)
  assert.equal(principlesFor(context).length, 15)
})

test("plumbing-specific behavior remains correctly scoped", () => {
  const withoutOffer = buildCreativeIntelligenceContext(plumbingBriefWithoutOffer)
  const plumbing = principlesFor(withoutOffer, "plumbing")
  const joined = plumbing.map((principle) => principle.statement).join("\n")

  assert.equal(principlesFor(withoutOffer, "home-services").length > 0, true)
  assert.equal(plumbing.length > 0, true)
  assert.match(joined, /homeowner's problem/i)
  assert.match(joined, /one clear offer/i)
  assert.match(joined, /one clear action/i)
  assert.match(joined, /trust before asking/i)
  assert.match(joined, /localized/i)
  assert.match(joined, /do not invent that this business provides them/i)

  assert.doesNotMatch(joined, /highest-performing/i)
  assert.doesNotMatch(joined, /owner-occupied/i)
  assert.doesNotMatch(joined, /older than 20/i)
  assert.doesNotMatch(joined, /recent home buyers/i)
  assert.doesNotMatch(joined, /targeting renters/i)
  assert.doesNotMatch(joined, /generate service calls/i)
  assert.doesNotMatch(joined, /build neighborhood awareness/i)
  assert.equal(
    plumbing.every((principle) => principle.verticalCluster === "plumbing"),
    true
  )

  const withOffer = buildCreativeIntelligenceContext({
    ...plumbingBriefWithoutOffer,
    offer: "Free camera inspection this week",
  })
  const withOfferJoined = principlesFor(withOffer, "plumbing")
    .map((principle) => principle.statement)
    .join("\n")

  assert.doesNotMatch(withOfferJoined, /free inspection, discounted drain cleaning/i)
  assert.match(withOfferJoined, /one clear offer/i)
})

test("principle formatting preserves epistemic labels in the prompt context", () => {
  const context = buildCreativeIntelligenceContext(roofingBrief)
  const section = formatCreativeIntelligenceContext(context)
  const system = buildGenerateSystemPrompt(canvas, context)

  for (const text of [section, system]) {
    assert.match(text, /\[dm-one-objective\]/)
    assert.match(text, /\[dm-urgency-frame\]/)
    assert.match(text, /\[hs-offer-classes\]/)
    assert.match(text, /kind=heuristic/)
    assert.match(text, /kind=observed_pattern/)
    assert.match(text, /kind=unknown/)
    assert.match(text, /vertical=home-services/)
    assert.match(text, /appliesTo=offer,urgency/)
    assert.match(text, /NOT measured performance data/)
    assert.match(text, /NOT Modern Mail performance evidence/)
    assert.match(text, /guidance, not campaign facts/)
    assert.match(text, /Campaign facts/)
    assert.match(text, /Physical constraints/)
    assert.match(text, /Do not blindly follow every principle/)
    assert.doesNotMatch(text, /highest-performing/)
    assert.doesNotMatch(text, /CampaignEvaluation/)
    assert.doesNotMatch(text, /5–10%/)
    assert.doesNotMatch(text, /1,204%/)
    assert.doesNotMatch(text, /ridge vents/i)
    assert.doesNotMatch(text, /MMR-\d+/)
    assert.doesNotMatch(text, /https?:\/\//i)
    assert.doesNotMatch(text, /postcardmania/i)
    assert.doesNotMatch(text, /whosmailingwhat/i)
    assert.doesNotMatch(text, /source_url/i)
    assert.match(text, /\[hs-consequence-imagery\]/)
    assert.match(text, /\[hs-crew-imagery\]/)
    assert.match(text, /\[dm-recipient-property-not-neighborhood\]/)
    assert.match(text, /\[dm-primary-interrupt\]/)
    assert.match(text, /\[dm-imagery-honesty\]/)
    assert.match(text, /\[dm-print-not-ui-grammar\]/)
    assert.match(text, /kind=observed_pattern/)
  }

  const restaurantSection = formatCreativeIntelligenceContext(
    buildCreativeIntelligenceContext(restaurantBrief)
  )
  assert.match(restaurantSection, /not in the home-services cluster/)
  assert.doesNotMatch(restaurantSection, /\[hs-offer-classes\]/)
  assert.doesNotMatch(restaurantSection, /\[hs-crew-imagery\]/)
  assert.match(restaurantSection, /\[dm-recipient-property-not-neighborhood\]/)
  assert.match(restaurantSection, /\[dm-primary-interrupt\]/)
  assert.match(restaurantSection, /\[dm-imagery-honesty\]/)
  assert.match(restaurantSection, /\[dm-print-not-ui-grammar\]/)
})

test("craft principles stay campaign-scoped and do not assign CreativeSpec jobs", () => {
  const leadOffer = CREATIVE_DIRECT_MAIL_PRINCIPLES.find(
    (principle) => principle.id === "dm-lead-offer"
  )
  const oneAction = CREATIVE_DIRECT_MAIL_PRINCIPLES.find(
    (principle) => principle.id === "dm-one-action"
  )
  const interrupt = CREATIVE_DIRECT_MAIL_PRINCIPLES.find(
    (principle) => principle.id === "dm-primary-interrupt"
  )
  const honesty = CREATIVE_DIRECT_MAIL_PRINCIPLES.find(
    (principle) => principle.id === "dm-imagery-honesty"
  )
  const grammar = CREATIVE_DIRECT_MAIL_PRINCIPLES.find(
    (principle) => principle.id === "dm-print-not-ui-grammar"
  )
  const hsOneAction = HOME_SERVICES_PRINCIPLES.find(
    (principle) => principle.id === "hs-one-action"
  )

  assert.ok(leadOffer)
  assert.equal(leadOffer.kind, "heuristic")
  assert.deepEqual(leadOffer.appliesTo, ["offer", "hierarchy"])
  assert.match(leadOffer.statement, /the offer may lead/)
  assert.match(leadOffer.statement, /quantity may provide a viable interrupt/)
  assert.doesNotMatch(leadOffer.statement, /numeral-led/i)
  assert.doesNotMatch(leadOffer.statement, /leadJob/)
  assert.doesNotMatch(leadOffer.statement, /layoutVariant/)

  assert.ok(oneAction)
  assert.equal(oneAction.kind, "heuristic")
  assert.deepEqual(oneAction.appliesTo, ["cta"])
  assert.match(oneAction.statement, /twin primary actions/)
  assert.match(oneAction.statement, /not assigned here/)
  assert.doesNotMatch(oneAction.statement, /layoutVariant/)
  assert.doesNotMatch(oneAction.statement, /leadJob/)

  assert.ok(interrupt)
  assert.equal(interrupt.kind, "observed_pattern")
  assert.equal(interrupt.verticalCluster, undefined)
  assert.deepEqual(interrupt.appliesTo, ["hierarchy"])
  assert.match(interrupt.statement, /one primary interrupt/)
  assert.doesNotMatch(interrupt.statement, /image-led/)
  assert.doesNotMatch(interrupt.statement, /type-led/)
  assert.doesNotMatch(interrupt.statement, /layoutVariant/)
  assert.doesNotMatch(interrupt.statement, /leadJob/)
  assert.doesNotMatch(interrupt.statement, /imageryRole/)

  assert.ok(honesty)
  assert.equal(honesty.kind, "observed_pattern")
  assert.equal(honesty.verticalCluster, undefined)
  assert.deepEqual(honesty.appliesTo, ["imagery"])
  assert.match(honesty.statement, /Do not force photography/)
  assert.match(honesty.statement, /interchangeable stock/)
  assert.match(honesty.statement, /illustrative category situation/)
  assert.match(honesty.statement, /campaign facts/)
  assert.match(honesty.statement, /cheap fear/)
  assert.doesNotMatch(honesty.statement, /imageryRole/)
  assert.doesNotMatch(honesty.statement, /layoutVariant/)
  assert.doesNotMatch(honesty.statement, /still-life|lifestyle|documentary/)
  assert.doesNotMatch(honesty.statement, /Do not invent people, crews, damage, neighborhoods, or proof the brief does not contain/)

  assert.ok(grammar)
  assert.equal(grammar.kind, "observed_pattern")
  assert.equal(grammar.verticalCluster, undefined)
  assert.deepEqual(grammar.appliesTo, ["cta", "hierarchy"])
  assert.match(grammar.statement, /software-button or pill metaphors/)
  assert.match(grammar.statement, /not a score/)
  assert.doesNotMatch(grammar.statement, /quiet zone/i)
  assert.doesNotMatch(grammar.statement, /craft tier/i)
  assert.doesNotMatch(grammar.statement, /layoutVariant/)
  assert.equal(rationaleHasUnsupportedPerformanceClaim(grammar.statement), false)

  assert.ok(hsOneAction)
  assert.equal(
    hsOneAction.statement,
    "Keep one primary recipient action. Phone and QR may both appear when the brief includes them; they should serve the same action."
  )
})

function validDirection(
  index: number,
  overrides: Partial<CreativeDirection> = {}
): CreativeDirection {
  const layouts = ["type_primary_split", "peer_split", "banded_split"] as const
  const headlines = ["Free Inspection Now", "Storm Season Alert", "Trusted Neighborhood"]
  const rationales = [
    "Puts trust before the sale and makes the offer easy to understand.",
    "Uses urgency as the framing when the brief already has a season.",
    "Creates a clear next step for nearby homeowners.",
  ]

  return {
    id: `dir-${index}`,
    name: headlines[index] ?? `Direction ${index + 1}`,
    rationale: rationales[index] ?? `Strategic frame ${index + 1}.`,
    designedToDrive: "Inspection bookings",
    tags: ["Trust", "Local", "Offer"],
    recommended: index === 0,
    oneLineDifference: index === 0 ? undefined : `Different frame ${index}`,
    createdAt: "2026-09-19T00:00:00.000Z",
    spec: {
      layoutVariant: layouts[index],
      headline: headlines[index],
      body: "Licensed local crew ready to inspect.",
      callToAction: "Call to book",
      visualDirection: "Neighborhood photography",
      tone: "Trustworthy",
      palette: ["#1e3a5f", "#4a90a4", "#f5f5f0"],
      imagery: "stock_generic_local",
      leadJob: "offer",
      imageryRole: "neighborhood",
      offer: "Free roof inspection",
    },
    ...overrides,
  }
}

test("unsupported causal performance language in a rationale is rejected", () => {
  const claims = [
    "This will outperform the other two concepts.",
    "This will convert better with storm-season homeowners.",
    "Guaranteed bookings from the free inspection.",
    "Expect a 20% lift in appointments from this frame.",
    "This card has a 1,204% ROI in similar markets.",
  ]

  for (const rationale of claims) {
    assert.equal(rationaleHasUnsupportedPerformanceClaim(rationale), true, rationale)

    const reasons = validateGenerationSet(roofingBrief, [
      validDirection(0, { rationale }),
      validDirection(1),
      validDirection(2),
    ])

    assert.equal(
      reasons.some((reason) => reason.includes("unsupported performance claim")),
      true,
      rationale
    )
  }
})

test("normal strategic rationale language is accepted", () => {
  const allowed = [
    "Creates a clear next step.",
    "Makes the offer easy to understand.",
    "Uses urgency as the framing.",
    "Puts trust before the sale.",
  ]

  for (const rationale of allowed) {
    assert.equal(rationaleHasUnsupportedPerformanceClaim(rationale), false, rationale)
  }

  const reasons = validateGenerationSet(roofingBrief, [
    validDirection(0, { rationale: allowed[3] }),
    validDirection(1, { rationale: allowed[2] }),
    validDirection(2, { rationale: allowed[0] }),
  ])

  assert.deepEqual(reasons, [])
})

import { isStockHeadline } from "./persuasion"
import assert from "node:assert/strict"
import { test } from "node:test"

import { directDesign } from "./art-director"
import { critiqueCard } from "./critic"
import { composeGridCard } from "./grid-composer"
import { composePostcardFace } from "@/lib/postcard-layouts/compose"
import { scrubUnstatedAudience, scrubUnstatedName } from "./audience-facts"
import { lessonFor } from "./ad-psych/lessons-data"
import {
  applyOutcomeHeadline,
  checkPersuasion,
  onCardLine,
  roleForDirection,
  selectPersuasion,
} from "./persuasion"
import { PERSUASION_PRINCIPLES } from "./persuasion-principles"
import { selectReferences } from "./select"

test("the catalog holds the twenty-one principles", () => {
  assert.equal(PERSUASION_PRINCIPLES.length, 21)
  const ids = new Set(PERSUASION_PRINCIPLES.map((principle) => principle.id))
  assert.equal(ids.size, 21)
  for (const principle of PERSUASION_PRINCIPLES) {
    assert.ok(principle.rule.length > 8)
    assert.ok(principle.postcard.length > 8)
    assert.ok(principle.compliance.length > 8)
    assert.equal(/scare tactic|no fear|does not scare|without fear/i.test(`${principle.rule} ${principle.compliance} ${principle.postcard}`), false)
    assert.ok(principle.verticals.length > 0)
    assert.ok(principle.label.length > 0)
  }
  assert.equal(PERSUASION_PRINCIPLES.find((principle) => principle.id === "isolation_effect")?.evidence, "strong")
  assert.equal(PERSUASION_PRINCIPLES.find((principle) => principle.id === "urgency")?.evidence, "mixed-test")
  assert.equal(PERSUASION_PRINCIPLES.find((principle) => principle.id === "contrast")?.evidence, "hypothesis")
  assert.equal(PERSUASION_PRINCIPLES.find((principle) => principle.id === "scarcity")?.evidence, "weak-mixed")
})

test("a free roof inspection uses the outcome, the gift, and one standout offer", () => {
  const brief = { goal: "Book a free roof inspection", offer: "$0 inspection", audience: { description: "Homeowners" } }
  const plan = selectPersuasion({ brief, vertical: "roofing" })
  assert.equal(plan.picks.length >= 2 && plan.picks.length <= 3, true)
  assert.equal(plan.picks[0]?.id, "sell_the_outcome")
  assert.match(plan.line, /^Uses: sell the outcome, /)
  assert.equal(plan.picks.some((pick) => pick.id === "isolation_effect"), true)
  assert.equal(plan.picks.some((pick) => pick.id === "reciprocity"), true)
  assert.equal(plan.picks.some((pick) => pick.id === "loss_framing" || pick.id === "scarcity"), false)
  assert.equal(plan.primaryEmotion.source, "recommended")
  assert.equal(plan.coreNeed.label.length > 0, true)
  assert.equal(plan.awareness.id, "cold")
  assert.equal(plan.outcomeGuidance, "A safe, dry home.")
  assert.equal(isStockHeadline(applyOutcomeHeadline({ headline: "Free roof inspection", offer: "$0 inspection", brief, vertical: "roofing" })), false)
  assert.equal(applyOutcomeHeadline({
    headline: "Free roof inspection",
    offer: "$0 inspection",
    brief: { ...brief, primaryEmotion: "roofing_fear" },
    vertical: "roofing",
  }).startsWith("Call before a small leak"), false)
  assert.equal(applyOutcomeHeadline({
    headline: "Free roof inspection",
    offer: "$0 inspection",
    brief: { ...brief, audienceAwareness: "past_customer" },
    vertical: "roofing",
  }) !== "Free roof inspection", true)
  assert.equal(applyOutcomeHeadline({ headline: "See the roof before it leaks", offer: "$0 inspection", brief, vertical: "roofing" }), "See the roof before it leaks")
  assert.equal(applyOutcomeHeadline({
    headline: "See the roof before it leaks",
    offer: "$0 inspection",
    brief,
    vertical: "roofing",
    role: "outcome",
  }), "See the roof before it leaks")
  assert.equal(applyOutcomeHeadline({
    headline: "Free roof inspection",
    offer: "$0 inspection",
    brief,
    vertical: "roofing",
    role: "outcome",
  }).startsWith("A dry, safe home"), false)
})

test("a real date is the deadline, and a fake one is rejected", () => {
  const brief = {
    goal: "Book a roof inspection before the date",
    offer: "Free inspection through March 15",
    audience: { description: "Homeowners" },
  }
  const plan = selectPersuasion({ brief, vertical: "roofing" })
  assert.match(plan.line, /real deadline/)
  assert.equal(plan.picks.some((pick) => pick.id === "urgency"), true)
  const fake = checkPersuasion({
    headline: "Act now",
    copy: "Act now. Only 3 left.",
    clientText: "Free inspection",
    vertical: "roofing",
    standoutCount: 1,
  })
  assert.equal(fake.find((item) => item.id === "urgency")?.ok, false)
  assert.equal(fake.find((item) => item.id === "scarcity")?.ok, false)
  const real = checkPersuasion({
    headline: "A safe, dry home.",
    copy: "Offer ends March 15.",
    clientText: "Free inspection through March 15",
    vertical: "roofing",
    standoutCount: 1,
  })
  assert.equal(real.find((item) => item.id === "urgency")?.ok, true)
})

test("invented counts fail and a count from the client does not", () => {
  const invented = checkPersuasion({
    headline: "A safe, dry home.",
    copy: "500 neighbors already booked.",
    clientText: "Book a free roof inspection",
    vertical: "roofing",
    standoutCount: 1,
  })
  assert.equal(invented.find((item) => item.id === "invented")?.ok, false)
  const supplied = checkPersuasion({
    headline: "A safe, dry home.",
    copy: "12 neighbors already booked.",
    clientText: "12 neighbors asked last month",
    vertical: "roofing",
    standoutCount: 0,
  })
  assert.equal(supplied.find((item) => item.id === "invented")?.ok, true)
  const placeholder = checkPersuasion({
    headline: "A safe, dry home.",
    copy: "Call TBD at 123 Main Street.",
    clientText: "Book a visit",
    vertical: "roofing",
    standoutCount: 1,
  })
  assert.equal(placeholder.find((item) => item.id === "placeholder")?.ok, false)
})

test("a threat needs an easy action, and a paired threat is allowed", () => {
  const bare = checkPersuasion({
    headline: "Before it's too late",
    copy: "Before it's too late.",
    clientText: "Book a roof inspection",
    vertical: "roofing",
    standoutCount: 2,
  })
  assert.equal(bare.find((item) => item.id === "efficacy")?.ok, false)
  assert.equal(bare.find((item) => item.id === "standout")?.ok, false)
  const paired = checkPersuasion({
    headline: "A small leak becomes damage.",
    copy: "A small leak becomes damage. Call for a free inspection.",
    clientText: "Book a roof inspection",
    vertical: "roofing",
    standoutCount: 1,
  })
  assert.equal(paired.find((item) => item.id === "efficacy")?.ok, true)
  const quote = checkPersuasion({
    headline: "A safe, dry home.",
    copy: 'A neighbor said "This saved our whole house last year."',
    clientText: "Book a roof inspection",
    vertical: "roofing",
    standoutCount: 1,
  })
  assert.equal(quote.find((item) => item.id === "testimonial")?.ok, false)
  const housing = checkPersuasion({
    headline: "A fresh start.",
    copy: "An exclusive neighborhood. No children.",
    clientText: "We buy houses",
    vertical: "real_estate",
    standoutCount: 1,
  })
  assert.equal(housing.find((item) => item.id === "fair_housing")?.ok, false)
  const check = checkPersuasion({
    headline: "A fresh start.",
    copy: "Pay to the order of the homeowner.",
    clientText: "We buy houses",
    vertical: "we_buy",
    standoutCount: 1,
  })
  assert.equal(check.find((item) => item.id === "fake_check")?.ok, false)
  const medicare = checkPersuasion({
    headline: "Confidence in the choice.",
    copy: "FREE $0 premium",
    clientText: "$0 premium",
    vertical: "medicare_insurance",
    standoutCount: 1,
  })
  assert.equal(medicare.find((item) => item.id === "medicare_free")?.ok, false)
  const calm = selectPersuasion({
    brief: { goal: "Explain Medicare choices", offer: "$0 premium", audience: { description: "People who want a local explanation" } },
    vertical: "medicare_insurance",
  })
  assert.equal(calm.picks.some((pick) => pick.id === "scarcity" || pick.id === "reciprocity"), false)
  assert.equal(calm.picks.some((pick) => pick.id === "sell_the_outcome"), true)
  assert.equal(calm.outcomeGuidance, "Confidence in the choice.")
  assert.equal(applyOutcomeHeadline({
    headline: "Free plan review",
    offer: "$0 premium",
    brief: { goal: "Explain Medicare choices", offer: "$0 premium" },
    vertical: "medicare_insurance",
  }), "A plan you can check.")
  const feared = selectPersuasion({
    brief: { goal: "Explain Medicare choices", offer: "$0 premium", primaryEmotion: "medicare_fear" },
    vertical: "medicare_insurance",
  })
  assert.equal(feared.primaryEmotion.label, "Fear of coverage gaps")
  assert.equal(feared.primaryEmotion.source, "client")
})

test("the art director records the Uses line on the rationale", () => {
  const brief = { goal: "Book a free roof inspection", offer: "$0 inspection", audience: { description: "Homeowners who have not had a roofer up" } }
  const directed = directDesign({ brief, selection: selectReferences([], brief), trim: "5x8" })
  assert.ok(directed.rationale.persuasion)
  assert.equal(directed.rationale.persuasion.picks.length >= 2 && directed.rationale.persuasion.picks.length <= 3, true)
  assert.match(directed.rationale.persuasion.line, /^Uses: sell the outcome/)
  assert.equal(directed.rationale.persuasion.primaryEmotion.id.length > 0, true)
  assert.equal(directed.rationale.persuasion.coreNeed.label.length > 0, true)
  assert.equal(directed.rationale.persuasion.outcomeGuidance, "A safe, dry home.")
  assert.equal(directed.rationale.persuasion.angles.length, 2)
  assert.equal(directed.rationale.persuasion.angles[0]?.id, "A")
  assert.equal(directed.rationale.persuasion.angles[1]?.id, "B")
  assert.deepEqual(directed.rationale.persuasion.complianceWarnings, [])
  const card = composeGridCard({
    rationale: directed.rationale,
    spec: { headline: "A safe, dry home.", offer: "$0 inspection", phone: "(619) 555-0148" },
    businessName: "Northline Roofing",
  })
  const critique = critiqueCard(card, directed.rationale, "A safe, dry home. FREE inspection", undefined, "Book a free roof inspection $0 inspection")
  assert.equal(critique.autoFails.some((code) => code.startsWith("PS")), false)
  assert.equal(critique.warnings.length, 0)
})

test("a we-buy headline and a food headline sell the outcome", () => {
  assert.equal(applyOutcomeHeadline({
    headline: "Sell the house as it is.",
    offer: "We buy houses",
    brief: { goal: "Get a call from an owner who wants to sell", offer: "We buy houses" },
    vertical: "real_estate",
  }), "The sale can be simple.")
  assert.equal(applyOutcomeHeadline({
    headline: "Tuesday is two for one.",
    offer: "Tuesday, two for one",
    brief: { goal: "Fill Tuesday tables", offer: "Tuesday, two for one", businessInfo: { name: "Calle Supper" } },
  }), "A weeknight can feel special.")
  const food = selectPersuasion({
    brief: {
      goal: "Fill Tuesday tables",
      offer: "Tuesday, two for one",
      audience: { description: "Neighbors who eat out once a week" },
      businessInfo: { name: "Calle Supper" },
    },
    vertical: "general_local_service",
    blueprint: { tone: "professional" },
  })
  assert.match(food.line, /the feeling of the trade/)
  assert.equal(food.picks.some((pick) => pick.id === "attention_capture"), false)
})

test("each concept offers an outcome angle and a threat-plus-action angle", () => {
  const brief = { goal: "Book a free roof inspection", offer: "$0 inspection", audience: { description: "Homeowners" } }
  const plan = selectPersuasion({ brief, vertical: "roofing" })
  assert.deepEqual(plan.angles.map((angle) => angle.id), ["A", "B"])
  assert.equal(plan.angles[0]?.label, "Outcome / benefit")
  assert.equal(plan.angles[0]?.line, "A safe, dry home.")
  assert.equal(plan.angles[1]?.label, "Threat plus action")
  assert.equal(plan.angles[1]?.line, "A small leak becomes damage. Call for the inspection.")
  const scan = selectPersuasion({
    brief: { goal: "Show the storm map", offer: "Scan the storm map", audience: { description: "Homeowners" } },
    vertical: "roofing",
  })
  assert.match(scan.angles[1]?.line ?? "", /Scan to see it\.$/)
})

test("three directions use three psychologies and the chosen line is the headline", () => {
  const brief = { goal: "Book a free roof inspection", offer: "$0 inspection", audience: { description: "Homeowners" }, businessInfo: { name: "ABC Roofers" } }
  const plans = [0, 1, 2].map((index) => selectPersuasion({
    brief,
    vertical: "roofing",
    role: roleForDirection(index, brief.primaryEmotion),
  }))
  assert.deepEqual(plans.map((plan) => plan.role), ["outcome", "threat", "trust"])
  assert.deepEqual(plans.map((plan) => plan.primaryEmotion.label), ["Love and protection of family", "Fear of leaks and damage", "Trust"])
  const headlines = plans.map((plan) => onCardLine("roofing", plan.role))
  assert.equal(new Set(headlines).size, 3)
  assert.equal(headlines[0], "A dry, safe home starts here.")
  assert.equal(headlines[1], "Call before a small leak spreads.")
  assert.equal(headlines[2], "A local crew checks this roof.")
  for (const plan of plans) {
    const painted = plan.angles.find((angle) => angle.onCard)
    assert.equal(painted?.id, "A")
    assert.equal(painted?.line, onCardLine("roofing", plan.role))
    assert.equal(plan.angles[0]?.line === plan.angles[1]?.line, false)
    assert.equal(/\b(?:impressions?|lift|roi|unverified)\b/i.test(plan.lesson), false)
    assert.equal(plan.lesson, lessonFor("roofing", plan.role))
  }
  assert.match(plans[0]?.lesson ?? "", /finished house/i)
  assert.match(plans[1]?.lesson ?? "", /easy/i)
  const feared = [0, 1, 2].map((index) => roleForDirection(index, "roofing_fear"))
  assert.deepEqual(feared, ["threat", "outcome", "trust"])
  const copied = checkPersuasion({
    headline: "Don't leave storm damage unchecked.",
    copy: "889K impressions",
    clientText: "Book a roof inspection",
    vertical: "roofing",
    standoutCount: 1,
  })
  assert.equal(copied.find((item) => item.id === "copied_line")?.ok, false)
  assert.equal(copied.find((item) => item.id === "agency_result")?.ok, false)
})

test("a rationale cannot invent an age the client did not enter", () => {
  const facts = "Book a free roof inspection for homeowners"
  assert.equal(scrubUnstatedAudience("Homes over 30 years old need a look. The inspection is free.", facts), "The inspection is free.")
  assert.equal(scrubUnstatedName("Age-Triggered Inspection", facts, "Free roof inspection"), "Free roof inspection")
  assert.equal(scrubUnstatedAudience("Homeowners asked for a roof inspection.", facts), "Homeowners asked for a roof inspection.")
})

test("an attorney card requires Advertisement, limits dramatic imagery, and warns about the 30-day wait", () => {
  const brief = {
    goal: "Reach people after a car accident",
    offer: "Free consultation",
    audience: { description: "People who need a personal injury attorney" },
    businessInfo: { name: "Northline Law" },
  }
  const plan = selectPersuasion({ brief, vertical: "general_local_service" })
  assert.equal(plan.primaryEmotion.id, "legal_fear")
  assert.equal(plan.outcomeGuidance, "A clear next step.")
  assert.equal(plan.angles[0]?.line, "A clear next step.")
  assert.match(plan.angles[1]?.line ?? "", /Waiting can cost the claim\. Call for the free step\./)
  assert.deepEqual(plan.complianceWarnings, ["Florida Bar 4-7.18: wait 30 days after an accident before mailing."])

  const directed = directDesign({ brief, selection: selectReferences([], brief), trim: "5x8" })
  assert.equal(directed.rationale.vertical, "general_local_service")
  assert.equal(directed.rationale.photo_brief.mode, "advisor_portrait")
  assert.match(directed.rationale.photo_brief.subject, /calm consultation/)
  assert.match(directed.rationale.photo_brief.subject, /no crash and no injury/)

  const spec = { headline: "A clear next step.", offer: "Free consultation", phone: "(619) 555-0148" }
  const stamped = composeGridCard({
    rationale: directed.rationale,
    spec,
    businessName: "Northline Law",
    complianceMark: "Advertisement",
  })
  assert.match(stamped.back.texts.map((text) => text.text).join(" "), /\bAdvertisement\b/)
  const preview = composePostcardFace({
    templateId: "hero_scrim",
    face: "back",
    spec,
    businessName: "Northline Law",
    complianceMark: "Advertisement",
  })
  assert.equal(preview.overflows, false)
  assert.match(preview.texts.map((text) => text.text).join(" "), /\bAdvertisement\b/)
  const plain = composeGridCard({ rationale: directed.rationale, spec, businessName: "Northline Law" })
  assert.equal(/\bAdvertisement\b/.test(plain.back.texts.map((text) => text.text).join(" ")), false)

  const client = "Reach people after a car accident. Free consultation. personal injury attorney"
  const missing = critiqueCard(stamped, directed.rationale, "A clear next step. Free consultation", undefined, client)
  assert.equal(missing.autoFails.includes("PS13"), true)
  assert.equal(missing.autoFails.includes("PS14"), false)
  assert.deepEqual(missing.warnings, ["Florida Bar 4-7.18: wait 30 days after an accident before mailing."])

  const dramatic = {
    ...directed.rationale,
    photo_brief: { ...directed.rationale.photo_brief, subject: "A bloody crash scene with ambulance lights" },
  }
  const graphic = critiqueCard(stamped, dramatic, "Advertisement. A clear next step.", undefined, client)
  assert.equal(graphic.autoFails.includes("PS13"), false)
  assert.equal(graphic.autoFails.includes("PS14"), true)

  const labeled = critiqueCard(stamped, directed.rationale, "Advertisement. A clear next step.", undefined, client)
  assert.equal(labeled.autoFails.includes("PS13"), false)
  assert.equal(labeled.autoFails.includes("PS14"), false)
  assert.match(labeled.warnings.join(" "), /30 days/)

  const roof = critiqueCard(stamped, directed.rationale, "A safe, dry home. Free inspection", undefined, "Book a free roof inspection")
  assert.equal(roof.autoFails.includes("PS13"), false)
  assert.equal(roof.autoFails.includes("PS14"), false)
  assert.deepEqual(roof.warnings, [])
})

test("three HVAC directions get three headlines, and a nearby label does not stay", () => {
  const brief = {
    goal: "Book HVAC service before the heat",
    offer: "Free inspection for broken AC units",
    businessInfo: { name: "Northwind Heating & Air" },
  }
  const lines = (["outcome", "threat", "trust"] as const).map((role) => applyOutcomeHeadline({
    headline: role === "threat" ? "Northwind Heating & Air nearby" : "The house cools down again.",
    offer: brief.offer,
    brief,
    vertical: "hvac",
    role,
  }))
  assert.equal(new Set(lines).size, 3)
  assert.match(lines[0]!, /cools down/i)
  assert.match(lines[1]!, /AC quits/i)
  assert.match(lines[2]!, /local tech checks the AC/i)
  assert.doesNotMatch(lines[2]!, /Northwind/)
  const named = applyOutcomeHeadline({
    headline: "Coastal Comfort Heating & Air checks this.",
    offer: brief.offer,
    brief: { ...brief, businessInfo: { name: "Coastal Comfort Heating & Air" } },
    vertical: "hvac",
    role: "trust",
  })
  assert.doesNotMatch(named, /Coastal Comfort/)
  assert.match(named, /local tech checks the AC/i)
})

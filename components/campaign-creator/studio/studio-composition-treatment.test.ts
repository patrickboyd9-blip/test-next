import assert from "node:assert/strict"
import { test } from "node:test"

import {
  GENERATED_SPEC_TOOL_REQUIRED,
  LAYOUT_VARIANTS,
  type CreativeSpec,
  type ImageryRole,
  type LeadJob,
} from "../../../lib/campaign-creator/types"
import { studioCompositionStructure } from "./studio-composition-structure"
import {
  resolveStudioPalette,
  studioCompositionTreatment,
  studioTypeExecution,
  type StudioCompositionTreatment,
} from "./studio-composition-treatment"

const CAMPAIGN_PALETTE = ["#1e3a5f", "#4a90a4", "#f5f5f0"] as const
const OTHER_PALETTE = ["#2d6a4f", "#95d5b2", "#fefae0"] as const

function treatmentFor(leadJob: LeadJob, extras: Partial<{
  imageryRole: ImageryRole
  layoutVariant: CreativeSpec["layoutVariant"]
}> = {}) {
  return studioCompositionTreatment({
    leadJob,
    imageryRole: extras.imageryRole ?? "neighborhood",
    layoutVariant: extras.layoutVariant ?? "type_primary_split",
  })
}

function artDirection(leadJob: LeadJob) {
  const treatment = treatmentFor(leadJob)
  return {
    typeVoice: treatment.typeVoice,
    fieldSlot: treatment.fieldSlot,
    inkSlot: treatment.inkSlot,
    emphasisSlot: treatment.emphasisSlot,
    type: studioTypeExecution(treatment),
  }
}

test("offer-led neighborhood differs from trust-led crew", () => {
  const offerLed = studioCompositionTreatment({
    leadJob: "offer",
    imageryRole: "neighborhood",
    layoutVariant: "type_primary_split",
  })
  const trustLed = studioCompositionTreatment({
    leadJob: "trust",
    imageryRole: "crew",
    layoutVariant: "peer_split",
  })

  assert.notDeepEqual(offerLed, trustLed)
  assert.equal(offerLed.photoWeight, "subordinate")
  assert.equal(offerLed.cropPreset, "tight")
  assert.equal(offerLed.typeEmphasis, "aggressive")
  assert.equal(offerLed.ctaWeight, "strong")
  assert.equal(offerLed.paletteMode, "field")
  assert.equal(trustLed.photoWeight, "balanced")
  assert.equal(trustLed.cropPreset, "open")
  assert.equal(trustLed.typeEmphasis, "quiet")
  assert.equal(trustLed.ctaWeight, "quiet")
  assert.equal(trustLed.paletteMode, "ink")
})

test("treatment is derived from existing CreativeSpec jobs only", () => {
  const spec: CreativeSpec = {
    layoutVariant: "type_primary_split",
    leadJob: "offer",
    imageryRole: "neighborhood",
    headline: "Free Inspection",
    body: "Licensed local crew.",
    callToAction: "Call today",
    visualDirection: "Local street photography",
    tone: "urgent",
    palette: ["#1e3a5f", "#4a90a4", "#f5f5f0"],
    imagery: "stock_generic_local",
  }

  const treatment = studioCompositionTreatment({
    leadJob: spec.leadJob,
    imageryRole: spec.imageryRole,
    layoutVariant: spec.layoutVariant,
  })

  assert.equal("photoWeight" in spec, false)
  assert.equal("cropPreset" in spec, false)
  assert.equal("ctaWeight" in spec, false)
  assert.equal("typeVoice" in spec, false)
  assert.equal("fieldSlot" in spec, false)
  assert.equal(treatment.paletteMode, "field")
})

test("type_only never claims a photo weight", () => {
  const treatment = studioCompositionTreatment({
    leadJob: "trust",
    imageryRole: "crew",
    layoutVariant: "type_only",
  })
  assert.equal(treatment.photoWeight, "none")
  assert.equal(treatment.typeEmphasis, "quiet")
  assert.equal(treatment.paletteMode, "ink")
})

test("image_grounded keeps the image as ground even when offer wants a smaller photo", () => {
  const treatment = studioCompositionTreatment({
    leadJob: "offer",
    imageryRole: "neighborhood",
    layoutVariant: "image_grounded",
  })
  assert.notEqual(treatment.photoWeight, "none")
  assert.equal(treatment.ctaWeight, "strong")
  assert.equal(treatment.paletteMode, "field")
})

test("missing jobs fall back to a balanced ink treatment", () => {
  const treatment: StudioCompositionTreatment = studioCompositionTreatment({})
  assert.deepEqual(treatment, {
    photoWeight: "balanced",
    cropPreset: "default",
    typeEmphasis: "default",
    ctaWeight: "default",
    paletteMode: "ink",
    typeVoice: "default",
    fieldSlot: "accent",
    inkSlot: "primary",
    emphasisSlot: "secondary",
  })
})

test("treatment output is renderer-owned visual knobs only", () => {
  const treatment = studioCompositionTreatment({
    leadJob: "offer",
    imageryRole: "neighborhood",
    layoutVariant: "type_primary_split",
  })
  assert.deepEqual(Object.keys(treatment).sort(), [
    "cropPreset",
    "ctaWeight",
    "emphasisSlot",
    "fieldSlot",
    "inkSlot",
    "paletteMode",
    "photoWeight",
    "typeEmphasis",
    "typeVoice",
  ])
  assert.equal(
    GENERATED_SPEC_TOOL_REQUIRED.includes("photoWeight" as never),
    false
  )
  assert.equal(
    GENERATED_SPEC_TOOL_REQUIRED.includes("cropPreset" as never),
    false
  )
  assert.equal(
    GENERATED_SPEC_TOOL_REQUIRED.includes("typeVoice" as never),
    false
  )
  assert.equal(
    GENERATED_SPEC_TOOL_REQUIRED.includes("fieldSlot" as never),
    false
  )
})

test("legacy layoutVariant tokens still constrain treatment", () => {
  const typeOnly = studioCompositionTreatment({
    leadJob: "trust",
    imageryRole: "crew",
    layoutVariant: "minimal_cta" as never,
  })
  assert.equal(typeOnly.photoWeight, "none")

  const grounded = studioCompositionTreatment({
    leadJob: "offer",
    imageryRole: "neighborhood",
    layoutVariant: "photo_led" as never,
  })
  assert.notEqual(grounded.photoWeight, "none")
})

test("all layout variants still resolve a treatment", () => {
  for (const layoutVariant of LAYOUT_VARIANTS) {
    const treatment = studioCompositionTreatment({
      leadJob: "trust",
      imageryRole: "crew",
      layoutVariant,
    })
    assert.ok(treatment.photoWeight)
    assert.ok(treatment.cropPreset)
    assert.ok(treatment.typeEmphasis)
    assert.ok(treatment.ctaWeight)
    assert.ok(treatment.paletteMode)
    assert.ok(treatment.typeVoice)
    assert.ok(treatment.fieldSlot)
    assert.ok(treatment.inkSlot)
    assert.ok(treatment.emphasisSlot)
  }
})

test("offer, urgency, trust, and problem produce materially different art direction", () => {
  const jobs: LeadJob[] = ["offer", "urgency", "trust", "problem"]
  const directions = jobs.map((leadJob) => JSON.stringify(artDirection(leadJob)))
  assert.equal(new Set(directions).size, jobs.length)

  const offer = artDirection("offer")
  const urgency = artDirection("urgency")
  const trust = artDirection("trust")
  const problem = artDirection("problem")

  assert.equal(offer.typeVoice, "offer")
  assert.equal(offer.type.rhythm, "immediate")
  assert.equal(offer.type.heroColor, "emphasis")
  assert.equal(offer.type.ctaColor, "emphasis-fill")
  assert.equal(offer.fieldSlot, "primary")
  assert.equal(offer.emphasisSlot, "secondary")

  assert.equal(urgency.typeVoice, "urgency")
  assert.equal(urgency.type.rhythm, "compressed")
  assert.equal(urgency.type.weight, "extrabold")
  assert.equal(urgency.type.heroColor, "ink")
  assert.equal(urgency.fieldSlot, "secondary")
  assert.equal(urgency.emphasisSlot, "primary")

  assert.equal(trust.typeVoice, "trust")
  assert.equal(trust.type.rhythm, "composed")
  assert.equal(trust.type.weight, "medium")
  assert.equal(trust.fieldSlot, "accent")
  assert.equal(trust.inkSlot, "primary")

  assert.equal(problem.typeVoice, "problem")
  assert.equal(problem.type.rhythm, "tense")
  assert.equal(problem.type.heroColor, "emphasis")
  assert.equal(problem.emphasisSlot, "accent")
  assert.equal(problem.type.ctaColor, "ink-line")
})

test("offer and urgency are no longer identical treatments", () => {
  const offer = treatmentFor("offer")
  const urgency = treatmentFor("urgency")
  const offerType = studioTypeExecution(offer)
  const urgencyType = studioTypeExecution(urgency)

  assert.notDeepEqual(offer, urgency)
  assert.notEqual(offer.typeVoice, urgency.typeVoice)
  assert.notEqual(offer.fieldSlot, urgency.fieldSlot)
  assert.notEqual(offer.emphasisSlot, urgency.emphasisSlot)
  assert.notEqual(offerType.rhythm, urgencyType.rhythm)
  assert.notEqual(offerType.weight, urgencyType.weight)
  assert.notEqual(offerType.heroColor, urgencyType.heroColor)
  assert.notEqual(offerType.scale, urgencyType.scale)
})

test("palette execution uses CreativeSpec palette roles, not hardcoded campaign colors", () => {
  const offer = treatmentFor("offer")
  const urgency = treatmentFor("urgency")
  const trust = treatmentFor("trust")
  const problem = treatmentFor("problem")

  const fromCampaign = {
    offer: resolveStudioPalette(CAMPAIGN_PALETTE, offer),
    urgency: resolveStudioPalette(CAMPAIGN_PALETTE, urgency),
    trust: resolveStudioPalette(CAMPAIGN_PALETTE, trust),
    problem: resolveStudioPalette(CAMPAIGN_PALETTE, problem),
  }
  const fromOther = {
    offer: resolveStudioPalette(OTHER_PALETTE, offer),
    urgency: resolveStudioPalette(OTHER_PALETTE, urgency),
  }

  assert.equal(fromCampaign.offer.field, CAMPAIGN_PALETTE[0])
  assert.equal(fromCampaign.offer.emphasis, CAMPAIGN_PALETTE[1])
  assert.equal(fromCampaign.urgency.field, CAMPAIGN_PALETTE[1])
  assert.equal(fromCampaign.urgency.emphasis, CAMPAIGN_PALETTE[0])
  assert.equal(fromCampaign.trust.field, CAMPAIGN_PALETTE[2])
  assert.equal(fromCampaign.trust.ink, CAMPAIGN_PALETTE[0])
  assert.equal(fromCampaign.problem.field, CAMPAIGN_PALETTE[0])
  assert.equal(fromCampaign.problem.emphasis, CAMPAIGN_PALETTE[2])

  assert.notEqual(fromCampaign.offer.field, fromCampaign.urgency.field)
  assert.notDeepEqual(fromCampaign.offer, fromOther.offer)
  assert.notDeepEqual(fromCampaign.urgency, fromOther.urgency)

  const cliches = ["#ff0000", "#0000ff", "#ffa500", "#c0392b"]
  for (const execution of Object.values(fromCampaign)) {
    assert.equal(CAMPAIGN_PALETTE.includes(execution.field as typeof CAMPAIGN_PALETTE[number]), true)
    assert.equal(CAMPAIGN_PALETTE.includes(execution.emphasis as typeof CAMPAIGN_PALETTE[number]), true)
    assert.equal(cliches.includes(execution.field), false)
    assert.equal(cliches.includes(execution.emphasis), false)
  }
})

test("changing leadJob does not change composition structure", () => {
  const leads: LeadJob[] = ["offer", "urgency", "trust", "problem"]
  for (const layoutVariant of LAYOUT_VARIANTS) {
    const baseline = studioCompositionStructure(layoutVariant)
    for (const leadJob of leads) {
      assert.deepEqual(studioCompositionStructure(layoutVariant), baseline)
      const treatment = studioCompositionTreatment({
        leadJob,
        imageryRole: "neighborhood",
        layoutVariant,
      })
      assert.equal(treatment.typeVoice, leadJob)
      assert.equal("layoutVariant" in treatment, false)
    }
  }
})

test("imageryRole crop behavior remains intact across leadJobs", () => {
  const roles: ImageryRole[] = ["consequence", "neighborhood", "crew", "logo", "none"]
  for (const leadJob of ["offer", "urgency", "trust", "problem"] as const) {
    assert.equal(treatmentFor(leadJob, { imageryRole: "neighborhood" }).cropPreset, "tight")
    assert.equal(treatmentFor(leadJob, { imageryRole: "consequence" }).cropPreset, "tight")
    assert.equal(treatmentFor(leadJob, { imageryRole: "crew" }).cropPreset, "open")
    assert.equal(treatmentFor(leadJob, { imageryRole: "logo" }).cropPreset, "default")
    assert.equal(treatmentFor(leadJob, { imageryRole: "none" }).cropPreset, "default")
    assert.equal(roles.length, 5)
  }
})

test("layoutVariant still constrains photo weight independent of leadJob art direction", () => {
  assert.equal(
    studioCompositionTreatment({
      leadJob: "trust",
      imageryRole: "crew",
      layoutVariant: "type_only",
    }).photoWeight,
    "none"
  )
  assert.equal(
    studioCompositionTreatment({
      leadJob: "trust",
      imageryRole: "crew",
      layoutVariant: "type_primary_split",
    }).photoWeight,
    "subordinate"
  )
  assert.equal(
    studioCompositionTreatment({
      leadJob: "offer",
      imageryRole: "neighborhood",
      layoutVariant: "peer_split",
    }).photoWeight,
    "balanced"
  )
  assert.notEqual(
    studioCompositionTreatment({
      leadJob: "offer",
      imageryRole: "neighborhood",
      layoutVariant: "image_grounded",
    }).photoWeight,
    "none"
  )
})

import assert from "node:assert/strict"
import { test } from "node:test"

import type { CreativeSpec } from "@/lib/campaign-creator/types"

import { resolvePostcardLayout } from "./postcard-layout-qa"
import {
  qrQuietPaddingRatio,
  scoreAPlusPostcard,
  type RubricFacts,
  type RubricId,
} from "./postcard-rubric"

function roofing(overrides: Partial<CreativeSpec> = {}): CreativeSpec {
  return {
    layoutVariant: "image_grounded",
    headline: "Free roof inspection, including a complimentary gutter check",
    body: "ABC Roofers looks at the roof and the gutters so you know what can wait.",
    callToAction: "Book a free inspection",
    offer: "Free roof inspection",
    phone: "(619) 555-0148",
    website: "https://abcroofers.com/inspect",
    qrDestination: "https://abcroofers.com/inspect",
    visualDirection: "Rooflines along a Chula Vista street after rain.",
    tone: "Clear",
    palette: ["#2d6a4f", "#f6f1e7", "#f3ead7"],
    imagery: "stock_generic_local",
    leadJob: "offer",
    imageryRole: "neighborhood",
    ...overrides,
  }
}

const directions: Array<{ name: string; spec: CreativeSpec }> = [
  { name: "Recommended", spec: roofing() },
  {
    name: "Storm",
    spec: roofing({
      layoutVariant: "type_primary_split",
      headline: "Your roof may already be letting water in after last week's storm",
      callToAction: "Call for an inspection",
      palette: ["#1b4332", "#d8f3dc", "#fefae0"],
      imageryRole: "consequence",
      leadJob: "offer",
    }),
  },
  {
    name: "Crew",
    spec: roofing({
      layoutVariant: "banded_split",
      headline: "A local crew that shows up when the weather turns on your street",
      subheadline: "Free roof inspection. Chula Vista.",
      callToAction: "Call ABC Roofers",
      palette: ["#1e3a5f", "#4a90a4", "#f5f5f0"],
      imageryRole: "crew",
      leadJob: "trust",
    }),
  },
]

test("the founder's three roofing directions pass every automated auto-fail", () => {
  const founder = [
    {
      name: "Book In Seconds",
      spec: roofing({
        layoutVariant: "type_only",
        headline: "Book In Seconds",
        subheadline: "A free roof inspection, on your schedule.",
        callToAction: "Book a time",
        offer: "Free roof inspection",
        visualDirection: "Type only. Navy field, no photograph.",
        palette: ["#1e3a5f", "#F5C518", "#f4f1ea"],
        imagery: "none",
        imageryRole: "none",
        leadJob: "offer",
      }),
    },
    {
      name: "Photo led",
      spec: roofing({
        layoutVariant: "image_grounded",
        headline: "Free Roof Inspection",
        palette: ["#3d4450", "#d9d6d0", "#f4f1ea"],
        imageryRole: "neighborhood",
        leadJob: "offer",
      }),
    },
    {
      name: "See The Transformation",
      spec: roofing({
        layoutVariant: "peer_split",
        headline: "See The Transformation",
        subheadline: "One finished roof.",
        callToAction: "Book the inspection",
        palette: ["#1e3a5f", "#8aa4b5", "#f6f1e7"],
        imageryRole: "neighborhood",
        leadJob: "trust",
        visualDirection:
          "Before and after of a worn roof on the left half and a new roof on the right half.",
      }),
    },
  ]
  for (const direction of founder) {
    const plan = resolvePostcardLayout({ spec: direction.spec, showWordmark: true })
    const failed = plan.rubric.filter((check) => !check.pass).map((check) => `${check.id} ${check.detail}`)
    assert.deepEqual(failed, [], `${direction.name}\n${plan.rubric.map((check) => `${check.id} ${check.pass ? "pass" : "fail"} — ${check.detail}`).join("\n")}`)
  }
})

test("the three roofing directions pass every automated auto-fail", () => {
  for (const direction of directions) {
    const plan = resolvePostcardLayout({ spec: direction.spec, showWordmark: true })
    const failed = plan.rubric.filter((check) => !check.pass).map((check) => `${check.id} ${check.detail}`)
    assert.deepEqual(failed, [], `${direction.name}\n${plan.rubric.map((check) => `${check.id} ${check.pass ? "pass" : "fail"} — ${check.detail}`).join("\n")}`)
    assert.equal(plan.qrInches >= 0.75, true)
    assert.equal(plan.qrQuietModules, 4)
  }
})

test("a small accent photograph fails the hero-photo minimum", () => {
  const plan = resolvePostcardLayout({
    spec: roofing({
      layoutVariant: "type_primary_split",
      imagePresence: "accent",
      imageryRole: "neighborhood",
    }),
    showWordmark: true,
  })
  const af4 = plan.rubric.find((check) => check.id === "AF4")
  assert.equal(af4?.pass, false, af4?.detail)
  assert.ok((af4?.detail ?? "").includes("%"))
})

test("a quiet zone is four modules of the symbol, not a token padding", () => {
  const modules = 25
  const ratio = qrQuietPaddingRatio(modules)
  assert.equal(ratio, 4 / (25 + 8))
  assert.ok(ratio > 0.1)
})

test("each auto-fail can fire on its own", () => {
  const base = passingFacts()
  const cases: Array<{ id: RubricId; patch: Partial<RubricFacts> }> = [
    { id: "AF1", patch: { headlineContrast: 2.1 } },
    { id: "AF1", patch: { offerContrast: 3 } },
    { id: "AF1", patch: { ctaContrast: 2 } },
    { id: "AF2", patch: { headlineOverflows: true } },
    { id: "AF3", patch: { headlineWords: 9 } },
    { id: "AF4", patch: { heroPhoto: true, fullBleed: false, photoShare: 0.2 } },
    { id: "AF5", patch: { headlinePt: 20, bodyPt: 11, bodyShown: true } },
    { id: "AF5", patch: { offerPt: 12, bodyPt: 11, bodyShown: true, headlinePt: 30 } },
    { id: "AF6", patch: { textInsideSafe: false } },
    { id: "AF7", patch: { phoneShown: true, phonePt: 9 } },
    { id: "AF7", patch: { qrShown: true, qrInches: 0.5, qrQuietModules: 4 } },
    { id: "AF7", patch: { qrShown: true, qrInches: 1, qrQuietModules: 1 } },
    { id: "AF7", patch: { qrShown: true, qrDecodable: false } },
    { id: "AF8", patch: { boxedModules: 4 } },
    { id: "AF9", patch: { typeOnPhoto: true, scrimCoversType: false, scrimOpacity: 0 } },
    { id: "AF10", patch: { backClear: false } },
  ]
  for (const next of cases) {
    const checks = scoreAPlusPostcard({ ...base, ...next.patch })
    const check = checks.find((item) => item.id === next.id)
    assert.equal(check?.pass, false, `${next.id} ${JSON.stringify(next.patch)}`)
  }
})

function passingFacts(): RubricFacts {
  return {
    headlineContrast: 12,
    offerContrast: 12,
    ctaContrast: 12,
    headlineOverflows: false,
    headlineWords: 4,
    heroPhoto: true,
    fullBleed: false,
    photoShare: 0.56,
    headlinePt: 36,
    bodyPt: 11,
    bodyShown: false,
    offerPt: 18,
    textInsideSafe: true,
    photoInsideTrim: true,
    phoneShown: true,
    phonePt: 16,
    qrShown: true,
    qrDecodable: true,
    qrInches: 1.125,
    qrQuietModules: 4,
    boxedModules: 2,
    typeOnPhoto: false,
    scrimCoversType: false,
    scrimOpacity: 1,
    backClear: true,
  }
}

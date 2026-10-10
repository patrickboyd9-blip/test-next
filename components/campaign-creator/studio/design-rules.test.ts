import assert from "node:assert/strict"
import { test } from "node:test"

import { POSTCARD_5X8_V1 } from "@/lib/mail-catalog/pieces/postcard-5x8"
import { buildPostcard5x8PrintSpec } from "@/lib/print-spec/postcard-5x8-print-spec"

import {
  DESIGN_RULE_CATALOG,
  QR_CONTACT_RESERVE_IN,
  fitQrInches,
  qrScanLabel,
  scoreDesignRules,
  type DesignRuleFacts,
  type DesignRuleId,
} from "./design-rules"
import { resolvePostcardLayout } from "./postcard-layout-qa"
import { SAMPLE_POSTCARD_DIRECTIONS } from "./sample-postcard-directions"

test("bleed and the safe zone are both a quarter inch", () => {
  const spec = buildPostcard5x8PrintSpec()
  assert.equal(POSTCARD_5X8_V1.physical.bleedInchesPerSide, 0.25)
  assert.equal(POSTCARD_5X8_V1.creativeCanvas.recommendedSafeTextInsetInches, 0.25)
  assert.equal(spec.bleedInchesPerSide, 0.25)
  assert.equal(spec.recommendedSafeTextInsetInches, 0.25)
  assert.equal(
    spec.artworkCanvasInches.widthInches,
    POSTCARD_5X8_V1.physical.finishedTrimInches.widthInches + 0.5
  )
})

test("the rule catalog names every tight principle and every QR rule once", () => {
  const ids = DESIGN_RULE_CATALOG.map((rule) => rule.id)
  assert.deepEqual(ids, [
    "TP-01",
    "TP-02",
    "TP-03",
    "TP-04",
    "TP-05",
    "TP-06",
    "TP-07",
    "TP-08",
    "TP-09",
    "TP-10",
    "TP-11",
    "TP-12",
    "QR-1",
    "QR-2",
    "QR-3",
    "QR-4",
    "QR-5",
    "QR-6",
    "QR-7",
    "QR-8",
    "QR-9",
    "QR-10",
    "QR-11",
    "QR-12",
  ])
  assert.equal(new Set(ids).size, ids.length)
  assert.equal(DESIGN_RULE_CATALOG.find((rule) => rule.id === "TP-12")?.disposition, "guidance")
  assert.equal(DESIGN_RULE_CATALOG.find((rule) => rule.id === "QR-12")?.disposition, "warn")
})

test("a scan label follows the call to action and stays short", () => {
  assert.equal(qrScanLabel("Book a time"), "Scan to book")
  assert.equal(qrScanLabel("Call the office"), "Scan to call")
  assert.equal(qrScanLabel("See the work"), "Scan")
  assert.equal(qrScanLabel(undefined), "Scan")
})

test("a large code shrinks to the room beside the phone", () => {
  const wide = fitQrInches(1.5, 7.2, QR_CONTACT_RESERVE_IN)
  assert.equal(wide, 1.5)
  const narrow = fitQrInches(1.5, 3.05, QR_CONTACT_RESERVE_IN)
  assert.ok(narrow + 0.001 >= 1, String(narrow))
  assert.ok(narrow < 1.5, String(narrow))
  assert.ok(narrow <= 3.05 - QR_CONTACT_RESERVE_IN + 0.001)
})

test("roofing, HVAC, and dental directions pass the hard rules", () => {
  const rows: string[] = []
  for (const direction of SAMPLE_POSTCARD_DIRECTIONS) {
    const plan = resolvePostcardLayout({ spec: direction.spec, showWordmark: true })
    const failed = plan.designRules.filter((check) => check.pass === false)
    const hard = failed.filter((check) => check.disposition === "hard")
    assert.deepEqual(
      hard.map((check) => `${check.id} ${check.detail}`),
      [],
      direction.name
    )
    assert.equal(plan.qrQuietModules, 4)
    assert.ok(plan.lockup)
    assert.equal(plan.qrLabel.split(/\s+/).length <= 4, true)
    const marks = plan.designRules
      .map((check) => `${check.id}:${check.pass === null ? "guidance" : check.pass ? "pass" : "fail"}`)
      .join(" ")
    rows.push(`${direction.vertical}\t${direction.name}\t${marks}`)
  }
  assert.equal(rows.length, 9)
})

test("a large QR on a split card is resized and still passes", () => {
  const spec = SAMPLE_POSTCARD_DIRECTIONS[2].spec
  const plan = resolvePostcardLayout({
    spec: { ...spec, layoutHints: { qrProminence: "large" } },
    showWordmark: true,
  })
  assert.ok(plan.qrInches < 1.5, String(plan.qrInches))
  assert.ok(plan.qrInches + 0.001 >= 1, String(plan.qrInches))
  assert.ok(plan.fixes.some((fix) => fix.startsWith("Sized the QR")))
  const qr1 = plan.designRules.find((check) => check.id === "QR-1")
  assert.equal(qr1?.pass, true, qr1?.detail)
})

test("each measured rule can fail on its own", () => {
  const base = passingFacts()
  const cases: Array<{ id: DesignRuleId; patch: Partial<DesignRuleFacts> }> = [
    { id: "TP-01", patch: { ctaShown: true, ctaWords: 8 } },
    { id: "TP-02", patch: { headlineWords: 9 } },
    { id: "TP-03", patch: { offerPresent: true, offerPaint: "none" } },
    { id: "TP-04", patch: { headlinePt: 20, bodyPt: 11, bodyShown: true } },
    { id: "TP-05", patch: { heroPhoto: true, fullBleed: false, photoShare: 0.2 } },
    { id: "TP-06", patch: { headlineContrast: 2 } },
    { id: "TP-07", patch: { textInsideSafe: false } },
    { id: "TP-08", patch: { boxedModules: 4 } },
    { id: "TP-09", patch: { typeOnPhoto: true, scrimCoversType: false, scrimOpacity: 0 } },
    { id: "TP-10", patch: { backClear: false } },
    { id: "TP-11", patch: { phoneShown: true, responseCluster: false } },
    { id: "QR-1", patch: { qrShown: true, qrInches: 0.7, columnCanHoldOneInch: true } },
    { id: "QR-2", patch: { qrShown: true, qrQuietModules: 2 } },
    { id: "QR-3", patch: { qrShown: true, labelOutsideQuiet: false } },
    { id: "QR-4", patch: { qrShown: true, moduleContrast: 2 } },
    { id: "QR-5", patch: { qrShown: true, moduleInkDarker: false } },
    { id: "QR-6", patch: { qrShown: true, labelPresent: false, labelWords: 0 } },
    { id: "QR-7", patch: { qrShown: true, labelContrast: 2 } },
    { id: "QR-8", patch: { qrShown: true, labelPt: 6 } },
    { id: "QR-9", patch: { qrShown: true, ctaShown: true, qrBesideCta: false } },
    { id: "QR-10", patch: { qrShown: true, lockupInsideSafe: false } },
    { id: "QR-11", patch: { fullCard: true, phoneShown: true, phoneInLockup: false } },
    { id: "QR-12", patch: { qrShown: true, qrDecodable: true, urlMatchesQr: false } },
  ]
  for (const next of cases) {
    const check = scoreDesignRules({ ...base, ...next.patch }).find((item) => item.id === next.id)
    assert.equal(check?.pass, false, `${next.id} ${check?.detail}`)
  }
  const guidance = scoreDesignRules(base).find((check) => check.id === "TP-12")
  assert.equal(guidance?.pass, null)
})

function passingFacts(): DesignRuleFacts {
  return {
    ctaShown: true,
    ctaWords: 4,
    headlineWords: 3,
    offerPresent: true,
    offerPaint: "line",
    headlineContrast: 12,
    offerContrast: 12,
    ctaContrast: 12,
    headlinePt: 36,
    bodyPt: 11,
    bodyShown: false,
    offerPt: 16,
    heroPhoto: true,
    fullBleed: false,
    photoShare: 0.56,
    textInsideSafe: true,
    photoInsideTrim: true,
    boxedModules: 2,
    typeOnPhoto: false,
    scrimCoversType: true,
    scrimOpacity: 1,
    backClear: true,
    responseCluster: true,
    qrShown: true,
    qrDecodable: true,
    qrInches: 1.125,
    columnCanHoldOneInch: true,
    qrQuietModules: 4,
    labelPresent: true,
    labelWords: 3,
    labelOutsideQuiet: true,
    labelPt: 8,
    labelContrast: 12,
    moduleContrast: 16,
    moduleInkDarker: true,
    qrBesideCta: true,
    lockupInsideSafe: true,
    fullCard: true,
    phoneShown: true,
    phoneInLockup: true,
    phonePt: 16,
    urlShown: true,
    urlInLockup: true,
    urlPt: 13,
    urlMatchesQr: true,
  }
}

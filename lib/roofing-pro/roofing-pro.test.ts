import assert from "node:assert/strict"
import { test } from "node:test"

import type { CreativeSpec } from "@/lib/campaign-creator/types"
import { headIsClipped } from "@/lib/design-intelligence/subject-crop"
import {
  composePostcardFace,
  contentTrimRect,
  safeTrimRect,
  trimKeepOuts,
} from "@/lib/postcard-layouts/compose"
import type { PostcardSizeId } from "@/lib/postcard-layouts/ids"
import { rectContains, rectsOverlap } from "@/lib/postcard-layouts/templates"
import { contrastRatio } from "@/lib/postcard-layouts/palette"
import { selectPrintDesign } from "@/lib/print-spec/render-template-postcard-pdf"

import { statedExpiryLine, statedLicense } from "./copy"
import { composeRoofingProCard } from "./compose"
import { ROOFING_PRO_TEMPLATE_IDS, type RoofingProTemplateId } from "./ids"
import { keepRoofingTemplate } from "./preserve"

const SIZES: PostcardSizeId[] = ["5x8", "6x9"]

const NORTHLINE: CreativeSpec = {
  headline: "A roof that stays dry",
  subheadline: "We walk it and tell you what can wait.",
  body: "Northline checks the roof and the flashing. You get a plain answer.",
  offer: "Free roof inspection",
  callToAction: "Book a free inspection",
  phone: "(619) 555-0148",
  website: "https://northline.example/book",
  qrDestination: "https://northline.example/book",
}

const SUMMIT: CreativeSpec = {
  headline: "The ridge line, made quiet",
  subheadline: "One look at the roof you already have.",
  body: "Summit Peak walks the roof. Then we tell you what can wait.",
  offer: "$500 off a roof",
  callToAction: "Book a free inspection",
  phone: "(720) 555-0194",
  website: "https://summitpeak.example/look",
  qrDestination: "https://summitpeak.example/look",
}

test("every roofing pro template keeps type and the QR in the safe zone", () => {
  for (const size of SIZES) {
    for (const id of ROOFING_PRO_TEMPLATE_IDS) {
      for (const [name, spec, business, license] of [
        ["Northline", NORTHLINE, "Northline Roofing", "ROC 301442"],
        ["Summit", SUMMIT, "Summit Peak Roofing", "Licensed"],
      ] as const) {
        const card = composeRoofingProCard({
          templateId: id,
          size,
          spec,
          businessName: business,
          qrPayload: spec.qrDestination,
          license,
        })
        const front = card.front
        const safe = safeTrimRect(size)
        assert.equal(front.overflows, false, `${id} ${size} ${name}`)
        assert.deepEqual(front.missingContact, [], `${id} ${size} ${name}`)
        assert.equal(card.back.overflows, false, `${id} ${size} ${name} back`)
        assert.ok((front.lockup?.qrInches ?? 0) >= 0.75, `${id} qr`)
        assert.equal(rectContains(safe, front.lockup!.qrRect), true, `${id} qr safe`)
        assert.equal(rectContains(safe, front.lockup!.rect), true, `${id} lockup safe`)
        if (front.lockup?.phone) {
          assert.equal(rectContains(safe, front.lockup.phone.rect), true, `${id} phone`)
          assert.equal(rectsOverlap(front.lockup.phone.rect, front.lockup.qrRect), false, `${id} phone/qr`)
          assert.ok(front.lockup.phone.fontPt >= 12, `${id} phone size`)
        }
        if (front.lockup?.website && front.lockup.phone) {
          assert.equal(rectContains(safe, front.lockup.website.rect), true, `${id} url`)
          assert.equal(rectsOverlap(front.lockup.phone.rect, front.lockup.website.rect, 0.02), false, `${id} phone/url`)
        }
        for (const text of front.texts) {
          assert.equal(rectContains(safe, text.rect), true, `${id} ${size} ${text.role} ${text.text}`)
          assert.equal(text.overflows, false, `${id} ${text.role}`)
        }
        const content = contentTrimRect(size)
        for (const text of card.back.texts) {
          assert.equal(rectContains(content, text.rect, 0.04), true, `${id} back ${text.role}`)
          for (const keepOut of trimKeepOuts(size)) {
            assert.equal(rectsOverlap(text.rect, keepOut), false, `${id} ${text.text} ${keepOut.id}`)
          }
        }
        const spoken = [...front.texts, ...card.back.texts].map((text) => text.text).join(" ")
        assert.match(spoken, new RegExp(license.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"), `${id} license`)
        assert.doesNotMatch(spoken, /act now|expires soon|official notice|neighbors/i)
        const offer = front.texts.find((text) => text.role === "offer")
        const headline = front.texts.find((text) => text.role === "headline")
        assert.ok(headline && offer, `${id} lines`)
        if (id === "roof_coupon") assert.ok(offer!.fontPt > headline!.fontPt, id)
        else assert.ok(headline!.fontPt > offer!.fontPt, id)
        for (const slot of front.photos) {
          assert.ok(slot.rect.w >= 2.2 && slot.rect.h >= 2.1, `${id} photo ${slot.rect.w}x${slot.rect.h}`)
          if (slot.focal && slot.focal.y < 0.3) assert.equal(headIsClipped(slot), false, `${id} head`)
        }
        const tile = front.shapes.find((shape) => shape.role === "offer-tile")
        assert.ok(tile, `${id} tile`)
        assert.equal(rectContains(tile!.rect, offer!.rect, 0.04), true, `${id} offer in tile`)
        assert.ok(contrastRatio(offer!.color, tile!.fill) >= 4.5, `${id} offer contrast`)
      }
    }
  }
})

test("a long headline shrinks on a word boundary and does not clip", () => {
  const front = composePostcardFace({
    templateId: "roof_full_bleed",
    size: "5x8",
    spec: {
      ...NORTHLINE,
      headline: "Your roof may already be letting the weather into the rooms you use every night",
      offer: "Free roof inspection this week for every neighbor on the block",
    },
    businessName: "Northline Roofing",
    qrPayload: NORTHLINE.qrDestination,
    license: "ROC 301442",
  })
  assert.equal(front.overflows, false)
  const headline = front.texts.find((text) => text.role === "headline")
  const offer = front.texts.find((text) => text.role === "offer")
  assert.ok(headline)
  assert.ok(offer)
  assert.equal(headline!.text.endsWith("night"), false)
  assert.equal(/\S$/.test(headline!.text), true)
  assert.ok(headline!.fontPt >= 8)
  assert.ok(headline!.fontPt > offer!.fontPt)
})

test("license and expiry are printed only when the business stated them", () => {
  assert.equal(statedLicense(undefined, "Free roof inspection"), "")
  assert.equal(statedLicense(undefined, "Licensed and insured"), "Licensed")
  assert.equal(statedLicense("ROC 301442", ""), "ROC 301442")
  assert.equal(statedExpiryLine("Free roof inspection"), null)
  assert.equal(statedExpiryLine("Valid through May 30"), "Valid through May 30")
  const quiet = composeRoofingProCard({
    templateId: "roof_storm",
    spec: NORTHLINE,
    businessName: "Northline Roofing",
    qrPayload: NORTHLINE.qrDestination,
  })
  const spoken = [...quiet.front.texts, ...quiet.back.texts].map((text) => text.text).join(" ")
  assert.doesNotMatch(spoken, /ROC|expires|May 30/i)
  const dated = composeRoofingProCard({
    templateId: "roof_coupon",
    spec: { ...SUMMIT, offer: "$500 off", subheadline: "Valid through May 30" },
    businessName: "Summit Peak Roofing",
    qrPayload: SUMMIT.qrDestination,
    license: "Licensed",
  })
  assert.match(dated.back.texts.map((text) => text.text).join(" "), /May 30/)
})

test("preview and print share the pro template card", () => {
  const preview = composeRoofingProCard({
    templateId: "roof_full_bleed" satisfies RoofingProTemplateId,
    spec: NORTHLINE,
    businessName: "Northline Roofing",
    qrPayload: NORTHLINE.qrDestination,
    license: "ROC 301442",
  })
  const chosen = selectPrintDesign({
    rationale: { not: "a rationale" },
    studio: preview,
    templateId: "roof_full_bleed",
  })
  assert.equal(chosen.source, "studio")
  if (chosen.source === "studio") assert.equal(chosen.card, preview)
})

test("a refinement keeps the chosen pro template", () => {
  const current: CreativeSpec = {
    headline: "A roof that stays dry",
    layoutHints: { templateId: "roof_storm", verticalPalette: "roofing" },
  }
  const next: CreativeSpec = { headline: "A roof that stays dry", offer: "Free roof inspection" }
  const kept = keepRoofingTemplate(current, next)
  assert.equal(kept.layoutHints?.templateId, "roof_storm")
  const switched = keepRoofingTemplate(current, {
    ...next,
    layoutHints: { templateId: "roof_coupon", verticalPalette: "roofing" },
  })
  assert.equal(switched.layoutHints?.templateId, "roof_coupon")
})

import assert from "node:assert/strict"
import { test } from "node:test"

import { CUSTOMER_LOGO_BOX } from "@/lib/campaign-creator/customer-logo"
import type { CreativeSpec } from "@/lib/campaign-creator/types"
import { composePostcardFace, trimKeepOuts, type PostcardFacePlan } from "@/lib/postcard-layouts/compose"
import { POSTCARD_TEMPLATE_IDS, type PostcardSizeId } from "@/lib/postcard-layouts/ids"
import { rectsOverlap, type InchRect } from "@/lib/postcard-layouts/templates"
import { composeRoofingProCard } from "@/lib/roofing-pro/compose"

import { CLICK2MAIL_RESERVED_POINTS } from "./click2mail-keep-outs"
import { buildPostcard5x8PrintSpec } from "./postcard-5x8-print-spec"
import { buildPostcard6x9PrintSpec } from "./postcard-6x9-print-spec"

const SIZES: PostcardSizeId[] = ["5x8", "6x9"]

const LONG: CreativeSpec = {
  headline: "Your roof may already be letting the weather into the rooms you use every night",
  subheadline: "Cascade Ridge walks the whole slope and tells you what can wait",
  body: "The written notes stay on the card. Nothing is dropped to clear the barcode zone.",
  offer: "$750 off a new metal roof",
  callToAction: "Call the office",
  phone: "(253) 555-0139",
  website: "https://cascaderidgeroofing.example/book-a-visit",
  qrDestination: "https://cascaderidgeroofing.example/book-a-visit",
}

const LONG_NAME = "Cascade Ridge Premium Residential Roofing Specialists"

test("confirmed point sizes anchor the address box and the barcode zone at the bottom-right", () => {
  const specs = [
    ["5x8", buildPostcard5x8PrintSpec()],
    ["6x9", buildPostcard6x9PrintSpec()],
  ] as const
  for (const [size, spec] of specs) {
    const want = CLICK2MAIL_RESERVED_POINTS[size]
    const panel = spec.keepOuts.find((item) => item.id === "mailing_panel")
    const zone = spec.keepOuts.find((item) => item.id === "barcode_strip")
    assert.ok(panel)
    assert.ok(zone)
    assert.equal(panel.pdf.widthPoints, want.mailingPanel.widthPoints)
    assert.equal(panel.pdf.heightPoints, want.mailingPanel.heightPoints)
    assert.equal(zone.pdf.widthPoints, want.barcodeClearZone.widthPoints)
    assert.equal(zone.pdf.heightPoints, want.barcodeClearZone.heightPoints)
    const trimRight = spec.trimOnCanvas.xInches + spec.trimOnCanvas.widthInches
    const trimBottom = spec.trimOnCanvas.yInches + spec.trimOnCanvas.heightInches
    for (const box of [panel, zone]) {
      assert.ok(Math.abs(box.canvas.xInches + box.canvas.widthInches - trimRight) < 1e-9, box.id)
      assert.ok(Math.abs(box.canvas.yInches + box.canvas.heightInches - trimBottom) < 1e-9, box.id)
    }
  }
})

test("every back keeps text, photos, QR, and offer bars out of the barcode zone and the address box", () => {
  for (const size of SIZES) {
    for (const id of POSTCARD_TEMPLATE_IDS) {
      const back = composePostcardFace({
        templateId: id,
        size,
        face: "back",
        spec: {
          headline: "A short honest headline",
          offer: "$400 off a full roof replacement",
          phone: "(619) 555-0148",
          website: "https://northline.example/book",
          qrDestination: "https://northline.example/book",
        },
        businessName: "Northline Roofing",
        qrPayload: "https://northline.example/book",
        license: "CSLB #1043322",
      })
      assertClear(back, size, id)
    }
  }
})

test("long headlines and long footers reflow above the barcode zone", () => {
  for (const size of SIZES) {
    const bold = composeRoofingProCard({
      templateId: "roof_bold",
      size,
      spec: LONG,
      businessName: LONG_NAME,
      qrPayload: LONG.qrDestination,
      license: "CSLB #1043322",
      photoSubject: "person",
    })
    assert.equal(bold.back.overflows, false, `${size} bold`)
    const spoken = bold.back.texts.map((text) => text.text).join(" ")
    assert.match(spoken, /Cascade Ridge Premium Residential Roofing Specialists/)
    assert.match(spoken, /letting the weather into the rooms you use every night/)
    assert.match(spoken, /\$750/)
    assert.match(spoken, /off a new metal roof/)
    assert.match(spoken, /253\) 555-0139/)
    assert.match(spoken, /CSLB #1043322/)
    assertClear(bold.back, size, "roof_bold long")

    const coupon = composeRoofingProCard({
      templateId: "roof_coupon",
      size,
      spec: LONG,
      businessName: LONG_NAME,
      license: "CSLB #1043322",
    })
    assert.equal(coupon.back.overflows, false, `${size} coupon`)
    assert.match(coupon.back.texts.map((text) => text.text).join(" "), /letting the weather into the rooms you use every night/)
    assertClear(coupon.back, size, "roof_coupon long")

    const fade = composeRoofingProCard({
      templateId: "roof_fade_offer",
      size,
      spec: LONG,
      businessName: LONG_NAME,
      qrPayload: LONG.qrDestination,
      license: "CSLB #1043322",
      photoSubject: "person",
    })
    assert.equal(fade.back.photos.length > 0, true, `${size} fade photo`)
    assertClear(fade.back, size, "roof_fade_offer long")

    const letter = composePostcardFace({
      templateId: "neighbor_letter",
      size,
      face: "back",
      spec: {
        ...LONG,
        addressSide: { sections: { contact: true, license: true, offer: true, qr: true, proof: true } },
      },
      businessName: LONG_NAME,
      qrPayload: LONG.qrDestination,
      license: "CSLB #1043322",
    })
    const letterText = letter.texts.map((text) => text.text).join(" ")
    assert.match(letterText, /253\) 555-0139/)
    assert.match(letterText, /CSLB #1043322/)
    assert.equal(letter.overflows, false, `${size} letter`)
    assertClear(letter, size, "neighbor_letter long")
  }
})

test("fronts are not moved to clear the back barcode zone", () => {
  assert.ok(CUSTOMER_LOGO_BOX.y + CUSTOMER_LOGO_BOX.h < 2, "logo stays in the upper-left of the front")
  for (const size of SIZES) {
    for (const id of POSTCARD_TEMPLATE_IDS) {
      const front = composePostcardFace({
        templateId: id,
        size,
        face: "front",
        spec: LONG,
        businessName: LONG_NAME,
        qrPayload: LONG.qrDestination,
        license: "CSLB #1043322",
      })
      assert.equal(front.face, "front")
      assert.equal(front.shapes.some((shape) => shape.id === "barcode-clear"), false, id)
    }
    const bold = composeRoofingProCard({
      templateId: "roof_bold",
      size,
      spec: LONG,
      businessName: LONG_NAME,
      qrPayload: LONG.qrDestination,
      license: "CSLB #1043322",
    })
    assert.ok((bold.front.lockup?.phone?.rect.y ?? 0) > (size === "6x9" ? 4.5 : 3.8), `${size} front footer stays low`)
  }
})

function assertClear(plan: PostcardFacePlan, size: PostcardSizeId, label: string) {
  const keepOuts = trimKeepOuts(size).filter((item) => item.id === "barcode_strip" || item.id === "mailing_panel")
  assert.equal(keepOuts.length, 2, label)
  const boxes: Array<InchRect & { name: string }> = [
    ...plan.texts.map((text) => ({ ...text.rect, name: `${text.role} ${text.text}` })),
    ...plan.photos.map((slot) => ({ ...slot.rect, name: slot.id })),
    ...plan.shapes
      .filter((shape) => shape.role !== "paper")
      .map((shape) => ({ ...shape.rect, name: `${shape.role} ${shape.id}` })),
  ]
  if (plan.lockup) {
    if (plan.lockup.qrInches > 0) boxes.push({ ...plan.lockup.qrRect, name: "qr" })
    if (plan.lockup.phone) boxes.push({ ...plan.lockup.phone.rect, name: "phone" })
    if (plan.lockup.website) boxes.push({ ...plan.lockup.website.rect, name: "website" })
  }
  for (const box of boxes) {
    if (box.w <= 0 || box.h <= 0) continue
    for (const keepOut of keepOuts) {
      assert.equal(hits(box, keepOut), false, `${label} ${size} ${box.name} hits ${keepOut.id}`)
    }
  }
}

function hits(a: InchRect, b: InchRect): boolean {
  return rectsOverlap(a, b, 0.002)
}

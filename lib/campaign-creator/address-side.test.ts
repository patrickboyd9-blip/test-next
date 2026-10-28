import assert from "node:assert/strict"
import test from "node:test"

import { directDesign } from "@/lib/design-intelligence/art-director"
import { composeGridCard } from "@/lib/design-intelligence/grid-composer"
import { selectReferences } from "@/lib/design-intelligence/select"
import { addressSideContentRect, rectsOverlap } from "@/lib/print-spec/address-side-content"
import { buildPostcard5x8PrintSpec } from "@/lib/print-spec/postcard-5x8-print-spec"
import { encodeSolidPng } from "@/lib/print-spec/raster"
import { renderStudioDesignPdf } from "@/lib/print-spec/render-template-postcard-pdf"
import { finalizeRefinement } from "@/lib/campaign-creator/creative-engine-guards"

import { addressSideArtRects, composeAddressSideFace } from "./address-side-layout"
import {
  addressSideLocks,
  artMissesKeepOuts,
  mergeAddressSide,
  trimRectToCanvas,
  writeAddressSide,
} from "./address-side"
import { paletteById } from "@/lib/postcard-layouts/palette"
import type { Campaign, CreativeSpec } from "./types"
import { createEmptyCampaignCreative } from "./types"

function card(spec: CreativeSpec) {
  const brief = { goal: "Free inspection for broken AC units", offer: spec.offer, businessInfo: { name: "Northwind Heating & Air" } }
  const rationale = directDesign({
    brief,
    selection: selectReferences([], brief),
    trim: "5x8",
    slot: 1,
  }).rationale
  return composeGridCard({
    rationale,
    spec: { ...spec, phone: "(512) 555-0148", website: "northwind.example" },
    businessName: "Northwind Heating & Air",
    license: "TACLB 12345",
    returnAddress: "100 Market St",
  })
}

test("an unedited back stays the generated name, phone, website, and proof", () => {
  const painted = card({ offer: "Free inspection for broken AC units" })
  const text = painted.back.texts.map((line) => line.text).join(" ")
  assert.match(text, /Northwind Heating & Air/)
  assert.match(text, /512/)
  assert.match(text, /northwind\.example/)
  assert.equal(painted.back.texts.some((line) => line.role === "offer"), false)
  assert.equal(painted.back.photos.length, 0)
  assert.equal(painted.back.lockup, null)
})

test("the offer can be shown or hidden, and a removed photo leaves no slot", () => {
  const offer = "Free inspection for broken AC units"
  const shown = card({
    offer,
    addressSide: mergeAddressSide(undefined, { sections: { offer: true } }),
  })
  assert.equal(shown.back.texts.some((line) => line.role === "offer" && line.text.includes(offer)), true)

  const hidden = card({
    offer,
    addressSide: mergeAddressSide(undefined, { sections: { offer: false }, offer: "" }),
  })
  assert.equal(hidden.back.texts.some((line) => line.role === "offer"), false)

  const removed = card({
    offer,
    addressSide: mergeAddressSide(undefined, { sections: { photo: true }, photoSrc: "none" }),
  })
  assert.equal(removed.back.photos.length, 0)

  const photo = card({
    offer,
    addressSide: mergeAddressSide(undefined, { sections: { photo: true, qr: true }, qrDestination: "https://northwind.example/book" }),
  })
  assert.equal(photo.back.photos.length, 1)
  assert.ok(photo.back.lockup)
  assert.equal(artMissesKeepOuts(addressSideArtRects(photo.back)), true)
})

test("postage, the address panel, and the barcode stay outside the message area", () => {
  const geometry = buildPostcard5x8PrintSpec()
  const content = addressSideContentRect(geometry)
  for (const lock of addressSideLocks("5x8")) {
    const canvas = trimRectToCanvas(lock, geometry.bleedInchesPerSide)
    assert.equal(rectsOverlap(canvas, content), false, lock.id)
  }
})

test("a back edit is what the print file paints, including a replacement photo", async () => {
  const offer = "Filters changed on the visit"
  const painted = card({
    offer,
    addressSide: mergeAddressSide(undefined, {
      sections: { offer: true, photo: true },
      offer,
    }),
  })
  assert.match(painted.back.texts.map((line) => line.text).join("\n"), /Filters changed on the visit/)
  const png = encodeSolidPng(24, 24, [40, 90, 140])
  const image = { bytes: new Uint8Array(png), width: 24, height: 24 }
  const copy = {
    businessName: "Northwind Heating & Air",
    offer,
    addressSide: mergeAddressSide(undefined, { sections: { offer: true, photo: true }, offer }),
  }
  const withoutPhoto = await renderStudioDesignPdf({ card: painted, copy })
  const withPhoto = await renderStudioDesignPdf({ card: painted, copy, backImage: image })
  assert.ok(withPhoto.bytes.byteLength > withoutPhoto.bytes.byteLength)
  assert.equal(Buffer.from(withoutPhoto.bytes).toString("latin1").includes("/Subtype /Image"), false)
  assert.equal(Buffer.from(withPhoto.bytes).toString("latin1").includes("/Subtype /Image"), true)
  assert.equal(artMissesKeepOuts(addressSideArtRects(withPhoto.design.back)), true)
})

test("saving the back updates the direction, the revision, and the approved piece", () => {
  const spec: CreativeSpec = { headline: "The house cools down again.", offer: "Free inspection" }
  const campaign = {
    id: "c1",
    ownerId: "owner",
    status: "creative_approved",
    brief: {},
    creative: createEmptyCampaignCreative(),
    transcript: [],
    createdAt: "2026-10-27T00:00:00.000Z",
    updatedAt: "2026-10-27T00:00:00.000Z",
  } as unknown as Campaign
  campaign.creative.directions = [{
    id: "dir",
    name: "Cool the house",
    rationale: "",
    designedToDrive: "Calls",
    tags: [],
    spec: { ...spec },
    recommended: true,
    createdAt: campaign.createdAt,
  }]
  campaign.creative.selectedDirectionId = "dir"
  campaign.creative.activeSpec = { ...spec }
  campaign.creative.revisions = [{
    id: "rev",
    directionId: "dir",
    version: 1,
    spec: { ...spec },
    customerPrompt: "Original concept",
    studioResponse: "",
    type: "refinement",
    createdAt: campaign.createdAt,
  }]
  campaign.creative.activeRevisionId = "rev"
  campaign.mailPiece = {
    id: "piece",
    version: 1,
    approvedAt: campaign.createdAt,
    directionId: "dir",
    revisionId: "rev",
    catalogId: "postcard_5x8",
    catalogVersion: 1,
    spec: { ...spec },
  }
  const edit = mergeAddressSide(undefined, { sections: { offer: true }, offer: "Same-day visit" })
  writeAddressSide(campaign, "dir", edit)
  assert.equal(campaign.creative.directions[0]?.spec.addressSide?.offer, "Same-day visit")
  assert.equal(campaign.creative.activeSpec?.addressSide?.offer, "Same-day visit")
  assert.equal(campaign.creative.revisions[0]?.spec.addressSide?.offer, "Same-day visit")
  assert.equal(campaign.mailPiece.spec.addressSide?.offer, "Same-day visit")
  assert.equal(campaign.mailPiece.spec.addressSide?.sections?.proof, true)
})

test("a later refine keeps the back the customer edited", () => {
  const current: CreativeSpec = {
    headline: "The house cools down again.",
    offer: "Free inspection",
    addressSide: mergeAddressSide(undefined, { sections: { offer: true }, offer: "Same-day visit" }),
  }
  const result = finalizeRefinement({
    brief: { offer: "Free inspection" },
    directionId: "dir",
    currentSpec: current,
    prompt: "Make the headline larger",
    proposed: {
      outcome: "success",
      spec: { headline: "Cool air by evening.", offer: "Free inspection" },
    },
  })
  assert.match(result.spec.headline ?? "", /Cool air by evening/)
  assert.equal(result.spec.addressSide?.offer, "Same-day visit")
  assert.equal(result.spec.addressSide?.sections?.offer, true)
})

test("turning every section on still stays inside the content column", () => {
  const plan = composeAddressSideFace({
    size: "5x8",
    pairing: "trade",
    palette: paletteById("general"),
    spec: {
      offer: "Free inspection for broken AC units",
      phone: "(512) 555-0148",
      website: "northwind.example",
      qrDestination: "https://northwind.example/book",
      addressSide: mergeAddressSide(undefined, {
        sections: {
          offer: true,
          benefits: true,
          proof: true,
          license: true,
          contact: true,
          returnAddress: true,
          qr: true,
          photo: true,
        },
        benefits: "Same-week visit\nWritten price before work",
        proof: "Licensed and local",
        license: "TACLB 12345",
        returnAddress: "100 Market St\nAustin, TX 78701",
      }),
    },
    businessName: "Northwind Heating & Air",
    disclaimer: "A licensed contractor will confirm the work before it starts.",
    complianceMark: "Advertisement",
  })
  assert.equal(artMissesKeepOuts(addressSideArtRects(plan)), true)
  assert.match(plan.texts.map((line) => line.text).join(" "), /Same-week visit/)
  assert.match(plan.texts.map((line) => line.text).join(" "), /Advertisement/)
})

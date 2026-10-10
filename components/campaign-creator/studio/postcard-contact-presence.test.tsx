import assert from "node:assert/strict"
import { test } from "node:test"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"

import { toCreativeCanvas } from "@/lib/campaign-creator/creative-canvas"
import { postcardPrintLines } from "@/lib/print-spec/render-campaign-postcard-pdf"
import type { PostcardIdentity } from "@/lib/campaign-creator/studio-contact"
import type { Campaign, CreativeDirection, CreativeSpec } from "@/lib/campaign-creator/types"
import { createEmptyCampaignCreative } from "@/lib/campaign-creator/types"
import { POSTCARD_5X8_V1 } from "@/lib/mail-catalog/pieces/postcard-5x8"

import { ApprovalModal } from "./ApprovalModal"
import { CompareView } from "./CompareView"
import { FocusView } from "./FocusView"
import { PostcardPreview } from "./PostcardPreview"
import { RefinementView } from "./RefinementView"

const PHONE = "222-333-4456"
const WEBSITE = "www.abcroofers.com"

const canvas = toCreativeCanvas(POSTCARD_5X8_V1)

const identity: PostcardIdentity = {
  businessName: "ABC Roofing Company",
  phone: PHONE,
  website: WEBSITE,
  qrDestination: "https://www.abcroofers.com/book",
}

function card(id: string, name: string, headline: string, recommended = false): CreativeDirection {
  const spec: CreativeSpec = {
    layoutVariant: "image_grounded",
    headline,
    subheadline: "Get a free roof inspection and catch problems before they show up inside your home.",
    body: "Get a free roof inspection and catch problems before they show up inside your home.",
    offer: "Free roof inspection if they book an appointment",
    callToAction: "Call or scan to schedule",
    visualDirection: "A homeowner looking at a ceiling stain.",
    tone: "Direct",
    palette: ["#1b2a4a", "#d7dde6", "#c45c26"],
    imagery: "stock_generic_local",
    leadJob: "problem",
    imageryRole: "consequence",
  }
  return {
    id,
    name,
    rationale: "Leads with the quiet leak so the inspection feels urgent.",
    oneLineDifference: recommended ? undefined : "A different way into the same inspection.",
    designedToDrive: "Inspection bookings",
    tags: ["problem-led", "local", "inspection"],
    spec,
    recommended,
    createdAt: "2026-10-10T20:00:00.000Z",
  }
}

const directions = [
  card("quiet", "Catch It Early", "Small Leaks Start Quiet", true),
  card("offer", "Free Inspection Offer", "Your Free Roof Inspection"),
  card("craft", "Proven Local Craftsmanship", "Roofing Done Right"),
]

function assertContact(html: string, view: string) {
  assert.match(html, new RegExp(`data-contact-phone="${PHONE}"`), view)
  assert.match(html, new RegExp(`data-contact-website="${WEBSITE}"`), view)
}

test("compare, focus, refine, and approve paint the form phone and website", () => {
  const lead = directions[0]
  const campaign: Campaign = {
    id: "roofing",
    ownerId: "owner@example.com",
    status: "creative_ready",
    brief: {
      phone: PHONE,
      website: WEBSITE,
      qrDestination: identity.qrDestination,
      businessInfo: { name: "ABC Roofing Company", phone: PHONE, website: WEBSITE },
    },
    creative: {
      ...createEmptyCampaignCreative(),
      directions,
      selectedDirectionId: lead.id,
      activeSpec: lead.spec,
      revisions: [
        {
          id: "rev-1",
          directionId: lead.id,
          version: 1,
          spec: lead.spec,
          customerPrompt: "Original concept",
          studioResponse: "",
          type: "refinement",
          createdAt: "2026-10-10T20:00:00.000Z",
        },
      ],
    },
    transcript: [],
    readyForBriefReview: true,
    createdAt: "2026-10-10T19:00:00.000Z",
    updatedAt: "2026-10-10T20:00:00.000Z",
  }

  const compare = renderToStaticMarkup(
    createElement(CompareView, {
      canvas,
      directions,
      recommendedId: lead.id,
      identity,
      onSelect: () => undefined,
      onBack: () => undefined,
    })
  )
  assertContact(compare, "compare")
  assert.equal((compare.match(/data-contact-phone=/g) ?? []).length, 3)

  const focus = renderToStaticMarkup(
    createElement(FocusView, {
      canvas,
      direction: lead,
      spec: lead.spec,
      otherDirections: directions.slice(1),
      identity,
      onCompare: () => undefined,
      onSwitch: () => undefined,
      onStartRefining: () => undefined,
      onApproveAsIs: () => undefined,
    })
  )
  assertContact(focus, "focus")
  assert.match(focus, /Scan to book/)
  assert.doesNotMatch(focus, /Scan to call/)
  assert.match(focus, /data-offer-weight="700"/)
  assert.match(focus, /if you book/)
  assert.doesNotMatch(focus, /if they book/)
  assert.doesNotMatch(focus, /too close to the body size/)

  const refine = renderToStaticMarkup(
    createElement(RefinementView, {
      canvas,
      campaign,
      direction: lead,
      activeSpec: lead.spec,
      identity,
      onCompare: () => undefined,
      onApprove: () => undefined,
      onApplyRefinement: async () => ({}),
      onRestoreRevision: async () => ({}),
    })
  )
  assertContact(refine, "refine")

  const approve = renderToStaticMarkup(
    createElement(ApprovalModal, {
      open: true,
      canvas,
      spec: lead.spec,
      brief: campaign.brief,
      directionName: lead.name,
      identity,
      onApprove: () => undefined,
      onKeepRefining: () => undefined,
    })
  )
  assertContact(approve, "approve")

  for (const size of ["thumbnail", "hero", "medium"] as const) {
    const html = renderToStaticMarkup(
      createElement(PostcardPreview, {
        canvas,
        spec: lead.spec,
        size,
        identity,
        enableHoverTilt: false,
      })
    )
    assertContact(html, size)
  }
})

test("the print file keeps the form phone and website", () => {
  const lines = postcardPrintLines({
    businessName: "ABC Roofing Company",
    headline: "Small Leaks Start Quiet",
    body: "Get a free roof inspection and catch problems before they show up inside your home.",
    offer: "Free roof inspection if they book an appointment",
    callToAction: "Call or scan to schedule",
    phone: PHONE,
    website: WEBSITE,
    qrPayload: "https://www.abcroofers.com/book",
  })
  assert.ok(lines.includes(PHONE))
  assert.ok(lines.includes(WEBSITE))
  assert.ok(lines.some((line) => line.includes("if you book")))
  assert.equal(lines.some((line) => /\bthey book\b/.test(line)), false)
})

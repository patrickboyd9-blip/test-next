import assert from "node:assert/strict"
import { test } from "node:test"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"

import { audienceFromMessage } from "@/lib/audience/interpret"
import type { Campaign, CampaignBrief } from "@/lib/campaign-creator/types"
import { createEmptyCampaignCreative } from "@/lib/campaign-creator/types"

import { AudienceCard } from "./AudienceCard"
import { CampaignCreatorView } from "./CampaignCreatorView"
import { ResponseEstimate } from "./ResponseEstimate"

const brief: CampaignBrief = {
  goal: "Book roof inspections",
  offer: "A spring checkup",
  primarySuccessMetric: { type: "phone_call", description: "Calls" },
  audience: {
    description: "Homeowners, within 5 miles of 92025",
    quantity: 2_000,
    quantityKind: "requested",
    listType: "prospect",
    geography: { kind: "radius", label: "Within 5 miles of 92025", postalCode: "92025", radiusMiles: 5 },
    filters: [{ id: "homeowner", field: "homeowner", label: "Homeowners", operator: "is", value: "yes" }],
    provider: {
      id: "melissa",
      status: "coming_soon",
      message: "Data partner coming soon. This audience is saved.",
      count: "unavailable",
    },
  },
}

test("the review estimate is a range with a disclaimer", () => {
  const html = renderToStaticMarkup(createElement(ResponseEstimate, { brief }))
  assert.match(html, /Estimate/)
  assert.match(html, /Expect roughly 4–12 calls from 2,000 cards/)
  assert.match(html, /not a counted list/)
  assert.match(html, /not a guarantee/)
  assert.match(html, /Results vary/)
  assert.doesNotMatch(html, /will get|promised|\$/)
})

test("the audience card keeps the spec editable and does not invent a count", () => {
  const html = renderToStaticMarkup(
    createElement(AudienceCard, {
      audience: brief.audience!,
      editable: true,
      onChange() {},
    })
  )
  assert.match(html, /Homeowners/)
  assert.match(html, /92025/)
  assert.match(html, /Data partner coming soon/)
  assert.match(html, /not a counted list/)
  assert.match(html, /Prospect list/)
  assert.doesNotMatch(html, /households in this radius|guaranteed/i)
})

test("the campaign chat shows the audience card from the same conversation", () => {
  const turn = audienceFromMessage(
    { goal: "Book roof inspections" },
    "homeowners within 5 miles of 92025, homes 15+ years old, income over $75k, send 2,000 cards"
  )
  assert.ok(turn)
  const campaign: Campaign = {
    id: "camp-audience",
    ownerId: "owner@example.com",
    status: "draft",
    entry: "ai",
    brief: { goal: "Book roof inspections", offer: "A spring checkup", audience: turn.audience, primarySuccessMetric: { type: "phone_call" } },
    creative: createEmptyCampaignCreative(),
    transcript: [
      {
        id: "customer-1",
        role: "customer",
        content: "homeowners within 5 miles of 92025, homes 15+ years old, income over $75k, send 2,000 cards",
        createdAt: "2026-10-22T00:00:00.000Z",
      },
      {
        id: "assistant-1",
        role: "assistant",
        content: turn.assistantNote,
        createdAt: "2026-10-22T00:00:01.000Z",
        audienceCard: turn.audience,
      },
    ],
    readyForBriefReview: false,
    createdAt: "2026-10-22T00:00:00.000Z",
    updatedAt: "2026-10-22T00:00:01.000Z",
  }
  const html = renderToStaticMarkup(
    createElement(CampaignCreatorView, {
      initialCampaign: campaign,
      printMailMode: {
        environment: "stage",
        productionEnabled: false,
        credentialsConfigured: false,
        postage: { standardFirstClassDollars: 0.56, nonstandardFirstClassDollars: 0.73 },
      },
    })
  )
  assert.match(html, /data-testid="audience-card"/)
  assert.match(html, /Homes 15\+ years old/)
  assert.match(html, /Income over/)
  assert.match(html, /Expect roughly 4–12 calls from 2,000 cards/)
  assert.match(html, /Data partner coming soon/)
})

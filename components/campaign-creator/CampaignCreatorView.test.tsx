import assert from "node:assert/strict"
import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { test } from "node:test"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"

import type { PrintMailMode } from "@/lib/click2mail/mode"
import { createCampaignRepository } from "@/lib/campaign-creator/repository"
import { createEmptyCampaignCreative, type Campaign } from "@/lib/campaign-creator/types"
import { createFileDocumentStore } from "@/lib/storage/document-store"

import { CampaignCreatorView } from "./CampaignCreatorView"
import { CampaignOpening } from "./CampaignOpening"

const CHOOSER = /How should this postcard be designed\?/
const now = "2026-10-14T00:00:00.000Z"

const printMailMode: PrintMailMode = {
  environment: "stage",
  productionEnabled: false,
  credentialsConfigured: false,
  postage: { standardFirstClassDollars: 0.56, nonstandardFirstClassDollars: 0.73 },
}

test("AI strategy confirmation opens direction generation and skips the design chooser", async () => {
  const campaign = await confirmedAiCampaign()
  const html = render(campaign)

  assert.equal(campaign.entry, "ai")
  assert.equal(campaign.designSource, "studio")
  assert.match(html, /Understanding your goal: Book more HVAC appointments/)
  assert.match(html, /View conversation \(1 messages\)/)
  assert.doesNotMatch(html, CHOOSER)
  assert.doesNotMatch(html, /Design it here/)
  assert.doesNotMatch(html, /I already have a design/)
})

test("a campaign with no stored path opens direction generation instead of the chooser", () => {
  const html = render(legacyCampaign())

  assert.match(html, /Understanding your goal: Book more HVAC appointments/)
  assert.match(html, /View conversation \(16 messages\)/)
  assert.doesNotMatch(html, CHOOSER)
  assert.doesNotMatch(html, />Design it here</)
  assert.doesNotMatch(html, />I already have a design</)
})

test("the upload path stays on the proof", async () => {
  const campaign = await uploadCampaign()
  const html = render(campaign)

  assert.equal(campaign.entry, "upload")
  assert.match(html, /PDF, PNG, or JPG/)
  assert.match(html, /Describe what you want instead/)
  assert.doesNotMatch(html, CHOOSER)
  assert.doesNotMatch(html, /Understanding your goal/)
})

test("the template path stays in Studio on that mailer", async () => {
  const campaign = await templateCampaign()
  const html = render(campaign)
  const copy = decode(html)

  assert.equal(campaign.entry, "template")
  assert.match(html, /Refining:/)
  assert.ok(copy.includes("This stays a 5×8 postcard"))
  assert.doesNotMatch(html, CHOOSER)
  assert.doesNotMatch(html, /Understanding your goal/)
})

test("the team-design path opens the request and not the design chooser", () => {
  const html = renderToStaticMarkup(
    createElement(CampaignOpening, {
      initialStep: "team",
      composerValue: "",
      onComposerChange() {},
      onSend() {},
      onSelectExample() {},
      async onSubmitUpload() {},
      async onSelectTemplate() {},
    })
  )
  const copy = decode(html)

  assert.match(html, /Have our team design it/)
  assert.ok(copy.includes("Company name"))
  assert.ok(copy.includes("Send to the design team"))
  assert.doesNotMatch(html, CHOOSER)
  assert.doesNotMatch(html, /Understanding your goal/)
})

function render(campaign: Campaign): string {
  return renderToStaticMarkup(
    createElement(CampaignCreatorView, {
      initialCampaign: campaign,
      printMailMode,
    })
  )
}

async function confirmedAiCampaign(): Promise<Campaign> {
  const directory = await mkdtemp(path.join(tmpdir(), "mm-ai-path-"))
  try {
    const repository = createCampaignRepository(createFileDocumentStore(directory))
    const created = await repository.createCampaign("owner@example.com")
    await repository.appendMessage(created.id, {
      id: "msg-1",
      role: "customer",
      content: "I want more appointments from homeowners nearby.",
      createdAt: now,
    })
    await repository.updateBrief(created.id, { goal: "Book more HVAC appointments" })
    return await repository.confirmStrategy(created.id)
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
}

function legacyCampaign(): Campaign {
  const transcript = Array.from({ length: 16 }, (_, index) => ({
    id: `msg-${index}`,
    role: index % 2 === 0 ? ("customer" as const) : ("assistant" as const),
    content: "A note from the strategy conversation.",
    createdAt: now,
  }))
  return {
    id: "legacy-camp",
    ownerId: "owner@example.com",
    status: "strategy_confirmed",
    brief: { goal: "Book more HVAC appointments" },
    creative: createEmptyCampaignCreative(),
    transcript,
    mailPieceSpec: {
      recommendedCatalogId: "postcard_5x8",
      recommendedCatalogVersion: 1,
      selectedCatalogId: "postcard_5x8",
      selectedCatalogVersion: 1,
      customerOverride: false,
      decidedAt: now,
      decidedBy: "owner@example.com",
      addressFaceAuthorship: "fulfillment",
    },
    readyForBriefReview: true,
    createdAt: now,
    updatedAt: now,
  }
}

async function uploadCampaign(): Promise<Campaign> {
  const directory = await mkdtemp(path.join(tmpdir(), "mm-upload-view-"))
  try {
    const repository = createCampaignRepository(createFileDocumentStore(directory))
    const created = await repository.createCampaign("owner@example.com")
    return await repository.beginUploadPath(created.id, {
      campaignName: "Spring postcard",
      businessName: "Northwind HVAC",
      street: "100 Main St",
      city: "Austin",
      state: "TX",
      postalCode: "78701",
    })
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
}

async function templateCampaign(): Promise<Campaign> {
  const directory = await mkdtemp(path.join(tmpdir(), "mm-template-view-"))
  try {
    const repository = createCampaignRepository(createFileDocumentStore(directory))
    const created = await repository.createCampaign("owner@example.com")
    return await repository.beginTemplatePath(created.id, "roofing-free-inspection")
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
}

function decode(html: string): string {
  return html
    .replace(/&#x27;|&apos;/g, "'")
    .replace(/&#xD7;|&times;/g, "×")
}

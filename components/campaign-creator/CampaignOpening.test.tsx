import assert from "node:assert/strict"
import { test } from "node:test"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"

import { CampaignOpening, type OpeningStep } from "./CampaignOpening"

const AI_SUBTITLE =
  "Tell us your goal and our AI designs a ready-to-mail postcard in minutes."
const UPLOAD_SUBTITLE =
  "Upload your own front and back. We'll check it for print and show you a proof."
const TEMPLATE_SUBTITLE =
  "Browse proven mailers for your industry, then let AI tailor one to your business."
const TEAM_SUBTITLE =
  "Share your logo, offer, and style. Our designers build a custom postcard for you."

test("the first screen is four equal choices and hides the prompt", () => {
  const html = render("choose")
  const copy = decode(html)

  assert.ok(copy.includes("Design it with AI"))
  assert.ok(copy.includes(AI_SUBTITLE))
  assert.ok(copy.includes("I already have a design"))
  assert.ok(copy.includes(UPLOAD_SUBTITLE))
  assert.ok(copy.includes("Start from a template"))
  assert.ok(copy.includes(TEMPLATE_SUBTITLE))
  assert.ok(copy.includes("Have our team design it"))
  assert.ok(copy.includes(TEAM_SUBTITLE))

  const cards = [...html.matchAll(/<button[^>]*data-slot="start-choice"[^>]*>/g)].map(
    (match) => match[0]
  )
  assert.equal(cards.length, 4)
  for (const card of cards) {
    assert.match(card, /type="button"/)
    assert.doesNotMatch(card, /\bh-full\b/)
    assert.match(card, /flex-1/)
    assert.match(card, /min-h-52/)
    assert.match(card, /w-full/)
    assert.match(card, /p-5/)
    assert.match(card, /focus-visible:border-foreground/)
    assert.match(card, /focus-visible:ring-3/)
    assert.match(card, /focus-visible:ring-foreground\/40/)
  }
  assert.match(html, /data-choice="ai"/)
  assert.match(html, /data-choice="upload"/)
  assert.match(html, /data-choice="template"/)
  assert.match(html, /data-choice="team"/)
  assert.match(html, /grid-cols-1/)
  assert.match(html, /sm:grid-cols-2/)
  assert.match(html, /items-stretch/)

  assert.equal(html.indexOf("Design it with AI") < html.indexOf("I already have a design"), true)
  assert.equal(html.indexOf("I already have a design") < html.indexOf("Start from a template"), true)
  assert.equal(html.indexOf("Start from a template") < html.indexOf("Have our team design it"), true)
  assert.doesNotMatch(html, /What would you like to accomplish\?/)
  assert.doesNotMatch(html, /I want to get more appointments from homeowners nearby\./)
  assert.doesNotMatch(html, /<textarea/)
  assert.doesNotMatch(html, /A name and a return address/)
})

test("choosing Design it with AI shows the prompt, examples, and chat input", () => {
  const html = render("ai")

  assert.match(html, /What would you like to accomplish\?/)
  assert.match(html, /I want to get more appointments from homeowners nearby\./)
  assert.match(html, /I want to send 1,000 postcards to this neighborhood\./)
  assert.match(html, /grand opening/)
  assert.match(html, /birthday cards/)
  assert.match(html, /<textarea/)
  assert.match(html, /Tell Modern Mail what you want to accomplish/)
  assert.match(html, />Back</)
  assert.doesNotMatch(html, /Design it with AI/)
  assert.doesNotMatch(html, /I already have a design/)
  assert.doesNotMatch(html, /data-slot="start-choice"/)
  assert.doesNotMatch(html, /A name and a return address/)
})

test("choosing I already have a design opens the upload flow, with a way back", () => {
  const html = render("upload")

  assert.match(html, /A name and a return address/)
  assert.match(html, /Campaign name/)
  assert.match(html, /Continue to upload/)
  assert.match(html, />Back</)
  assert.doesNotMatch(html, /What would you like to accomplish\?/)
  assert.doesNotMatch(html, /Design it with AI/)
  assert.doesNotMatch(html, /data-slot="start-choice"/)
  assert.doesNotMatch(html, /<textarea/)
  assert.doesNotMatch(html, /I want to get more appointments from homeowners nearby\./)
})

test("choosing Start from a template opens the industry gallery", () => {
  const html = render("template")
  const copy = decode(html)

  assert.match(html, /Start from a template/)
  assert.match(html, /Filter by industry/)
  assert.ok(copy.includes("Roofing"))
  assert.ok(copy.includes("HVAC"))
  assert.ok(copy.includes("Auto insurance"))
  assert.ok(copy.includes("Real estate"))
  assert.match(html, /data-template-id="roofing-free-inspection"/)
  assert.match(html, /data-industry="landscaping"/)
  assert.match(html, />Back</)
  assert.doesNotMatch(html, /data-slot="start-choice"/)
  assert.doesNotMatch(html, /What would you like to accomplish\?/)
})

test("choosing Have our team design it opens the request form", () => {
  const html = render("team")
  const copy = decode(html)

  assert.match(html, /Have our team design it/)
  assert.ok(copy.includes("Company name"))
  assert.ok(copy.includes("Address"))
  assert.ok(copy.includes("Desired vibe or style"))
  assert.ok(copy.includes("The specific offer"))
  assert.ok(copy.includes("QR code"))
  assert.ok(copy.includes("Phone call"))
  assert.ok(copy.includes("Website"))
  assert.ok(copy.includes("Other"))
  assert.match(html, /name="logo"/)
  assert.match(html, /name="images"/)
  assert.match(html, /Send to the design team/)
  assert.match(html, />Back</)
  assert.doesNotMatch(html, /data-slot="start-choice"/)
  assert.doesNotMatch(html, /<textarea[^>]*Tell Modern Mail/)
})

function render(initialStep: OpeningStep): string {
  return renderToStaticMarkup(
    createElement(CampaignOpening, {
      initialStep,
      composerValue: "",
      onComposerChange() {},
      onSend() {},
      onSelectExample() {},
      async onSubmitUpload() {},
      async onSelectTemplate() {},
    })
  )
}

function decode(html: string): string {
  return html.replace(/&#x27;|&apos;/g, "'")
}

import assert from "node:assert/strict"
import { test } from "node:test"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"

import { CampaignOpening, type OpeningStep } from "./CampaignOpening"

const AI_SUBTITLE =
  "Tell us your goal and our AI designs a ready-to-mail postcard in minutes."
const UPLOAD_SUBTITLE =
  "Upload your own front and back. We'll check it for print and show you a proof."

test("the first screen is two equal choices and hides the prompt", () => {
  const html = render("choose")
  const copy = decode(html)

  assert.ok(copy.includes("Design it with AI"))
  assert.ok(copy.includes(AI_SUBTITLE))
  assert.ok(copy.includes("I already have a design"))
  assert.ok(copy.includes(UPLOAD_SUBTITLE))

  const cards = [...html.matchAll(/<button[^>]*data-slot="start-choice"[^>]*>/g)].map(
    (match) => match[0]
  )
  assert.equal(cards.length, 2)
  for (const card of cards) {
    assert.match(card, /type="button"/)
    assert.match(card, /h-full/)
    assert.match(card, /min-h-52/)
    assert.match(card, /w-full/)
    assert.match(card, /p-5/)
    assert.match(card, /focus-visible:ring-3/)
    assert.match(card, /focus-visible:ring-ring\/50/)
  }
  assert.match(html, /data-choice="ai"/)
  assert.match(html, /data-choice="upload"/)
  assert.match(html, /grid-cols-1/)
  assert.match(html, /sm:grid-cols-2/)
  assert.match(html, /items-stretch/)

  assert.equal(html.indexOf("Design it with AI") < html.indexOf("I already have a design"), true)
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

function render(initialStep: OpeningStep): string {
  return renderToStaticMarkup(
    createElement(CampaignOpening, {
      initialStep,
      composerValue: "",
      onComposerChange() {},
      onSend() {},
      onSelectExample() {},
      async onSubmitUpload() {},
    })
  )
}

function decode(html: string): string {
  return html.replace(/&#x27;|&apos;/g, "'")
}

import assert from "node:assert/strict"
import { test } from "node:test"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"

import { OpeningPrompt } from "./OpeningPrompt"

test("the AI prompt shows the heading, examples, and a way back", () => {
  const html = renderToStaticMarkup(
    createElement(OpeningPrompt, {
      onSelectExample() {},
      onBack() {},
    })
  )
  const back = html.indexOf(">Back<")
  const heading = html.indexOf("What would you like to accomplish?")
  const chip = html.indexOf("I want to get more appointments from homeowners nearby.")
  assert.ok(back >= 0)
  assert.ok(heading > back)
  assert.ok(chip > heading)
  assert.match(html, /I want to send 1,000 postcards to this neighborhood\./)
  assert.match(html, /We&#x27;re opening a restaurant and want to promote our grand opening\./)
  assert.match(html, /I want to send birthday cards to our employees\./)
  assert.doesNotMatch(html, /Design it with AI/)
  assert.doesNotMatch(html, /I already have a design/)
})

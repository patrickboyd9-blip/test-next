import assert from "node:assert/strict"
import { test } from "node:test"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"

import { OpeningPrompt } from "./OpeningPrompt"

test("I already have a design sits under the heading and above the suggestion chips", () => {
  const html = renderToStaticMarkup(
    createElement(OpeningPrompt, {
      onSelectExample() {},
      onHaveDesign() {},
    })
  )
  const heading = html.indexOf("What would you like to accomplish?")
  const option = html.indexOf("I already have a design")
  const chip = html.indexOf("I want to get more appointments from homeowners nearby.")
  assert.ok(heading >= 0)
  assert.ok(option > heading)
  assert.ok(chip > option)
})

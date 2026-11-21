import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { test } from "node:test"

import { PLUGIN_GUIDES, pluginSteps } from "./guide"

test("each plugin guide uses the real buttons and stays coming soon", () => {
  assert.deepEqual(
    PLUGIN_GUIDES.map((guide) => guide.label),
    ["Figma", "Canva", "Adobe Express", "Photoshop and InDesign"]
  )
  for (const guide of PLUGIN_GUIDES) {
    const steps = pluginSteps(guide).join(" ")
    assert.match(steps, /Settings, then API & AI assistants/)
    assert.match(steps, /Paste the token once/)
    assert.match(steps, /Create front and back/)
    assert.match(steps, /Load my campaigns/)
    assert.match(steps, /Check and send/)
    assert.match(steps, /Nothing is mailed until you approve/)
    assert.match(steps, /coming soon/)
    assert.doesNotMatch(steps, /https?:\/\//)
  }
  const prints = readFileSync("app/app/print-templates/page.tsx", "utf8")
  const help = readFileSync("app/app/help/page.tsx", "utf8")
  assert.match(prints, /href="\/app\/help\/plugins"/)
  assert.match(help, /href="\/app\/help\/plugins"/)
  assert.doesNotMatch(prints, /canva\.com|adobe\.com|figma\.com/i)
})

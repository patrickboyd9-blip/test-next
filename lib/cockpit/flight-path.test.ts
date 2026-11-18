import assert from "node:assert/strict"
import { test } from "node:test"

import { readFileSync } from "node:fs"

import { FLIGHT_MS, GLIDE_AFTER_FLIGHT_MS, IDLE_MS, flightAllowed, flightPath, glideOccupies, glideResumesAt, pathTangentsMeet, slotPoint } from "./flight-path"

test("the flight is skipped on a phone and when motion is reduced", () => {
  assert.equal(flightAllowed(1440, false), true)
  assert.equal(flightAllowed(1024, false), true)
  assert.equal(flightAllowed(1023, false), false)
  assert.equal(flightAllowed(390, false), false)
  assert.equal(flightAllowed(1440, true), false)
})

test("the path starts at the lower left, crests, dips, and ends in the slot", () => {
  const slot = slotPoint({ left: 1164, top: 239, width: 188, height: 181 })
  const path = flightPath({
    start: { x: -36, y: 860 },
    rise: { x: 280, y: 160 },
    crest: { x: 620, y: 48 },
    dip: { x: 860, y: slot.y + 42 },
    slot,
  })
  assert.match(path, /^M -36\.0 860\.0 C/)
  assert.match(path, new RegExp(`${slot.x.toFixed(1)} ${slot.y.toFixed(1)}$`))
  assert.equal(path.split(" C ").length, 5)
  assert.ok(slot.y < 860)
  assert.equal(pathTangentsMeet(path), true)
})

test("a flight waits while the existing glide is in the slot", () => {
  assert.equal(glideOccupies(0.2), false)
  assert.equal(glideOccupies(0.7), true)
  assert.equal(glideOccupies(0.93), true)
  assert.equal(glideOccupies(0.95), false)
  assert.equal(FLIGHT_MS >= 8000 && FLIGHT_MS <= 10000, true)
  assert.equal(IDLE_MS, 300_000)
})

test("the faint slip waits 30s after a flight and then keeps its 18s cycle", () => {
  assert.equal(GLIDE_AFTER_FLIGHT_MS, 30_000)
  assert.equal(glideResumesAt(FLIGHT_MS), FLIGHT_MS + 30_000)
  const css = readFileSync(new URL("../../app/globals.css", import.meta.url), "utf8")
  const mailer = css.slice(css.indexOf(".mm-mailer {"), css.indexOf(".mm-postbox-arrive .mm-mailer"))
  assert.match(mailer, /animation: mm-slip 18s/)
  assert.match(css, /@keyframes mm-slip \{/)
  assert.match(css, /\.mm-postbox\.mm-glide-hold \.mm-mailer \{[^}]*animation-play-state:\s*paused/)
  assert.match(css, /\.mm-postbox\.mm-glide-hold \.mm-mailer \{[^}]*opacity:\s*0 !important/)
  assert.match(css, /\.mm-postbox\.mm-glide-hold\.mm-flight-arrive::after \{[^}]*opacity:\s*0 !important/)
  const flight = readFileSync(new URL("../../components/cockpit/MailFlight.tsx", import.meta.url), "utf8")
  assert.match(flight, /releaseGlide\(\)/)
  assert.doesNotMatch(flight, /classList\.add\("mm-flight-arrive"\)[\s\S]{0,80}releaseGlide/)
  assert.match(flight, /GLIDE_AFTER_FLIGHT_MS/)
  assert.match(flight, /mm-glide-hold/)
})

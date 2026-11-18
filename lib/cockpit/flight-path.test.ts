import assert from "node:assert/strict"
import { test } from "node:test"

import { readFileSync } from "node:fs"

import { DOOR_OPEN_MS, DOOR_SHUT_MS, ENTER_MS, FLIGHT_MS, IDLE_MS, flightAllowed, flightPath, glideOccupies, pathTangentsMeet, slotPoint } from "./flight-path"

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
  assert.equal(ENTER_MS >= 400 && ENTER_MS <= 600, true)
  assert.equal(DOOR_SHUT_MS >= 300 && DOOR_SHUT_MS <= 400, true)
  assert.equal(DOOR_OPEN_MS >= 260 && DOOR_OPEN_MS <= 340, true)
})

test("the long flight enters the box, and the slot glide is untouched", () => {
  const css = readFileSync(new URL("../../app/globals.css", import.meta.url), "utf8")
  const mailer = css.slice(css.indexOf(".mm-mailer {"), css.indexOf(".mm-postbox-arrive .mm-mailer"))
  assert.match(mailer, /animation: mm-slip 18s/)
  assert.match(css, /@keyframes mm-slip \{/)
  assert.match(css, /@keyframes mm-slip-once \{/)
  assert.doesNotMatch(css, /mm-flight-arrive/)
  assert.match(css, /mm-door-close 380ms/)
  assert.match(css, /mm-door-open 300ms/)
  assert.match(css, /mm-into-box 480ms/)
})

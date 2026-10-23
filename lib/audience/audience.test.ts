import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { test } from "node:test"

import type { CampaignBrief } from "@/lib/campaign-creator/types"

import { acceptAudienceEdit, audienceFromMessage } from "./interpret"
import { everyDoorRouteHandoff, getAudienceProvider } from "./providers"

const roofing: CampaignBrief = {
  goal: "Book more roof inspections",
  offer: "A spring checkup",
}

test("a plain sentence becomes geography, filters, a prospect list, and no invented count", () => {
  const turn = audienceFromMessage(
    roofing,
    "homeowners within 5 miles of 92025, homes 15+ years old, income over $75k"
  )

  assert.ok(turn)
  assert.equal(turn.showCard, true)
  assert.equal(turn.blocked.length, 0)
  assert.equal(turn.audience.listType, "prospect")
  assert.equal(turn.audience.provider?.id, "melissa")
  assert.equal(turn.audience.provider?.status, "coming_soon")
  assert.match(turn.audience.provider?.message ?? "", /data partner coming soon/i)
  assert.equal(turn.audience.provider?.count, "unavailable")
  assert.equal(turn.audience.quantity, undefined)
  assert.equal(turn.audience.quantityKind, "unavailable")
  assert.equal(turn.audience.geography?.kind, "radius")
  assert.equal(turn.audience.geography?.postalCode, "92025")
  assert.equal(turn.audience.geography?.radiusMiles, 5)
  assert.deepEqual(
    turn.audience.filters?.map((filter) => filter.id),
    ["homeowner", "home_age_years", "household_income"]
  )
  assert.equal(turn.audience.filters?.find((filter) => filter.id === "household_income")?.value, 75_000)
  assert.match(turn.audience.description, /Homeowners/)
  assert.match(turn.audience.description, /92025/)
  assert.match(turn.audience.description, /15\+ years/)
  assert.match(turn.audience.description, /\$75,000/)
})

test("a stated piece count is a request, and a later sentence keeps the filters", () => {
  const first = audienceFromMessage(
    roofing,
    "homeowners within 5 miles of 92025, homes 15+ years old, income over $75k"
  )
  assert.ok(first)
  const second = audienceFromMessage(
    { ...roofing, audience: first.audience },
    "Please send 2,000 cards"
  )
  assert.ok(second)
  assert.equal(second.audience.quantity, 2_000)
  assert.equal(second.audience.quantityKind, "requested")
  assert.equal(second.audience.filters?.length, 3)
  assert.equal(second.audience.provider?.count, "unavailable")
})

test("Every Door names the route hook and does not invent a household count", () => {
  const turn = audienceFromMessage(roofing, "Every Door in 92025")
  assert.ok(turn)
  assert.equal(turn.audience.listType, "every_door")
  assert.equal(turn.audience.provider?.id, "every_door")
  assert.equal(turn.audience.provider?.status, "route_to_eddm")
  assert.equal(turn.audience.provider?.hook, "eddm.routeMap")
  assert.equal(turn.audience.provider?.count, "unavailable")
  assert.equal(turn.audience.quantity, undefined)
  const handoff = everyDoorRouteHandoff(turn.audience)
  assert.equal(handoff.hook, "eddm.routeMap")
  assert.equal(handoff.quantityRequested, undefined)
  assert.match(handoff.geographyLabel ?? "", /92025/)
})

test("upload my list uses the upload provider and still has no count", () => {
  const turn = audienceFromMessage(roofing, "Upload my customer list")
  assert.ok(turn)
  assert.equal(turn.audience.listType, "house")
  assert.equal(turn.audience.provider?.id, "upload")
  assert.equal(turn.audience.provider?.status, "needs_upload")
  assert.equal(turn.audience.provider?.count, "unavailable")
  assert.match(turn.audience.provider?.message ?? "", /won't guess/i)
})

test("a file count is the only count the upload provider will return", () => {
  const result = getAudienceProvider("upload").resolve({ uploadedRowCount: 37 })
  assert.equal(result.status, "file_counted")
  assert.deepEqual(result.count, { kind: "from_upload", value: 37 })
  assert.equal(result.specSaved, true)
  const empty = getAudienceProvider("upload").resolve({})
  assert.equal(empty.count, "unavailable")
})

test("Melissa saves the spec and does not call out for data", () => {
  const turn = audienceFromMessage(roofing, "homeowners in 92025")
  assert.ok(turn)
  const result = getAudienceProvider("melissa").resolve({})
  assert.equal(result.status, "coming_soon")
  assert.equal(result.count, "unavailable")
  assert.equal(result.specSaved, true)
  assert.match(result.message, /data partner coming soon/i)
  const source = readFileSync(new URL("./providers.ts", import.meta.url), "utf8")
  assert.doesNotMatch(source, /fetch\(|axios|api\.melissa|MELISSA_API/i)
})

test("housing mail cannot target a protected class, and the lawful part remains", () => {
  const cases: Array<{ text: string; blocked: string }> = [
    { text: "white homeowners in 92025", blocked: "race" },
    { text: "catholic homeowners in 92025", blocked: "religion" },
    { text: "mexican homeowners in 92025", blocked: "national_origin" },
    { text: "homeowners with children in 92025", blocked: "familial_status" },
    { text: "disabled homeowners in 92025", blocked: "disability" },
    { text: "female homeowners in 92025", blocked: "sex" },
  ]
  for (const sample of cases) {
    const turn = audienceFromMessage(roofing, sample.text)
    assert.ok(turn, sample.text)
    assert.ok(turn.blocked.includes(sample.blocked as never), sample.text)
    assert.match(turn.assistantNote, /can't aim housing mail/i)
    assert.equal(turn.audience.filters?.some((filter) => filter.id === "homeowner"), true)
    assert.equal(turn.audience.geography?.postalCode, "92025")
    assert.doesNotMatch(turn.audience.description, /white|catholic|mexican|children|disabled|female/i)
  }
})

test("families are allowed when the mail is not about housing", () => {
  const turn = audienceFromMessage(
    { goal: "Fill the dining room", offer: "A free dessert" },
    "families with children near the new restaurant"
  )
  assert.ok(turn)
  assert.equal(turn.blocked.length, 0)
  assert.equal(turn.audience.fairHousingNote, undefined)
  assert.equal(
    turn.audience.filters?.some((filter) => filter.id === "families_with_children"),
    true
  )
})

test("ordinary housing words are not treated as a protected class", () => {
  const turn = audienceFromMessage(
    roofing,
    "women-owned roofing company mailing homeowners with black roof stains in 92025"
  )
  assert.ok(turn)
  assert.equal(turn.blocked.length, 0)
  assert.equal(turn.audience.filters?.some((filter) => filter.id === "homeowner"), true)
})

test("a design note is not turned into an audience", () => {
  assert.equal(audienceFromMessage(roofing, "Make the headline bigger"), null)
})

test("an edited card drops a protected phrase and recomputes the provider", () => {
  const first = audienceFromMessage(roofing, "homeowners in 92025")
  assert.ok(first)
  const edited = acceptAudienceEdit(roofing, {
    ...first.audience,
    description: "white homeowners in 92025",
    listType: "every_door",
  })
  assert.match(edited.fairHousingNote ?? "", /race/)
  assert.doesNotMatch(edited.description, /white/i)
  assert.equal(edited.listType, "every_door")
  assert.equal(edited.provider?.hook, "eddm.routeMap")
  assert.equal(edited.provider?.count, "unavailable")
})

test("switching off an uploaded file does not keep that file's count as a route count", () => {
  const edited = acceptAudienceEdit(roofing, {
    description: "Your existing customers",
    quantity: 37,
    quantityKind: "from_upload",
    listType: "every_door",
    provider: {
      id: "upload",
      status: "file_counted",
      message: "Your file has 37 names.",
      count: { kind: "from_upload", value: 37 },
    },
  })
  assert.equal(edited.quantity, undefined)
  assert.equal(edited.quantityKind, "unavailable")
  assert.equal(edited.provider?.count, "unavailable")
})

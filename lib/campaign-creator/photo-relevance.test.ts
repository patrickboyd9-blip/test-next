import assert from "node:assert/strict"
import { test } from "node:test"

import {
  matchPhotoTags,
  openAIVisionPhotoCheck,
  photoExpectationForBrief,
  photoMatchesCampaign,
} from "./photo-relevance"
import type { CampaignBrief } from "./types"

const medicare: CampaignBrief = { goal: "Medicare plan reviews" }
const roofing: CampaignBrief = { goal: "Book roof inspections" }

test("construction tags do not match a Medicare campaign", () => {
  const expectation = photoExpectationForBrief(medicare)
  assert.equal(
    matchPhotoTags(
      { tags: ["home-services", "construction", "crew"], describedSubject: "construction crew" },
      expectation
    ),
    "mismatch"
  )
  assert.equal(
    matchPhotoTags(
      { tags: ["medicare", "older couple", "walking"], describedSubject: "older couple walking" },
      expectation
    ),
    "match"
  )
})

test("a roofing campaign can still use a job-site stand-in", () => {
  const expectation = photoExpectationForBrief(roofing)
  assert.equal(
    matchPhotoTags({ tags: ["home-services", "construction", "crew"] }, expectation),
    "unknown"
  )
  assert.equal(
    matchPhotoTags({ tags: ["shingles", "roof edge"], describedSubject: "a roof edge" }, expectation),
    "match"
  )
})

test("a tag mismatch loses even when vision would accept it", async () => {
  const matches = await photoMatchesCampaign(
    { src: "data:image/png;base64,abc", tags: ["construction"], describedSubject: "construction site" },
    photoExpectationForBrief(medicare),
    async () => true
  )
  assert.equal(matches, false)
})

test("vision can reject a tag match, and a transport error stays open", async () => {
  const expectation = photoExpectationForBrief(medicare)
  const rejected = await photoMatchesCampaign(
    { src: "data:image/png;base64,abc", tags: ["medicare", "older couple"] },
    expectation,
    async () => false
  )
  assert.equal(rejected, false)

  const open = await photoMatchesCampaign(
    { src: "data:image/png;base64,abc", describedSubject: "an ordinary local street" },
    photoExpectationForBrief(roofing),
    async () => {
      throw new Error("down")
    }
  )
  assert.equal(open, true)
})

test("the vision check asks for MATCH or MISMATCH and fails open on a bad response", async () => {
  const calls: string[] = []
  const match = await openAIVisionPhotoCheck({
    src: "data:image/png;base64,abc",
    expectation: photoExpectationForBrief(medicare),
    apiKey: "test-key",
    fetchImpl: async (url, init) => {
      calls.push(String(url))
      const body = JSON.parse(String(init?.body))
      assert.match(body.messages[0].content[0].text, /MATCH or MISMATCH/)
      assert.match(body.messages[0].content[0].text, /construction/)
      return new Response(JSON.stringify({ choices: [{ message: { content: "MATCH" } }] }), {
        status: 200,
      })
    },
  })
  assert.equal(match, true)
  assert.match(calls[0] ?? "", /chat\/completions/)

  const closed = await openAIVisionPhotoCheck({
    src: "data:image/png;base64,abc",
    expectation: photoExpectationForBrief(medicare),
    apiKey: "test-key",
    fetchImpl: async () => new Response("no", { status: 500 }),
  })
  assert.equal(closed, null)
})

test("roofing before and after slots reject the wrong subject", () => {
  const before = photoExpectationForBrief(roofing, "before")
  const after = photoExpectationForBrief(roofing, "after")
  assert.equal(
    matchPhotoTags(
      { describedSubject: "an interior ceiling stain with a bucket underneath" },
      before
    ),
    "mismatch"
  )
  assert.equal(
    matchPhotoTags(
      { describedSubject: "empty sky with no roof in the frame" },
      after
    ),
    "mismatch"
  )
  assert.equal(
    matchPhotoTags(
      { describedSubject: "a finished roof on a house, clean and intact" },
      before
    ),
    "mismatch"
  )
  assert.equal(
    matchPhotoTags(
      { describedSubject: "missing shingles and curled shingles on an exterior roof with exposed underlayment" },
      before
    ),
    "match"
  )
  assert.equal(
    matchPhotoTags(
      { describedSubject: "a house with a finished roof and an intact ridge" },
      after
    ),
    "match"
  )
  assert.equal(
    matchPhotoTags(
      { describedSubject: "missing shingles on a damaged roof" },
      after
    ),
    "mismatch"
  )
})

test("an HVAC campaign rejects a gutter or window-trim photograph", () => {
  const expectation = photoExpectationForBrief({
    offer: "Free inspection for broken AC units",
    businessInfo: { name: "Coastal Comfort Heating & Air" },
  })
  assert.equal(expectation.industry, "hvac")
  assert.equal(
    matchPhotoTags({ describedSubject: "a man on a ladder at a gutter" }, expectation),
    "mismatch"
  )
  assert.equal(
    matchPhotoTags({ describedSubject: "a man painting window trim" }, expectation),
    "mismatch"
  )
  assert.equal(
    matchPhotoTags({ describedSubject: "a technician at an outdoor condenser" }, expectation),
    "match"
  )
})

test("final expense refuses a casket description", () => {
  const expectation = photoExpectationForBrief({ goal: "Final expense insurance" })
  assert.equal(
    matchPhotoTags({ describedSubject: "a casket in a funeral home" }, expectation),
    "mismatch"
  )
  assert.equal(
    matchPhotoTags({ tags: ["family"], describedSubject: "a living family" }, expectation),
    "match"
  )
})

import assert from "node:assert/strict"
import { afterEach, test } from "node:test"

import { cometChatIsLive, cometLiveTurn } from "./live-turn"

const KEYS = ["VERCEL_ENV", "DEMO_MODE", "ANTHROPIC_API_KEY"] as const
const saved = Object.fromEntries(KEYS.map((key) => [key, process.env[key]]))

afterEach(() => {
  for (const key of KEYS) {
    const value = saved[key]
    if (value === undefined) delete process.env[key]
    else process.env[key] = value
  }
})

test("preview demo never calls the live interview, even when a key is present", async () => {
  process.env.VERCEL_ENV = "preview"
  process.env.ANTHROPIC_API_KEY = "present"
  assert.equal(await cometChatIsLive(), false)
  const turn = await cometLiveTurn({
    brief: {},
    history: [],
    message: "I want to send mailers for my roofing company",
    refining: true,
  })
  assert.deepEqual(turn, { live: false })
})

test("production uses the live interview only when ANTHROPIC_API_KEY is set", async () => {
  process.env.VERCEL_ENV = "production"
  delete process.env.DEMO_MODE
  delete process.env.ANTHROPIC_API_KEY
  assert.equal(await cometChatIsLive(), false)

  process.env.ANTHROPIC_API_KEY = "   "
  assert.equal(await cometChatIsLive(), false)

  process.env.ANTHROPIC_API_KEY = "present"
  assert.equal(await cometChatIsLive(), true)
  const turn = await cometLiveTurn({
    brief: {},
    history: [],
    message: "hello",
    refining: false,
  })
  assert.deepEqual(turn, { live: false })
})

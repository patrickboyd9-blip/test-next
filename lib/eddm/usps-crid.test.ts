import assert from "node:assert/strict"
import { test } from "node:test"

import { normalizeUspsCrid } from "./usps-crid"
import { readRememberedUspsCrid, writeRememberedUspsCrid } from "./usps-crid-store"
import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"

test("a CRID keeps digits and drops spaces", () => {
  assert.equal(normalizeUspsCrid("12345 6789"), "123456789")
  assert.equal(normalizeUspsCrid("12-345"), "12345")
  assert.equal(normalizeUspsCrid("ABC12345"), null)
  assert.equal(normalizeUspsCrid("1234"), null)
  assert.equal(normalizeUspsCrid(""), null)
})

test("a saved CRID is read back for the next campaign", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "crid-"))
  try {
    await writeRememberedUspsCrid("123456789", dir)
    assert.equal(await readRememberedUspsCrid(dir), "123456789")
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})

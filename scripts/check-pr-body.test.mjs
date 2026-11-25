import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import path from "node:path"
import { test } from "node:test"
import { fileURLToPath } from "node:url"

import { checkPullRequestBody } from "./check-pr-body.mjs"

const script = path.join(path.dirname(fileURLToPath(import.meta.url)), "check-pr-body.mjs")

const passing = `## Requirement served

docs/ENGINEERING_PRINCIPLES.md

## Manifesto check

No new rigidity. The check is one script.

## Customer experience

A roofer approves a proof from Claude in two minutes.
`

test("accepts the three required headings when Customer experience has text", () => {
  assert.deepEqual(checkPullRequestBody(passing), [])
})

test("detects headings case-insensitively at any ATX level", () => {
  const body = `# REQUIREMENT SERVED

Link.

###### manifesto check

Answers.

### CuStOmEr ExPeRiEnCe

Internal: a reviewer can see which customer moment a CI rule protects.
`
  assert.deepEqual(checkPullRequestBody(body), [])
})

test("accepts Setext headings and a sentence on the Customer experience heading line", () => {
  const body = `Requirement served
===============

Link.

Manifesto check
---

Answers.

Customer experience: A roofer approves a proof from Claude in two minutes.
----------------------------------------
`
  assert.deepEqual(checkPullRequestBody(body), [])
})

test("accepts the label lines older pull requests used", () => {
  const body = `Requirement served: docs/RULES.md
Manifesto check: No new rigidity.
Customer experience: A roofer approves a proof from Claude in two minutes.`
  assert.deepEqual(checkPullRequestBody(body), [])
})

test("fails with a clear message when Customer experience is missing", () => {
  const errors = checkPullRequestBody("## Requirement served\n\nLink.\n\n## Manifesto check\n\nAnswers.\n")
  assert.equal(errors.length, 1)
  assert.match(errors[0], /missing a non-empty "Customer experience" section/)
  assert.match(errors[0], /Internal:/)
  assert.match(errors[0], /roofer approves a proof/)
})

test("keeps the customer sentence when a horizontal rule follows it", () => {
  const body = `## Requirement served

Link.

## Manifesto check

Answers.

## Customer experience

A roofer approves a proof from Claude in two minutes.

---

## Notes

Checked the script.
`
  assert.deepEqual(checkPullRequestBody(body), [])
})

test("fails when the Customer experience heading has no text", () => {
  const body = `${passing}## Customer experience\n\n   \n\n<!-- still empty -->\n\n## Notes\n\nDone.\n`.replace(
    "## Customer experience\n\nA roofer approves a proof from Claude in two minutes.\n",
    "",
  )
  const errors = checkPullRequestBody(body)
  assert.equal(errors.length, 1)
  assert.match(errors[0], /empty "Customer experience" section/)
})

test("does not treat a prose mention or a fenced heading as the section", () => {
  const body = `## Requirement served

Link.

## Manifesto check

Answers. The words Customer experience appear here, which is not a heading.

\`\`\`
## Customer experience

A roofer approves a proof from Claude in two minutes.
\`\`\`
`
  const errors = checkPullRequestBody(body)
  assert.equal(errors.length, 1)
  assert.match(errors[0], /missing a non-empty "Customer experience" section/)
})

test("still reports missing Requirement served and Manifesto check headings", () => {
  const errors = checkPullRequestBody("We improved Requirement served handling and the Manifesto check.\n\n## Customer experience\n\nInternal: proof review stays fast.\n")
  assert.equal(errors.length, 2)
  assert.match(errors[0], /missing a "Requirement served" section/)
  assert.match(errors[1], /missing a "Manifesto check" section/)
})

test("the CLI exits 0 for a complete body and 1 with the same message when it is not", () => {
  const ok = spawnSync(process.execPath, [script], { env: { ...process.env, BODY: passing }, encoding: "utf8" })
  assert.equal(ok.status, 0, ok.stderr)

  const missing = spawnSync(process.execPath, [script], { env: { ...process.env, BODY: "" }, encoding: "utf8" })
  assert.equal(missing.status, 1)
  assert.match(missing.stderr, /Customer experience/)
  assert.match(missing.stderr, /Requirement served/)
  assert.match(missing.stderr, /Manifesto check/)
})

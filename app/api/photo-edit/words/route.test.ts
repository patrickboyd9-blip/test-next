import assert from "node:assert/strict"
import test from "node:test"

import { previewDemoSession, runAs } from "@/lib/auth/session"
import { encodeSolidPng } from "@/lib/print-spec/raster"
import { finishedGalleryPhotos } from "@/lib/mail-templates/gallery-finished"

import { POST } from "./route"
import { useFinishedImageLoaderForTests, useFinishedWordsEditorForTests } from "@/lib/image-edit/edit-finished-words"
import { PHOTO_EDIT_SIGN_IN } from "@/lib/image-edit/messages"
import { memoryWordChangeLedger, useWordChangeLedgerForTests } from "@/lib/image-edit/word-change"

const png = encodeSolidPng(8, 6, [4, 5, 6])
const finishedId = finishedGalleryPhotos()[0]?.id ?? ""

test("a signed-in account can change the words on a finished postcard", async () => {
  useWordChangeLedgerForTests(memoryWordChangeLedger())
  useFinishedWordsEditorForTests(async () => png)
  useFinishedImageLoaderForTests(async () => png)
  const response = await runAs(previewDemoSession(), () =>
    POST(
      new Request("http://local/api/photo-edit/words", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          templateId: finishedId,
          businessName: "Harbor Roofing",
          headline: "Free roof check",
          phone: "(619) 555-0148",
        }),
      })
    )
  )
  const body = (await response.json()) as { ok: boolean; afterSrc?: string; proof?: boolean }
  assert.equal(response.status, 200)
  assert.equal(body.ok, true)
  assert.equal(body.proof, true)
  assert.match(body.afterSrc ?? "", /^data:image\/jpeg;base64,/)
})

test("a signed-out visitor cannot change the words", async () => {
  const response = await runAs(null, () =>
    POST(
      new Request("http://local/api/photo-edit/words", {
        method: "POST",
        body: JSON.stringify({
          templateId: finishedId,
          businessName: "Harbor Roofing",
          headline: "Free roof check",
          phone: "(619) 555-0148",
        }),
      })
    )
  )
  const body = (await response.json()) as { message: string; code: string }
  assert.equal(response.status, 401)
  assert.equal(body.message, PHOTO_EDIT_SIGN_IN)
  assert.equal(body.code, "sign-in")
})

test.after(() => {
  useFinishedWordsEditorForTests(null)
  useFinishedImageLoaderForTests(null)
  useWordChangeLedgerForTests(null)
})

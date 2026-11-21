import assert from "node:assert/strict"
import test from "node:test"

import { previewDemoSession, runAs } from "@/lib/auth/session"
import { encodeSolidPng } from "@/lib/print-spec/raster"

import { POST } from "./route"
import { usePhotoEditorForTests } from "@/lib/image-edit/edit-customer-photo"
import { PHOTO_EDIT_SIGN_IN } from "@/lib/image-edit/messages"
import { memoryPhotoEditLedger, usePhotoEditLedgerForTests } from "@/lib/image-edit/spend"

test("the route edits a photo for the signed-in customer", async () => {
  const png = encodeSolidPng(4, 4, [9, 9, 9])
  usePhotoEditLedgerForTests(memoryPhotoEditLedger())
  usePhotoEditorForTests(async () => png)
  const response = await runAs(previewDemoSession(), () =>
    POST(
      new Request("http://local/api/photo-edit", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ instruction: "make the sky sunset", imageBase64: png.toString("base64") }),
      })
    )
  )
  const body = (await response.json()) as { ok: boolean; afterSrc?: string }
  assert.equal(response.status, 200)
  assert.equal(body.ok, true)
  assert.match(body.afterSrc ?? "", /^data:image\/jpeg;base64,/)
})

test("a signed-out customer cannot edit a photo", async () => {
  const response = await runAs(null, () =>
    POST(
      new Request("http://local/api/photo-edit", {
        method: "POST",
        body: JSON.stringify({ instruction: "make the sky sunset", imageBase64: "aa" }),
      })
    )
  )
  const body = (await response.json()) as { message: string }
  assert.equal(response.status, 401)
  assert.equal(body.message, PHOTO_EDIT_SIGN_IN)
})

test.after(() => {
  usePhotoEditorForTests(null)
  usePhotoEditLedgerForTests(memoryPhotoEditLedger())
})

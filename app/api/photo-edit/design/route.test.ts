import assert from "node:assert/strict"
import test from "node:test"

import { previewDemoSession, runAs } from "@/lib/auth/session"
import { encodeSolidPng } from "@/lib/print-spec/raster"
import { finishedGalleryPhotos } from "@/lib/mail-templates/gallery-finished"
import { useLockedHeroEditorForTests, useLockedHeroImageLoaderForTests } from "@/lib/image-edit/edit-locked-hero"
import { PHOTO_EDIT_SIGN_IN } from "@/lib/image-edit/messages"
import { memoryWordChangeLedger, useWordChangeLedgerForTests } from "@/lib/image-edit/word-change"

import { POST } from "./route"

const png = encodeSolidPng(12, 8, [4, 5, 6])
const finishedId = finishedGalleryPhotos()[0]?.id ?? ""

const body = {
  templateId: finishedId,
  campaignName: "Spring tune-up",
  size: "6x9",
  businessName: "Harbor Roofing",
  offer: "Free roof inspection",
  callToAction: "Call to book a visit",
  phone: "(619) 555-0148",
  instructions: "Keep the roof photo and change the headline to Spring checkups.",
}

test("a signed-in account can design a locked gallery postcard", async () => {
  useWordChangeLedgerForTests(memoryWordChangeLedger())
  useLockedHeroEditorForTests(async () => png)
  useLockedHeroImageLoaderForTests(async () => png)
  const response = await runAs(previewDemoSession(), () =>
    POST(
      new Request("http://local/api/photo-edit/design", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      })
    )
  )
  const payload = (await response.json()) as { ok: boolean; frontSrc?: string; backSrc?: string; proof?: boolean }
  assert.equal(response.status, 200)
  assert.equal(payload.ok, true)
  assert.equal(payload.proof, true)
  assert.match(payload.frontSrc ?? "", /^data:image\/jpeg;base64,/)
  assert.match(payload.backSrc ?? "", /^data:image\/jpeg;base64,/)
})

test("a signed-out visitor cannot design a locked gallery postcard", async () => {
  const response = await runAs(null, () =>
    POST(
      new Request("http://local/api/photo-edit/design", {
        method: "POST",
        body: JSON.stringify(body),
      })
    )
  )
  const payload = (await response.json()) as { message: string; code: string }
  assert.equal(response.status, 401)
  assert.equal(payload.message, PHOTO_EDIT_SIGN_IN)
  assert.equal(payload.code, "sign-in")
})

test.after(() => {
  useLockedHeroEditorForTests(null)
  useLockedHeroImageLoaderForTests(null)
  useWordChangeLedgerForTests(null)
})

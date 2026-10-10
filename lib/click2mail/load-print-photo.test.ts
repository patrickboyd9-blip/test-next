import assert from "node:assert/strict"
import { mkdir, rm, writeFile } from "fs/promises"
import path from "path"
import { test } from "node:test"

import { fingerprintForSpec, imageBriefContextFor } from "@/lib/campaign-creator/studio-image-fingerprint"
import { studioImageFileBase } from "@/lib/campaign-creator/studio-image-jobs"
import { defaultStudioImageCacheRoot } from "@/lib/campaign-creator/studio-image-paths"
import type { Campaign, CreativeSpec } from "@/lib/campaign-creator/types"
import { encodeSolidPng } from "@/lib/print-spec/raster"

import { loadFinalPostcardPhoto } from "./load-print-photo"

function spec(): CreativeSpec {
  return {
    layoutVariant: "image_grounded",
    headline: "You're Invited",
    body: "Grand opening week.",
    callToAction: "Bring this card in store",
    visualDirection: "A set table in warm evening light, not a specific restaurant.",
    tone: "Warm",
    palette: ["#6b2d3c", "#f4e4c8", "#1c1917"],
    imagery: "stock_generic_local",
    leadJob: "offer",
    imageryRole: "neighborhood",
  }
}

test("the print file reads the saved final photograph, including one stored as bytes", async () => {
  const campaignId = "camp-print-photo"
  const directionId = "dir-final"
  const creative = spec()
  const fingerprint = fingerprintForSpec(creative, imageBriefContextFor(directionId))
  assert.ok(fingerprint)
  const fileName = `${studioImageFileBase(directionId, fingerprint, "final")}.png`
  const dir = path.join(defaultStudioImageCacheRoot(), campaignId)
  const png = encodeSolidPng(32, 16, [10, 20, 30])
  await mkdir(dir, { recursive: true })
  await writeFile(path.join(dir, fileName), png)

  const campaign = {
    id: campaignId,
    brief: { goal: "Fill the room" },
    mailPiece: {
      id: "piece-1",
      version: 1,
      approvedAt: "2026-10-10T00:00:00.000Z",
      directionId,
      revisionId: "rev-1",
      catalogId: "postcard_5x8",
      catalogVersion: 1,
      spec: creative,
    },
  } as Campaign

  try {
    const photo = await loadFinalPostcardPhoto(campaign)
    assert.ok(photo)
    assert.equal(photo.width, 32)
    assert.equal(photo.height, 16)
    assert.equal(photo.bytes.equals(png), true)

    const missing = await loadFinalPostcardPhoto({
      ...campaign,
      id: "camp-print-missing",
    })
    assert.equal(missing, null)
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})

import assert from "node:assert/strict"
import { execFile } from "node:child_process"
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { test } from "node:test"
import { promisify } from "node:util"

import { PDFDocument, rgb } from "pdf-lib"

import { encodeRgbaPng } from "@/lib/print-spec/render-design-template-png"
import { buildPostcard5x8PrintSpec } from "@/lib/print-spec/postcard-5x8-print-spec"
import { decodeRaster } from "./decode-raster"
import { prepareDesignFace } from "./prepare-face"
import { renderUploadedPostcardPdf } from "./render-uploaded-pdf"
import { createFileUploadedDesignStore } from "./store-file"
import { saveDesignFace } from "./save-face"
import type { Campaign } from "@/lib/campaign-creator/types"

const geometry = buildPostcard5x8PrintSpec()
const NAVY: [number, number, number, number] = [12, 48, 92, 255]

test("a 605 by 365 logo is placed at its real size on a finished card", async () => {
  const prepared = await mustPrepare(solid(605, 365, NAVY), "image/png", "front")
  const raster = decodeRaster(prepared.bytes, "png")
  assert.ok(raster)
  assert.equal(raster.width, geometry.pixelSize.widthPx)
  assert.equal(raster.height, geometry.pixelSize.heightPx)
  const box = colorBox(raster.rgba, raster.width, raster.height, NAVY)
  assert.ok(box)
  const ratio = box.width / box.height
  assert.ok(Math.abs(ratio - 605 / 365) < 0.05, `logo stayed wide (${ratio})`)
  assert.ok(box.width < raster.width * 0.4, "logo was not stretched across the card")
  assert.match(prepared.issues.map((item) => item.message).join(" "), /real size/)
  assert.equal(prepared.issues.some((item) => item.severity === "error"), false)
})

test("a square badge on the back stays out of the address area", async () => {
  const prepared = await mustPrepare(solid(455, 445, NAVY), "image/png", "back")
  const raster = decodeRaster(prepared.bytes, "png")
  assert.ok(raster)
  const box = colorBox(raster.rgba, raster.width, raster.height, NAVY)
  assert.ok(box)
  assert.ok(Math.abs(box.width / box.height - 455 / 445) < 0.08)
  for (const keepOut of geometry.keepOuts) {
    const hitsAddress: boolean =
      box.x < keepOut.pixels.xPx + keepOut.pixels.widthPx &&
      box.x + box.width > keepOut.pixels.xPx &&
      box.y < keepOut.pixels.yPx + keepOut.pixels.heightPx &&
      box.y + box.height > keepOut.pixels.yPx
    assert.equal(hitsAddress, false)
  }
  assert.equal(prepared.address, "clear")
})

test("a transparent logo keeps its mark and leaves the rest paper white", async () => {
  const width = 80
  const height = 40
  const rgba = new Uint8Array(width * height * 4)
  for (let y = 10; y < 30; y += 1) {
    for (let x = 10; x < 70; x += 1) {
      const index = (y * width + x) * 4
      rgba[index] = 12
      rgba[index + 1] = 48
      rgba[index + 2] = 92
      rgba[index + 3] = 255
    }
  }
  const prepared = await mustPrepare(encodeRgbaPng(width, height, rgba, 72), "image/png", "front")
  const raster = decodeRaster(prepared.bytes, "png")
  assert.ok(raster)
  assert.equal(raster.rgba[3], 255)
  assert.ok((raster.rgba[0] ?? 0) > 240)
  const box = colorBox(raster.rgba, raster.width, raster.height, NAVY)
  assert.ok(box)
  assert.equal(box.width, 60)
  assert.equal(box.height, 20)
})

test("a portrait page is turned landscape and still contains its picture", async () => {
  const rgba = new Uint8Array(1500 * 2400 * 4)
  rgba.fill(255)
  paint(rgba, 1500, 20, 20, 40, 40, [200, 20, 20, 255])
  const prepared = await mustPrepare(encodeRgbaPng(1500, 2400, rgba, 300), "image/png", "front")
  const raster = decodeRaster(prepared.bytes, "png")
  assert.ok(raster)
  assert.equal(raster.width, 2550)
  assert.equal(raster.height, 1650)
  const box = colorBox(raster.rgba, raster.width, raster.height, [200, 20, 20, 255])
  assert.ok(box)
  assert.ok(box.width < 80 && box.height < 80)
})

test("a large page-shaped picture is fitted down, and a soft one is not called sharp", async () => {
  const large = await mustPrepare(solid(4000, 2588, [20, 90, 40, 255]), "image/png", "front")
  const largeRaster = decodeRaster(large.bytes, "png")
  assert.equal(largeRaster?.width, 2550)
  assert.equal(large.issues.some((item) => item.code === "resolution"), false)
  assert.equal(colorBox(largeRaster!.rgba, largeRaster!.width, largeRaster!.height, [20, 90, 40, 255])?.width, 2550)

  const soft = await mustPrepare(solid(612, 396, [20, 90, 40, 255]), "image/png", "front")
  assert.equal(soft.issues.some((item) => item.severity === "error"), false)
  assert.match(soft.issues.map((item) => item.message).join(" "), /does not add detail/)
})

test("a full-bleed back that fills the address area asks before covering it", async () => {
  const prepared = await mustPrepare(solid(2550, 1650, [30, 30, 30, 255]), "image/png", "back")
  assert.equal(prepared.address, "covered")
  assert.match(prepared.issues.map((item) => item.message).join(" "), /will cover part of this back/)
  assert.equal(prepared.issues.some((item) => item.severity === "error"), false)
})

test("a valid postcard PDF keeps its page, and a broken file is refused", async () => {
  const doc = await PDFDocument.create()
  const page = doc.addPage([8.5 * 72, 5.5 * 72])
  page.drawRectangle({ x: 40, y: 40, width: 80, height: 40, color: rgb(0.1, 0.2, 0.4) })
  const prepared = await mustPrepare(Buffer.from(await doc.save()), "application/pdf", "front")
  assert.equal(prepared.mediaType, "application/pdf")
  const loaded = await PDFDocument.load(prepared.bytes)
  assert.equal(loaded.getPageCount(), 1)
  assert.equal(Math.round(loaded.getPage(0).getWidth()), Math.round(8.5 * 72))
  assert.equal(prepared.issues.some((item) => item.code === "page_size"), false)

  const broken = await prepareDesignFace({
    bytes: Buffer.from("not a picture"),
    declaredType: "image/png",
    face: "front",
    geometry,
  })
  assert.equal(broken.ok, false)

  const huge = encodeRgbaPng(9000, 20, new Uint8Array(9000 * 20 * 4).fill(255), 72)
  const refused = await prepareDesignFace({ bytes: huge, declaredType: "image/png", face: "front", geometry })
  assert.equal(refused.ok, false)
  if (!refused.ok) assert.match(refused.error, /too large/)
})

test("the saved original stays separate, and the proof file matches the export", async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "upload-fit-"))
  try {
    const store = createFileUploadedDesignStore(directory)
    const campaign = { id: "camp", uploadedDesign: undefined } as unknown as Campaign
    const saved = await saveDesignFace({
      campaign,
      face: "front",
      fileName: "pbs-pizza-logo-5-vintage-badge.png",
      bytes: solid(605, 365, NAVY),
      declaredType: "image/png",
      store,
    })
    assert.equal(saved.front?.key, "front.png")
    assert.equal(saved.front?.preparedKey, "front-prepared.png")
    const original = await store.get("camp", "front.png")
    const proof = await store.get("camp", "front-prepared.png")
    assert.ok(original && proof)
    assert.notEqual(original.bytes.length, proof.bytes.length)
    const proofRaster = decodeRaster(proof.bytes, "png")
    assert.equal(proofRaster?.width, 2550)

    const pdf = await renderUploadedPostcardPdf({
      geometry,
      front: { bytes: proof.bytes, mediaType: "image/png" },
      back: { bytes: proof.bytes, mediaType: "image/png" },
    })
    const dir = await mkdtemp(path.join(tmpdir(), "upload-proof-"))
    try {
      const file = path.join(dir, "card.pdf")
      await writeFile(file, pdf)
      await promisify(execFile)("pdftoppm", ["-png", "-r", "72", "-f", "1", "-l", "1", file, path.join(dir, "front")])
      const printed = decodeRaster(await readFile(path.join(dir, "front-1.png")), "png")
      assert.ok(printed)
      const printedBox = colorBox(printed.rgba, printed.width, printed.height, NAVY)
      const proofBox = colorBox(proofRaster!.rgba, proofRaster!.width, proofRaster!.height, NAVY)
      assert.ok(printedBox && proofBox)
      const printedRatio = printedBox.width / printed.width
      const proofRatio = proofBox.width / proofRaster!.width
      assert.ok(Math.abs(printedRatio - proofRatio) < 0.03, `export matches proof (${printedRatio} vs ${proofRatio})`)
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
})

async function mustPrepare(bytes: Uint8Array, declaredType: string, face: "front" | "back") {
  const result = await prepareDesignFace({ bytes, declaredType, face, geometry })
  assert.equal(result.ok, true)
  if (!result.ok) throw new Error("unreachable")
  return result.prepared
}

function solid(width: number, height: number, color: [number, number, number, number]): Buffer {
  const rgba = new Uint8Array(width * height * 4)
  for (let index = 0; index < rgba.length; index += 4) {
    rgba[index] = color[0]
    rgba[index + 1] = color[1]
    rgba[index + 2] = color[2]
    rgba[index + 3] = color[3]
  }
  return encodeRgbaPng(width, height, rgba, 72)
}

function paint(
  rgba: Uint8Array,
  width: number,
  x: number,
  y: number,
  w: number,
  h: number,
  color: [number, number, number, number]
): void {
  for (let row = 0; row < h; row += 1) {
    for (let col = 0; col < w; col += 1) {
      const index = ((y + row) * width + (x + col)) * 4
      rgba[index] = color[0]
      rgba[index + 1] = color[1]
      rgba[index + 2] = color[2]
      rgba[index + 3] = color[3]
    }
  }
}

function colorBox(
  rgba: Uint8Array,
  width: number,
  height: number,
  color: readonly [number, number, number, number]
): { x: number; y: number; width: number; height: number } | null {
  let minX = width
  let minY = height
  let maxX = -1
  let maxY = -1
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = (y * width + x) * 4
      if (
        Math.abs((rgba[index] ?? 0) - color[0]) < 12 &&
        Math.abs((rgba[index + 1] ?? 0) - color[1]) < 12 &&
        Math.abs((rgba[index + 2] ?? 0) - color[2]) < 12
      ) {
        minX = Math.min(minX, x)
        minY = Math.min(minY, y)
        maxX = Math.max(maxX, x)
        maxY = Math.max(maxY, y)
      }
    }
  }
  if (maxX < 0) return null
  return { x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1 }
}

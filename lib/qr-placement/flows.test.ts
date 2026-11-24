import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import test from "node:test"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"

import jsQR from "jsqr"
import { PDFDocument } from "pdf-lib"
import sharp from "sharp"

import { DesignRequestForm } from "@/components/campaign-creator/design-request/DesignRequestForm"
import { UploadDesign } from "@/components/campaign-creator/upload/UploadDesign"
import { ProofTray } from "@/components/cockpit/ProofCard"
import { resetAnalytics } from "@/lib/analytics/store"
import { createEmptyCampaignCreative, type Campaign } from "@/lib/campaign-creator/types"
import { parseDesignRequest } from "@/lib/design-requests/parse"
import { readDesignRequestImage } from "@/lib/design-requests/read"
import { saveDesignRequest } from "@/lib/design-requests/save"
import { createFileDesignRequestStore } from "@/lib/design-requests/store"
import { createFileDesignRequestUploadStore } from "@/lib/design-requests/uploads-file"
import { DESIGN_REQUEST_PRINT_KEY } from "@/lib/design-requests/uploads"
import { prepareCometPrint } from "@/lib/mailer-compose/comet-print"
import { buildPostcard5x8PrintSpec } from "@/lib/print-spec/postcard-5x8-print-spec"
import { renderUploadedPostcardPdf } from "@/lib/bring-your-own-design/render-uploaded-pdf"

import { qrPixelBox } from "./composite"
import {
  QR_MAX_INCHES,
  QR_MIN_INCHES,
  QR_RECOMMENDATION,
  QR_WEBSITE_MISSING,
  activeQrs,
  addQrCode,
  frameBox,
  initialQrPlacement,
  moveQr,
  sanitizePlacedQrs,
  scanDestinationLine,
  setQrChoice,
  setQrEnabled,
} from "./model"
import { compositeQrOntoUploadFace, qrPdfBox, renderTrackedPostcardPdf } from "./print-file"

test("comet, upload, and team design recommend a QR and explain both destinations", () => {
  const cometScreen = readFileSync("components/cockpit/ComposeMailer.tsx", "utf8")
  assert.match(cometScreen, /QrPlacementPanel/)
  assert.match(cometScreen, /prepareCometPrint/)
  assert.match(cometScreen, /path === "ai"/)
  assert.match(cometScreen, /path === "upload"/)
  assert.doesNotMatch(readFileSync("components/cockpit/sky.tsx", "utf8"), /qr-placement/)

  const placed = initialQrPlacement("5x8", "harbor.example", "(619) 555-0148")
  const comet = renderToStaticMarkup(
    createElement(ProofTray, {
      proof: {
        shop: "Harbor Roofing",
        line: "Free roof inspection",
        to: "Homeowners nearby",
        people: 0,
        phone: "(619) 555-0148",
        website: "",
        logoName: null,
        qr: null,
      },
      qr: { size: "5x8", enabled: true, codes: placed.codes, onMove() {} },
    })
  )
  const team = renderToStaticMarkup(createElement(DesignRequestForm, { onBack() {} }))
  const campaign = renderToStaticMarkup(
    createElement(UploadDesign, { campaign: uploadCampaign(), onCampaign() {} })
  )

  for (const html of [team, campaign]) {
    assert.match(html, new RegExp(QR_RECOMMENDATION))
    assert.match(html, /Add a QR code/)
    assert.match(html, /Send scans to a simple page we make for you/)
    assert.match(html, /Send scans to my own website/)
    assert.match(html, /data-qr-placement/)
    assert.match(html, new RegExp(`min="${QR_MIN_INCHES}"`))
    assert.match(html, new RegExp(`max="${QR_MAX_INCHES}"`))
    assert.doesNotMatch(html, /click2mail|anthropic|gemini|openai|internal cost/i)
  }
  for (const html of [comet, team, campaign]) {
    const postcard = html.slice(html.indexOf("data-qr-postcard"), html.indexOf("data-qr-placement") === -1 ? undefined : html.indexOf("data-qr-placement"))
    assert.match(postcard, /data-qr-overlay/)
    assert.doesNotMatch(postcard, /<p[^>]*>[^<]*When someone scans/)
    assert.match(postcard, /aria-label="QR code\. When someone scans/)
  }
})

test("a blocked drop is explained, and turning the code off leaves it off", () => {
  let value = addQrCode(initialQrPlacement("5x8", "harbor.example"), "5x8", "harbor.example")
  const back = value.codes.find((code) => code.side === "back")
  assert.ok(back)
  value = moveQr(value, "5x8", back.id, 6.5, 3.5)
  assert.match(value.blockedMessage, /postage and address/)
  assert.equal(value.codes.length, 2)
  const off = setQrEnabled(value, false, "5x8", "harbor.example")
  assert.equal(off.enabled, false)
  assert.deepEqual(activeQrs(off), [])
  const page = scanDestinationLine(value.codes[0]!)
  const site = setQrChoice(value, value.codes[0]!.id, "website", "https://harbor.example/offer", value.codes[0]!.parts, "")
  assert.match(page, /a page we make for you/)
  assert.match(scanDestinationLine(site.codes[0]!), /harbor\.example/)
})

test("comet prints the symbol after the card is written and tracks the scan", async () => {
  resetAnalytics()
  const placed = activeQrs(initialQrPlacement("5x8", "harbor.example", "(619) 555-0148"))
  const chat = readFileSync("lib/mailer-compose/live-turn.ts", "utf8")
  const interview = readFileSync("lib/mailer-compose/interview.ts", "utf8")
  const printer = readFileSync("lib/mailer-compose/comet-print.ts", "utf8")
  const sky = readFileSync("components/cockpit/sky.tsx", "utf8")
  assert.doesNotMatch(chat, /qr-placement|paintQrs|compositeQr/)
  assert.doesNotMatch(interview, /qr-placement|paintQrs|compositeQr/)
  assert.doesNotMatch(printer, /click2mail|anthropic|gemini|openai|internal cost|postage by itself/i)
  assert.doesNotMatch(sky, /qr-placement/)

  const printed = await prepareCometPrint({
    size: "5x8",
    shop: "Harbor Roofing",
    line: "Free roof inspection",
    phone: "(619) 555-0148",
    qrs: placed,
  })
  assert.equal(printed.ok, true)
  if (!printed.ok) return
  assert.match(printed.pdfBase64, /^[A-Za-z0-9+/=]+$/)
  const pdf = Buffer.from(printed.pdfBase64, "base64")
  assert.equal(pdf.subarray(0, 5).toString(), "%PDF-")
  const doc = await PDFDocument.load(pdf)
  assert.equal(doc.getPageCount(), 2)

  const faces = await renderTrackedPostcardPdf({
    size: "5x8",
    origin: "https://mail.example",
    codes: sanitizeOk(placed),
    frontLines: ["Harbor Roofing", "Free roof inspection"],
    backLines: ["Harbor Roofing"],
  })
  const found = await decodeFace(faces.front, "5x8", "front", sanitizeOk(placed)[0]!)
  assert.equal(found, `https://mail.example/q/${sanitizeOk(placed)[0]!.code}`)
})

test("an uploaded design composites the QR onto the artwork and into the print file", async () => {
  const review = readFileSync("lib/bring-your-own-design/actions.ts", "utf8")
  const reviewFn = review.slice(review.indexOf("function requestUploadedDesignReview"), review.indexOf("function approveUploadedDesign"))
  const approveFn = review.slice(review.indexOf("function approveUploadedDesign"))
  assert.doesNotMatch(reviewFn, /compositeQr|paintQrs|qr-placement/)
  assert.match(approveFn, /compositeQrOntoUploadFace/)

  const placed = sanitizeOk(activeQrs(addQrCode(initialQrPlacement("5x8", "harbor.example"), "5x8", "harbor.example")))
  const image = await sharp({
    create: { width: 850, height: 550, channels: 3, background: { r: 210, g: 190, b: 160 } },
  })
    .jpeg()
    .toBuffer()
  const painted = await compositeQrOntoUploadFace(
    { bytes: image, mediaType: "image/jpeg" },
    "5x8",
    placed.filter((code) => code.side === "front").map((code) => ({
      xInches: code.xInches,
      yInches: code.yInches,
      sizeInches: code.sizeInches,
      payload: `https://mail.example/q/${code.code}`,
    }))
  )
  assert.equal(painted.overlay.length, 0)
  assert.equal(painted.face.mediaType, "image/jpeg")
  const found = await decodeFace(Buffer.from(painted.face.bytes), "5x8", "front", placed[0]!)
  assert.equal(found, `https://mail.example/q/${placed[0]!.code}`)

  const blank = await PDFDocument.create()
  const blankPage = blank.addPage([200, 100])
  blankPage.drawRectangle({ x: 0, y: 0, width: 200, height: 100 })
  const pdfFace = await blank.save()
  const deferred = await compositeQrOntoUploadFace(
    { bytes: pdfFace, mediaType: "application/pdf" },
    "5x8",
    [{ xInches: 0.4, yInches: 0.4, sizeInches: 1, payload: "https://mail.example/q/abcd2345" }]
  )
  assert.equal(deferred.overlay.length, 1)
  const geometry = buildPostcard5x8PrintSpec()
  const box = qrPdfBox(geometry, deferred.overlay[0]!)
  assert.ok(Math.abs(box.x - (0.25 + 0.4) * 72) < 0.01)
  const withCode = await renderUploadedPostcardPdf({
    geometry,
    front: deferred.face,
    back: { bytes: image, mediaType: "image/jpeg" },
    frontMarks: deferred.overlay,
  })
  const plain = await renderUploadedPostcardPdf({
    geometry,
    front: deferred.face,
    back: { bytes: image, mediaType: "image/jpeg" },
  })
  assert.ok(withCode.byteLength > plain.byteLength)
  const missing = sanitizePlacedQrs("5x8", [{ ...placed[0], destination: "website", website: "not a site" }])
  assert.equal(missing.ok, false)
  if (!missing.ok) assert.equal(missing.message, QR_WEBSITE_MISSING)
})

test("a team request stores the placement and a print file for either destination", async () => {
  resetAnalytics()
  const pageCodes = activeQrs(initialQrPlacement("5x8", "", "(512) 555-0148"))
  const parsed = parseDesignRequest({
    companyName: "Harbor Roofing",
    address: "100 Main St, Austin, TX 78701",
    vibe: "Calm and local",
    offer: "Free inspection this month",
    responseMethods: ["qr"],
    qrs: JSON.stringify(pageCodes),
    size: "5x8",
  })
  assert.equal(parsed.ok, true)
  if (!parsed.ok) return
  assert.equal(parsed.value.qrUrl, undefined)
  assert.equal(parsed.value.qrCodes?.[0]?.destination, "page")
  assert.match(scanDestinationLine(parsed.value.qrCodes![0]!), /a page we make for you/)

  const start = initialQrPlacement("5x8", "harbor.example")
  const website = setQrChoice(start, start.codes[0]!.id, "website", "harbor.example/offer", start.codes[0]!.parts, "")
  const withSite = parseDesignRequest({
    companyName: "Harbor Roofing",
    address: "100 Main St, Austin, TX 78701",
    vibe: "Calm and local",
    offer: "Free inspection this month",
    responseMethods: ["qr"],
    qrs: JSON.stringify(activeQrs(website)),
    size: "5x8",
  })
  assert.equal(withSite.ok, true)
  if (!withSite.ok) return
  assert.equal(withSite.value.qrUrl, "https://harbor.example/offer")

  const directory = await mkdtemp(path.join(tmpdir(), "mm-qr-requests-"))
  const uploads = await mkdtemp(path.join(tmpdir(), "mm-qr-uploads-"))
  try {
    const requests = createFileDesignRequestStore(directory)
    const files = createFileDesignRequestUploadStore(uploads)
    const saved = await saveDesignRequest(
      {
        companyName: "Harbor Roofing",
        address: "100 Main St, Austin, TX 78701",
        vibe: "Calm and local",
        offer: "Free inspection this month",
        responseMethods: ["qr"],
        qrs: JSON.stringify(pageCodes),
        size: "5x8",
      },
      {},
      { requests, uploads: files, ownerId: "owner", origin: "https://mail.example" }
    )
    assert.equal(saved.ok, true)
    if (!saved.ok) return
    assert.equal(saved.request.printFileKey, DESIGN_REQUEST_PRINT_KEY)
    const file = await readDesignRequestImage(saved.request.id, DESIGN_REQUEST_PRINT_KEY, { requests, uploads: files })
    assert.equal(file?.mediaType, "application/pdf")
    assert.equal(file?.bytes.subarray(0, 5).toString(), "%PDF-")
    const code = saved.request.qrCodes?.[0]?.code
    assert.ok(code)
    const faces = await renderTrackedPostcardPdf({
      size: "5x8",
      origin: "https://mail.example",
      codes: saved.request.qrCodes ?? [],
      frontLines: ["Harbor Roofing"],
      backLines: ["Harbor Roofing"],
    })
    const found = await decodeFace(faces.front, "5x8", "front", saved.request.qrCodes![0]!)
    assert.equal(found, `https://mail.example/q/${code}`)
  } finally {
    await rm(directory, { recursive: true, force: true })
    await rm(uploads, { recursive: true, force: true })
  }
})

function sanitizeOk(raw: unknown) {
  const sanitized = sanitizePlacedQrs("5x8", raw)
  if (!sanitized.ok) throw new Error(sanitized.message)
  return sanitized.codes
}

function uploadCampaign(): Campaign {
  const now = "2026-10-11T00:00:00.000Z"
  return {
    id: "camp",
    ownerId: "owner",
    entry: "upload",
    name: "Spring postcard",
    status: "strategy_confirmed",
    brief: { businessInfo: { name: "Northwind HVAC" }, offer: "Free inspection" },
    creative: createEmptyCampaignCreative(),
    transcript: [],
    designSource: "upload",
    uploadedDesign: {
      front: { fileName: "front.png", mediaType: "image/png", byteLength: 10, key: "front.png" },
      back: { fileName: "back.png", mediaType: "image/png", byteLength: 10, key: "back.png" },
      issues: [],
    },
    readyForBriefReview: false,
    createdAt: now,
    updatedAt: now,
  }
}

async function decodeFace(
  image: Buffer,
  size: "5x8" | "6x9",
  side: "front" | "back",
  qr: { xInches: number; yInches: number; sizeInches: number }
): Promise<string | null> {
  const frame = side === "back" ? "canvas" : "canvas"
  const box = qrPixelBox(frameBox(size, frame), (await sharp(image).metadata()).width ?? 1, (await sharp(image).metadata()).height ?? 1, qr)
  const { data, info } = await sharp(image).extract(box).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  const pixels = new Uint8ClampedArray(data.buffer, data.byteOffset, data.byteLength)
  return jsQR(pixels, info.width, info.height)?.data ?? null
}

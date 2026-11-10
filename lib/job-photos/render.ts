import {
  clip,
  endPath,
  PDFDocument,
  popGraphicsState,
  pushGraphicsState,
  rectangle,
  rgb,
  StandardFonts,
} from "pdf-lib"

import type { JobCreative, JobPhotoRecord } from "@/lib/campaign-creator/types"
import { paintBarcodeClearZone } from "@/lib/print-spec/barcode-clear-zone"
import { addressSideContentRect, rectsOverlap } from "@/lib/print-spec/address-side-content"
import { buildPostcard5x8PrintSpec } from "@/lib/print-spec/postcard-5x8-print-spec"

import { FRONT_PHOTO_SLOT } from "./crop"
import { placeFace, type FacePlacement } from "./layout"

const PAGE_W = 8.5 * 72
const PAGE_H = 5.5 * 72

export interface JobProof {
  bytes: Uint8Array
  front: FacePlacement
  back: FacePlacement
}

export async function renderJobProof(
  creative: JobCreative,
  photos: ReadonlyMap<string, Uint8Array>
): Promise<JobProof> {
  const front = placeFace(creative, "front")
  const back = placeFace(creative, "back")
  const doc = await PDFDocument.create()
  const font = await doc.embedFont(StandardFonts.Helvetica)
  const bold = await doc.embedFont(StandardFonts.HelveticaBold)
  const frontPage = doc.addPage([PAGE_W, PAGE_H])
  const backPage = doc.addPage([PAGE_W, PAGE_H])
  frontPage.drawRectangle({ x: 0, y: 0, width: PAGE_W, height: PAGE_H, color: rgb(0.96, 0.95, 0.93) })
  backPage.drawRectangle({ x: 0, y: 0, width: PAGE_W, height: PAGE_H, color: rgb(0.98, 0.97, 0.95) })

  const frontPhoto = creative.photos.find((photo) => photo.id === front.photoId) ?? null
  if (front.treatment === "photo" && front.fit?.fits && frontPhoto) {
    const bytes = photos.get(frontPhoto.fileName)
    if (bytes) {
      const image = await doc.embedPng(bytes)
      drawWindow(frontPage, image, frontPhoto, front.fit.window, { x: 0.2, y: 0.4, w: FRONT_PHOTO_SLOT.w, h: FRONT_PHOTO_SLOT.h })
    }
  }
  const line = creative.serviceAction.trim() || "Your work"
  frontPage.drawText(line.slice(0, 28), { x: 6.05 * 72, y: PAGE_H - 1.1 * 72, size: 14, font: bold, color: rgb(0.1, 0.1, 0.1), maxWidth: 2.2 * 72 })
  if (front.warning) {
    frontPage.drawText(wrapNote(front.warning), { x: 6.05 * 72, y: PAGE_H - 1.8 * 72, size: 8, font, color: rgb(0.25, 0.2, 0.15), maxWidth: 2.2 * 72 })
  }

  const content = addressSideContentRect()
  assertClearOfKeepouts(content)
  if (back.treatment === "photo" && back.fit?.fits) {
    const photo = creative.photos.find((item) => item.id === back.photoId) ?? null
    const bytes = photo ? photos.get(photo.fileName) : undefined
    if (photo && bytes) {
      const image = await doc.embedPng(bytes)
      drawWindow(backPage, image, photo, back.fit.window, {
        x: content.xInches,
        y: content.yInches,
        w: content.widthInches,
        h: content.heightInches,
      })
    }
  } else {
    backPage.drawText(line.slice(0, 48), {
      x: content.xInches * 72,
      y: PAGE_H - (content.yInches + 0.7) * 72,
      size: 18,
      font: bold,
      color: rgb(0.12, 0.12, 0.12),
      maxWidth: content.widthInches * 72,
    })
    backPage.drawText("Words only. The front photo stays where you left it.", {
      x: content.xInches * 72,
      y: PAGE_H - (content.yInches + 1.15) * 72,
      size: 10,
      font,
      color: rgb(0.25, 0.25, 0.25),
      maxWidth: content.widthInches * 72,
    })
  }
  paintBarcodeClearZone(backPage, buildPostcard5x8PrintSpec())
  const bytes = await doc.save()
  return { bytes, front, back }
}

function assertClearOfKeepouts(rect: { xInches: number; yInches: number; widthInches: number; heightInches: number }) {
  for (const keepOut of buildPostcard5x8PrintSpec().keepOuts) {
    if (rectsOverlap(rect, keepOut.canvas)) {
      throw new Error(`Job photo overlaps the ${keepOut.id} keep-out.`)
    }
  }
}

function wrapNote(value: string): string {
  return value.length > 90 ? `${value.slice(0, 87)}…` : value
}

function drawWindow(
  page: ReturnType<PDFDocument["addPage"]>,
  image: Awaited<ReturnType<PDFDocument["embedPng"]>>,
  photo: JobPhotoRecord,
  window: { x: number; y: number; w: number; h: number },
  slot: { x: number; y: number; w: number; h: number }
) {
  const dest = {
    x: slot.x * 72,
    y: PAGE_H - (slot.y + slot.h) * 72,
    w: slot.w * 72,
    h: slot.h * 72,
  }
  page.pushOperators(pushGraphicsState(), rectangle(dest.x, dest.y, dest.w, dest.h), clip(), endPath())
  const width = dest.w / window.w
  const height = dest.h / window.h
  const x = dest.x - window.x * width
  const y = dest.y - (1 - (window.y + window.h)) * height
  page.drawImage(image, { x, y, width, height })
  page.pushOperators(popGraphicsState())
  void photo
}

import { execFile } from "node:child_process"
import { mkdir, writeFile } from "node:fs/promises"
import path from "node:path"
import { promisify } from "node:util"

import type { CreativeSpec } from "@/lib/campaign-creator/types"
import type { PostcardSizeId } from "@/lib/postcard-layouts/ids"
import { encodeRgbaPng } from "@/lib/print-spec/render-design-template-png"
import { renderTemplatedPostcardPdf } from "@/lib/print-spec/render-template-postcard-pdf"
import { ROOFING_PRO_META, ROOFING_PRO_TEMPLATE_IDS } from "@/lib/roofing-pro/ids"

/**
 * Renders the ten roofing pro templates for two sample businesses.
 * Photographs are drawn in code. No research scan is read or written.
 *
 *   npx tsx scripts/render-roofing-pro-proofs.ts
 */

const exec = promisify(execFile)
const OUT = process.env.ROOFING_PROOF_OUT ?? "/opt/cursor/artifacts/roofing-pro"

const NORTHLINE: CreativeSpec = {
  headline: "A roof that stays dry",
  subheadline: "We walk it and tell you what can wait.",
  body: "Northline checks the roof and the flashing. You get a plain answer.",
  offer: "Free roof inspection",
  callToAction: "Book a free inspection",
  phone: "(619) 555-0148",
  website: "https://northline.example/book",
  qrDestination: "https://northline.example/book",
}

const SUMMIT: CreativeSpec = {
  headline: "The ridge line, made quiet",
  subheadline: "One look at the roof you already have.",
  body: "Walk the roof. Seal the flashing. Leave the rooms dry.",
  offer: "$500 off a roof",
  callToAction: "Book a free inspection",
  phone: "(720) 555-0194",
  website: "https://summitpeak.example/look",
  qrDestination: "https://summitpeak.example/look",
}

const BUSINESSES = [
  {
    id: "northline",
    name: "Northline Roofing",
    license: "ROC 301442",
    spec: NORTHLINE,
    sky: [186, 214, 232] as RGB,
    roof: [61, 70, 84] as RGB,
    wall: [239, 230, 214] as RGB,
  },
  {
    id: "summit",
    name: "Summit Peak Roofing",
    license: "Licensed",
    spec: SUMMIT,
    sky: [168, 188, 206] as RGB,
    roof: [42, 36, 32] as RGB,
    wall: [214, 206, 196] as RGB,
  },
] as const

type RGB = readonly [number, number, number]

const CANVAS: Record<PostcardSizeId, { w: number; h: number }> = {
  "5x8": { w: 2550, h: 1650 },
  "6x9": { w: 2850, h: 1950 },
}

async function main() {
  await mkdir(OUT, { recursive: true })
  const photos = new Map<string, { primary: Uint8Array; alternate: Uint8Array; width: number; height: number }>()
  for (const size of ["5x8", "6x9"] as const) {
    for (const business of BUSINESSES) {
      const { w, h } = CANVAS[size]
      const primary = housePng(w, h, business.sky, business.roof, business.wall, "finished")
      const before = housePng(w, h, [150, 156, 162], [92, 90, 88], [176, 170, 162], "worn")
      photos.set(`${size}:${business.id}`, {
        primary,
        alternate: before,
        width: w,
        height: h,
      })
    }
  }

  const sheets: Record<PostcardSizeId, string[]> = { "5x8": [], "6x9": [] }
  for (const size of ["5x8", "6x9"] as const) {
    for (const business of BUSINESSES) {
      const photo = photos.get(`${size}:${business.id}`)!
      for (const id of ROOFING_PRO_TEMPLATE_IDS) {
        const pdf = await renderTemplatedPostcardPdf({
          templateId: id,
          size,
          paletteId: "roofing",
          copy: {
            businessName: business.name,
            headline: business.spec.headline ?? "",
            subheadline: business.spec.subheadline,
            body: business.spec.body,
            offer: business.spec.offer,
            callToAction: business.spec.callToAction,
            phone: business.spec.phone,
            website: business.spec.website,
            qrPayload: business.spec.qrDestination,
            license: business.license,
          },
          image: { bytes: photo.primary, width: photo.width, height: photo.height },
          alternateImage: { bytes: photo.alternate, width: photo.width, height: photo.height },
        })
        const stem = path.join(OUT, `${size}-${business.id}-${id}`)
        await writeFile(`${stem}.pdf`, pdf.bytes)
        await exec("pdftoppm", ["-png", "-r", "72", `${stem}.pdf`, stem])
        const front = `${stem}-1.png`
        const back = `${stem}-2.png`
        await exec("mv", [front, `${stem}-front.png`])
        await exec("mv", [back, `${stem}-back.png`])
        sheets[size].push(`${stem}-front.png`, `${stem}-back.png`)
        console.log(`${size} ${business.id} ${id} ${ROOFING_PRO_META[id].name}`)
      }
    }
  }

  for (const size of ["5x8", "6x9"] as const) {
    const contact = path.join(OUT, `contact-${size}.png`)
    await exec("montage", [
      ...sheets[size],
      "-geometry",
      "220x+6+6",
      "-tile",
      "4x",
      "-background",
      "#e7e2d8",
      "-title",
      `${size} roofing pro templates — Northline then Summit, front then back`,
      contact,
    ])
    console.log(contact)
  }
}

function housePng(width: number, height: number, sky: RGB, roof: RGB, wall: RGB, kind: "finished" | "worn"): Uint8Array {
  const rgba = new Uint8Array(width * height * 4)
  fill(rgba, width, height, sky)
  const ridge = Math.round(height * 0.34)
  const eave = Math.round(height * 0.56)
  roofPlane(rgba, width, height, ridge, eave, roof, kind)
  fillRect(rgba, width, 0, eave, width, height - eave, wall)
  fillRect(rgba, width, Math.round(width * 0.18), eave + Math.round(height * 0.08), Math.round(width * 0.12), Math.round(height * 0.16), [232, 236, 240])
  fillRect(rgba, width, Math.round(width * 0.62), eave + Math.round(height * 0.1), Math.round(width * 0.1), Math.round(height * 0.22), [92, 64, 48])
  if (kind === "finished") roofer(rgba, width, height)
  return encodeRgbaPng(width, height, rgba, 300)
}

function roofPlane(rgba: Uint8Array, width: number, height: number, ridge: number, eave: number, roof: RGB, kind: "finished" | "worn") {
  const mid = width / 2
  for (let y = ridge; y < eave; y += 1) {
    const t = (y - ridge) / (eave - ridge)
    const half = t * mid
    const left = Math.round(mid - half)
    const right = Math.round(mid + half)
    const shade = kind === "worn" ? 28 : 0
    for (let x = left; x < right; x += 1) {
      const course = Math.floor((y - ridge) / 14) % 2
      const gap = kind === "worn" && course === 0 && x % 90 < 18
      const color: RGB = gap ? [48, 46, 44] : [roof[0] + course * 8 - shade, roof[1] + course * 8 - shade, roof[2] + course * 6 - shade]
      set(rgba, width, x, y, color)
    }
  }
  void height
}

function roofer(rgba: Uint8Array, width: number, height: number) {
  const cx = Math.round(width * 0.5)
  const cy = Math.round(height * 0.16)
  const r = Math.round(height * 0.045)
  disc(rgba, width, cx, cy, r, [214, 176, 148])
  fillRect(rgba, width, cx - Math.round(width * 0.03), cy + r, Math.round(width * 0.06), Math.round(height * 0.12), [196, 92, 42])
}

function fill(rgba: Uint8Array, width: number, height: number, color: RGB) {
  for (let i = 0; i < width * height; i += 1) {
    const o = i * 4
    rgba[o] = color[0]
    rgba[o + 1] = color[1]
    rgba[o + 2] = color[2]
    rgba[o + 3] = 255
  }
}

function fillRect(rgba: Uint8Array, width: number, x: number, y: number, w: number, h: number, color: RGB) {
  const x0 = Math.max(0, x)
  const y0 = Math.max(0, y)
  const x1 = Math.min(width, x + w)
  const y1 = y + h
  for (let row = y0; row < y1; row += 1) {
    for (let col = x0; col < x1; col += 1) set(rgba, width, col, row, color)
  }
}

function disc(rgba: Uint8Array, width: number, cx: number, cy: number, r: number, color: RGB) {
  for (let y = cy - r; y <= cy + r; y += 1) {
    for (let x = cx - r; x <= cx + r; x += 1) {
      if ((x - cx) ** 2 + (y - cy) ** 2 <= r * r) set(rgba, width, x, y, color)
    }
  }
}

function set(rgba: Uint8Array, width: number, x: number, y: number, color: RGB) {
  if (x < 0 || y < 0 || x >= width) return
  const o = (y * width + x) * 4
  if (o < 0 || o + 3 >= rgba.length) return
  rgba[o] = clamp(color[0])
  rgba[o + 1] = clamp(color[1])
  rgba[o + 2] = clamp(color[2])
  rgba[o + 3] = 255
}

function clamp(value: number): number {
  return Math.max(0, Math.min(255, Math.round(value)))
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})

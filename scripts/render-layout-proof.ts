import { execFile } from "node:child_process"
import { mkdir, writeFile } from "node:fs/promises"
import path from "node:path"
import { promisify } from "node:util"

import { encodeRgbaPng } from "@/lib/print-spec/render-design-template-png"
import { renderStudioDesignPdf } from "@/lib/print-spec/render-template-postcard-pdf"
import { composeRoofingProCard } from "@/lib/roofing-pro/compose"
import type { RoofingProTemplateId } from "@/lib/roofing-pro/ids"

/**
 * Layout proof for crop, back color, and back variety.
 * Photographs are drawn here. No image API is called.
 *
 *   npx tsx scripts/render-layout-proof.ts
 */

const exec = promisify(execFile)
const OUT = process.env.LAYOUT_PROOF_OUT ?? "/tmp/layout-proof"
type RGB = readonly [number, number, number]

const W = 1600
const H = 900

async function main() {
  await mkdir(OUT, { recursive: true })
  const roof = servicePhoto("roof")
  const dental = servicePhoto("dental")
  const house = servicePhoto("house")
  const cards = [
    card("01-roof-fade", "roof_full_bleed", "roofing", "Hail dents hide in plain sight.", "We replace the damaged slope and haul the debris.", "$750 off a storm damage roof replacement", "Red River Storm Restoration", "(405) 555-0117", roof),
    card("02-roof-coupon", "roof_coupon", "roofing", "Storm season is coming in Houston. Is your roof ready?", "Hurricane season is coming. Get the new roof on before it does.", "$500 off a full roof replacement", "Bayou City Roofing", "(713) 555-0185", roof),
    card("03-roof-neighborhood", "roof_neighborhood", "roofing", "Missing shingles let the rain in.", "We fix the slope and leave the yard clean.", "$300 off any roof repair", "Tampa Bay Shield Roofing", "(813) 555-0153", roof),
    card("04-dental-fade", "roof_fade_offer", "dental", "Book the checkup you keep putting off.", "A cleaning, exam, and x-rays for new patients.", "$99 new patient exam, cleaning and x-rays", "Brightside Family Dental", "(919) 555-0163", dental),
    card("05-realty-fade", "roof_fade_offer", "real-estate-agents", "Thinking of selling? Start with the number.", "A written value and a plan for the prep.", "Free home value report plus $500 toward pre-listing repairs", "Harbor Point Realty", "(843) 555-0131", house),
  ]
  const pngs: string[] = []
  for (const item of cards) {
    const rendered = await renderStudioDesignPdf({
      card: composeRoofingProCard({
        templateId: item.template,
        spec: {
          headline: item.headline,
          subheadline: item.support,
          body: item.support,
          offer: item.offer,
          phone: item.phone,
          website: "example.com",
        },
        businessName: item.name,
        trade: item.trade,
        qrPayload: "https://example.com",
        license: item.trade === "roofing" ? "ROC 301442" : undefined,
      }),
      copy: {
        businessName: item.name,
        headline: item.headline,
        offer: item.offer,
        phone: item.phone,
        website: "example.com",
        qrPayload: "https://example.com",
        license: item.trade === "roofing" ? "ROC 301442" : undefined,
      },
      image: item.image,
      backImage: item.image,
    })
    const stem = path.join(OUT, item.id)
    await writeFile(`${stem}.pdf`, rendered.bytes)
    await exec("pdftoppm", ["-png", "-r", "80", `${stem}.pdf`, stem])
    await exec("mv", [`${stem}-1.png`, `${stem}-front.png`])
    await exec("mv", [`${stem}-2.png`, `${stem}-back.png`])
    pngs.push(`${stem}-front.png`, `${stem}-back.png`)
    console.log(item.id, item.template, item.trade)
  }
  const sheet = path.join(OUT, "sheet.py")
  await writeFile(sheet, SHEET)
  const ids = [...new Set(pngs.map((file) => path.basename(file).replace(/-front\.png|-back\.png/, "")))]
  await exec("python3", [sheet, OUT, ...ids])
}

function card(
  id: string,
  template: RoofingProTemplateId,
  trade: string,
  headline: string,
  support: string,
  offer: string,
  name: string,
  phone: string,
  image: { bytes: Uint8Array; width: number; height: number }
) {
  return { id, template, trade, headline, support, offer, name, phone, image }
}

function servicePhoto(kind: "roof" | "dental" | "house") {
  const rgba = new Uint8Array(W * H * 4)
  if (kind === "dental") {
    fill(rgba, [232, 214, 196])
    fillRect(rgba, 0, Math.round(H * 0.42), W, H, [186, 168, 150])
    head(rgba, 0.4, [214, 170, 140])
    head(rgba, 0.6, [196, 150, 124])
    fillRect(rgba, Math.round(W * 0.46), Math.round(H * 0.34), Math.round(W * 0.08), Math.round(H * 0.08), [120, 190, 180])
  } else if (kind === "house") {
    fill(rgba, [150, 196, 224])
    fillRect(rgba, 0, Math.round(H * 0.22), W, Math.round(H * 0.24), [90, 96, 104])
    fillRect(rgba, Math.round(W * 0.18), Math.round(H * 0.44), Math.round(W * 0.64), Math.round(H * 0.4), [228, 220, 206])
    fillRect(rgba, Math.round(W * 0.08), Math.round(H * 0.62), Math.round(W * 0.04), Math.round(H * 0.18), [240, 240, 236])
  } else {
    fill(rgba, [126, 186, 224])
    fillRect(rgba, 0, Math.round(H * 0.34), W, Math.round(H * 0.3), [74, 78, 86])
    for (let n = 0; n < 5; n += 1) {
      fillRect(rgba, Math.round(W * (0.22 + n * 0.1)), Math.round(H * 0.4), Math.round(W * 0.035), Math.round(H * 0.05), [36, 34, 32])
    }
    fillRect(rgba, 0, Math.round(H * 0.64), W, H, [214, 206, 190])
    head(rgba, 0.5, [214, 176, 148])
    fillRect(rgba, Math.round(W * 0.47), Math.round(H * 0.28), Math.round(W * 0.06), Math.round(H * 0.14), [32, 78, 140])
    fillRect(rgba, Math.round(W * 0.56), Math.round(H * 0.3), Math.round(W * 0.05), Math.round(H * 0.015), [40, 40, 40])
  }
  return { bytes: encodeRgbaPng(W, H, rgba, 300), width: W, height: H }
}

/** Face disc inside the layout head box (x 0.28–0.72, y 0.03–0.29), centered on `x`. */
function head(rgba: Uint8Array, x: number, color: RGB) {
  disc(rgba, Math.round(W * x), Math.round(H * 0.14), Math.round(H * 0.07), color)
}

function fill(rgba: Uint8Array, color: RGB) {
  for (let i = 0; i < W * H; i += 1) {
    const o = i * 4
    rgba[o] = color[0]
    rgba[o + 1] = color[1]
    rgba[o + 2] = color[2]
    rgba[o + 3] = 255
  }
}

function fillRect(rgba: Uint8Array, x: number, y: number, w: number, h: number, color: RGB) {
  const x0 = Math.max(0, x)
  const y0 = Math.max(0, y)
  const x1 = Math.min(W, x + w)
  const y1 = Math.min(H, y + h)
  for (let row = y0; row < y1; row += 1) {
    for (let col = x0; col < x1; col += 1) set(rgba, col, row, color)
  }
}

function disc(rgba: Uint8Array, cx: number, cy: number, r: number, color: RGB) {
  for (let y = cy - r; y <= cy + r; y += 1) {
    for (let x = cx - r; x <= cx + r; x += 1) {
      if ((x - cx) ** 2 + (y - cy) ** 2 <= r * r) set(rgba, x, y, color)
    }
  }
}

function set(rgba: Uint8Array, x: number, y: number, color: RGB) {
  if (x < 0 || y < 0 || x >= W || y >= H) return
  const o = (y * W + x) * 4
  rgba[o] = color[0]
  rgba[o + 1] = color[1]
  rgba[o + 2] = color[2]
  rgba[o + 3] = 255
}

void main()

const SHEET = String.raw`
import sys
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
out = Path(sys.argv[1])
ids = []
for name in sys.argv[2:]:
    if name not in ids:
        ids.append(name)
labels = {
    "01-roof-fade": "Roofing damage, full-bleed. Back reuses the photo. Head stays on the card. Navy field, yellow offer.",
    "02-roof-coupon": "Roofing coupon. Front keeps the head above the offer bar. Back is text-led, not a second crop.",
    "03-roof-neighborhood": "Neighborhood front. Text-led back: headline, support, offer, phone. No photo clone.",
    "04-dental-fade": "Dental fade. Trade mint offer and teal band stay. The photo veil does not turn skin yellow-green.",
    "05-realty-fade": "Real-estate scene. No person, so the back may still drop sky. House stays the subject.",
}
font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 22)
pages = [ids[:3], ids[3:]]
for pi, group in enumerate(pages, 1):
    sheet = Image.new("RGB", (1700, 2200), "white")
    draw = ImageDraw.Draw(sheet)
    draw.text((36, 24), "Layout proof — stand-in drawings, zero image spend. Front left, back right.", fill=(20, 20, 20), font=font)
    y = 70
    for name in group:
        draw.text((36, y), labels.get(name, name), fill=(20, 20, 20), font=font)
        y += 22
        front = Image.open(out / f"{name}-front.png")
        back = Image.open(out / f"{name}-back.png")
        box = (780, 500)
        front.thumbnail(box)
        back.thumbnail(box)
        sheet.paste(front, (36, y))
        sheet.paste(back, (36 + front.width + 24, y))
        y += max(front.height, back.height) + 28
    sheet.save(out / f"review-sheet-{pi}.png", quality=90)
    sheet.save(out / f"review-sheet-{pi}.pdf", "PDF", resolution=120)
print("sheets", len(pages))
`

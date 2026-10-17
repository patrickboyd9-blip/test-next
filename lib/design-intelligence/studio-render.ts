import { spawn, type ChildProcess } from "node:child_process"
import { readFileSync } from "node:fs"
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises"
import os from "node:os"
import path from "node:path"

import type { PostcardFacePlan } from "@/lib/postcard-layouts/compose"
import { lineHeightFor } from "@/lib/postcard-layouts/typefit"
import { paintQr } from "@/lib/campaign-creator/studio-qr"

import { trimInches } from "./grid-composer"
import { standInCutoutPng } from "./cutout"
import { standInPhotoJpeg } from "./stand-in-photo"
import { studioShapeLayer } from "./studio-layer"
import type { TrimSize } from "./rationale"

/**
 * Renders the same card Studio paints: Archivo / Source Sans / Fraunces,
 * the stand-in photograph, and the type panel in front of that photograph.
 * 300 pixels per inch, which is the print file.
 */

export const PRINT_PPI = 300

const FONTS = {
  display: path.join(process.cwd(), "lib/print-spec/fonts/Archivo-ExtraBold.ttf"),
  signal: path.join(process.cwd(), "lib/print-spec/fonts/BarlowCondensed-Bold.ttf"),
  letter: path.join(process.cwd(), "lib/print-spec/fonts/Fraunces-Semibold.ttf"),
  text: path.join(process.cwd(), "lib/print-spec/fonts/SourceSans3-Semibold.ttf"),
}

export function printPixels(size: TrimSize, ppi = PRINT_PPI): { width: number; height: number } {
  const scale = Math.max(36, Math.min(PRINT_PPI, Math.round(ppi)))
  const trim = trimInches(size)
  return { width: Math.round(trim.w * scale), height: Math.round(trim.h * scale) }
}

export async function renderStudioCardPng(
  plan: PostcardFacePlan,
  qrPayload: string,
  options?: { ppi?: number }
): Promise<Buffer> {
  const size = printPixels(plan.size, options?.ppi)
  const directory = await mkdtemp(path.join(os.tmpdir(), "studio-card-"))
  const htmlPath = path.join(directory, "card.html")
  const pngPath = path.join(directory, "card.png")
  try {
    await writeFile(htmlPath, cardHtml(plan, qrPayload, options?.ppi), "utf8")
    await runChrome(htmlPath, pngPath, size.width, size.height)
    const png = await readFile(pngPath)
    const actual = pngSize(png)
    if (actual.width !== size.width || actual.height !== size.height) {
      throw new Error(`Studio render is ${actual.width}×${actual.height}. Print size for ${plan.size} is ${size.width}×${size.height}.`)
    }
    return png
  } finally {
    await removeDirectory(directory)
  }
}

function cardHtml(plan: PostcardFacePlan, qrPayload: string, ppi?: number): string {
  const trim = trimInches(plan.size)
  const size = printPixels(plan.size, ppi)
  const photo = standInPhotoJpeg().toString("base64")
  const cutout = standInCutoutPng().toString("base64")
  const displayFamily = plan.pairing === "letter" ? "Fraunces" : plan.pairing === "signal" ? "Barlow Condensed" : "Archivo"
  const parts: string[] = []
  for (const shape of plan.shapes.filter((item) => studioShapeLayer(item.role) === "back")) {
    parts.push(shapeDiv(shape.rect, trim, shape.fill, shape.role))
  }
  for (const slot of plan.photos) {
    if (slot.treatment === "cutout") {
      parts.push(
        `<img alt="Stand-in cut-out" src="data:image/png;base64,${cutout}" style="${box(slot.rect, trim)}object-fit:contain;object-position:left center;" />`
      )
    } else {
      parts.push(
        `<img alt="Stand-in photo" src="data:image/jpeg;base64,${photo}" style="${box(slot.rect, trim)}object-fit:cover;" />`
      )
    }
  }
  for (const shape of plan.shapes.filter((item) => studioShapeLayer(item.role) === "mid")) {
    if (shape.role === "scrim") {
      parts.push(
        `<div style="${box(shape.rect, trim)}background:linear-gradient(to bottom, transparent 0%, ${withAlpha(plan.palette.scrim, 0.5)} 30%, ${withAlpha(plan.palette.scrim, 0.9)} 68%, ${withAlpha(plan.palette.scrim, 0.94)} 100%);"></div>`
      )
    } else {
      parts.push(shapeDiv(shape.rect, trim, shape.fill, shape.role))
    }
  }
  for (const shape of plan.shapes.filter((item) => studioShapeLayer(item.role) === "front")) {
    parts.push(shapeDiv(shape.rect, trim, shape.fill, shape.role))
  }
  for (const text of plan.texts) {
    if (!text.text.trim() || text.lines.length === 0) continue
    const family = text.font === "display" ? displayFamily : "Source Sans 3"
    const weight = text.font === "display" ? 800 : 600
    const lineHeight = text.role === "offer" ? 0.8 : lineHeightFor(text.font)
    const lines = text.lines.map((line) => `<span style="display:block">${escapeHtml(line)}</span>`).join("")
    parts.push(
      `<p style="${box(text.rect, trim)}margin:0;color:${text.color};font-family:'${family}',sans-serif;font-weight:${weight};font-size:${pointsToCqw(text.fontPt, trim.w)};line-height:${lineHeight};letter-spacing:${text.font === "display" ? "-0.03em" : "0"};text-align:${text.align};">${lines}</p>`
    )
  }
  const lockup = plan.lockup
  if (lockup?.phone?.text) {
    parts.push(
      `<p style="${box(lockup.phone.rect, trim)}margin:0;color:${lockup.phone.color};font-family:'Source Sans 3',sans-serif;font-weight:600;font-size:${pointsToCqw(lockup.phone.fontPt, trim.w)};line-height:1;">${escapeHtml(lockup.phone.text)}</p>`
    )
  }
  if (lockup?.website?.text) {
    parts.push(
      `<p style="${box(lockup.website.rect, trim)}margin:0;color:${lockup.website.color};font-family:'Source Sans 3',sans-serif;font-weight:600;font-size:${pointsToCqw(lockup.website.fontPt, trim.w)};line-height:1.1;">${escapeHtml(lockup.website.text)}</p>`
    )
  }
  if (lockup && qrPayload.trim()) {
    parts.push(qrMarkup(lockup.qrRect, trim, qrPayload, lockup.qrLabel, lockup.qrLabelPt))
  }
  return `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<style>
  ${fontFaceCss()}
  html, body { margin: 0; width: ${size.width}px; height: ${size.height}px; overflow: hidden; background: ${plan.palette.paper}; }
  #card { position: relative; width: ${size.width}px; height: ${size.height}px; overflow: hidden; container-type: inline-size; background: ${plan.palette.paper}; }
  #card * { box-sizing: border-box; }
</style>
</head>
<body><div id="card" data-fonts="${escapeHtml(fontQueries(plan).join("|"))}">${parts.join("")}</div></body>
</html>`
}

function qrMarkup(
  rect: { x: number; y: number; w: number; h: number },
  trim: { w: number; h: number },
  payload: string,
  label: string,
  labelPt: number
): string {
  const painted = paintQr(payload)
  if (!painted) return ""
  const total = painted.modules + painted.quiet * 2
  const cells = painted.dark
    .map(([x, y]) => `<rect x="${x + painted.quiet}" y="${y + painted.quiet}" width="1" height="1" fill="#111111"/>`)
    .join("")
  return `<div style="${box(rect, trim)}background:#ffffff;display:flex;flex-direction:column;">
    <svg viewBox="0 0 ${total} ${total}" style="width:100%;height:78%;display:block;">
      <rect width="${total}" height="${total}" fill="#ffffff"/>${cells}
    </svg>
    <div style="background:#ffffff;color:#14120f;text-align:center;font-family:'Source Sans 3',sans-serif;font-weight:600;font-size:${pointsToCqw(labelPt, trim.w)};line-height:1;">${escapeHtml(label)}</div>
  </div>`
}

function shapeDiv(rect: { x: number; y: number; w: number; h: number }, trim: { w: number; h: number }, fill: string, role: string): string {
  return `<div data-role="${role}" style="${box(rect, trim)}background:${fill};"></div>`
}

function box(rect: { x: number; y: number; w: number; h: number }, trim: { w: number; h: number }): string {
  return `position:absolute;left:${pct(rect.x, trim.w)};top:${pct(rect.y, trim.h)};width:${pct(rect.w, trim.w)};height:${pct(rect.h, trim.h)};`
}

function pct(value: number, total: number): string {
  return `${((value / total) * 100).toFixed(4)}%`
}

function pointsToCqw(points: number, trimWidth: number): string {
  return `${((points / 72) * (100 / trimWidth)).toFixed(3)}cqw`
}

function withAlpha(hex: string, alpha: number): string {
  const value = hex.replace("#", "")
  const r = Number.parseInt(value.slice(0, 2), 16)
  const g = Number.parseInt(value.slice(2, 4), 16)
  const b = Number.parseInt(value.slice(4, 6), 16)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
}

function pngSize(bytes: Buffer): { width: number; height: number } {
  if (bytes.length < 24 || bytes[0] !== 0x89) return { width: 0, height: 0 }
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) }
}

let cachedFontCss: string | null = null

function fontQueries(plan: PostcardFacePlan): string[] {
  const display = plan.pairing === "letter" ? "600 48px Fraunces" : plan.pairing === "signal" ? "700 48px 'Barlow Condensed'" : "800 48px Archivo"
  return [display, "600 16px 'Source Sans 3'"]
}

function fontFaceCss(): string {
  if (cachedFontCss) return cachedFontCss
  const face = (family: string, file: string, weight: number) => {
    const data = readFileSync(file).toString("base64")
    return `@font-face { font-family: "${family}"; src: url("data:font/ttf;base64,${data}") format("truetype"); font-weight: ${weight}; font-display: block; }`
  }
  cachedFontCss = [
    face("Archivo", FONTS.display, 800),
    face("Barlow Condensed", FONTS.signal, 700),
    face("Fraunces", FONTS.letter, 600),
    face("Source Sans 3", FONTS.text, 600),
  ].join("\n")
  return cachedFontCss
}

/**
 * Headless Chrome on this machine writes a screenshot and then stays up,
 * so the capture goes through the devtools protocol and the process is stopped after.
 */
function runChrome(htmlPath: string, pngPath: string, width: number, height: number): Promise<void> {
  const profile = path.join(path.dirname(htmlPath), "chrome-profile")
  const args = [
    "--headless=new",
    "--disable-gpu",
    "--no-sandbox",
    "--no-first-run",
    "--disable-extensions",
    "--disable-dev-shm-usage",
    "--disable-background-networking",
    "--hide-scrollbars",
    "--force-device-scale-factor=1",
    `--user-data-dir=${profile}`,
    `--window-size=${width},${height}`,
    "--remote-debugging-port=0",
    `file://${htmlPath}`,
  ]
  return new Promise((resolve, reject) => {
    const child = spawn("google-chrome", args, { stdio: ["ignore", "pipe", "pipe"], detached: true })
    let settled = false
    let started = false
    let buffer = ""
    const finish = (error?: Error) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      stopChrome(child)
      if (error) reject(error)
      else resolve()
    }
    const timer = setTimeout(() => finish(new Error("Chrome timed out while rendering a postcard.")), 30000)
    child.on("error", (error) => finish(error))
    const log = (chunk: Buffer) => {
      if (started || settled) return
      buffer += chunk.toString()
      const match = /DevTools listening on ws:\/\/127\.0\.0\.1:(\d+)\//.exec(buffer)
      if (!match) return
      started = true
      capturePostcard(Number(match[1]), width, height)
        .then((png) => writeFile(pngPath, png))
        .then(() => finish())
        .catch((error: unknown) => finish(error instanceof Error ? error : new Error("Chrome capture failed.")))
    }
    child.stderr?.on("data", log)
    child.stdout?.on("data", log)
  })
}

async function capturePostcard(port: number, width: number, height: number): Promise<Buffer> {
  const page = await pageSocket(port)
  const ws = new WebSocket(page)
  await new Promise<void>((resolve, reject) => {
    ws.addEventListener("open", () => resolve())
    ws.addEventListener("error", () => reject(new Error("Could not connect to Chrome.")))
  })
  try {
    await cdp(ws, "Emulation.setDeviceMetricsOverride", {
      width,
      height,
      deviceScaleFactor: 1,
      mobile: false,
    })
    await cdp(ws, "Runtime.evaluate", {
      expression: `(async () => {
        const queries = (document.getElementById("card")?.dataset.fonts ?? "").split("|").filter(Boolean)
        await Promise.all(queries.map((query) => document.fonts.load(query).catch(() => [])))
        await document.fonts.ready
        const missing = queries.filter((query) => !document.fonts.check(query))
        if (missing.length > 0) throw new Error("Studio fonts did not load: " + missing.join(", "))
        return true
      })()`,
      awaitPromise: true,
    })
    const shot = await cdp(ws, "Page.captureScreenshot", {
      format: "png",
      fromSurface: true,
      captureBeyondViewport: false,
    })
    const data = shot.data
    if (typeof data !== "string" || data.length === 0) throw new Error("Chrome returned an empty postcard.")
    return Buffer.from(data, "base64")
  } finally {
    ws.close()
  }
}

async function pageSocket(port: number): Promise<string> {
  for (let attempt = 0; attempt < 40; attempt++) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/json/list`)
      const pages = (await response.json()) as Array<{ type?: string; webSocketDebuggerUrl?: string }>
      const page = pages.find((item) => item.type === "page" && item.webSocketDebuggerUrl)
      if (page?.webSocketDebuggerUrl) return page.webSocketDebuggerUrl
    } catch {
      // Chrome is still opening the port.
    }
    await new Promise((resolve) => setTimeout(resolve, 100))
  }
  throw new Error("Chrome did not open a page to render.")
}

function cdp(ws: WebSocket, method: string, params: Record<string, unknown>): Promise<{ data?: string }> {
  const id = Math.floor(Math.random() * 1_000_000)
  return new Promise((resolve, reject) => {
    const onMessage = (event: MessageEvent) => {
      const message = JSON.parse(String(event.data)) as {
        id?: number
        result?: { data?: string; exceptionDetails?: { text?: string; exception?: { description?: string } } }
        error?: { message?: string }
      }
      if (message.id !== id) return
      ws.removeEventListener("message", onMessage)
      if (message.error) reject(new Error(message.error.message ?? "Chrome capture failed."))
      else if (message.result?.exceptionDetails) {
        reject(new Error(message.result.exceptionDetails.exception?.description ?? message.result.exceptionDetails.text ?? "Chrome capture failed."))
      } else resolve(message.result ?? {})
    }
    ws.addEventListener("message", onMessage)
    ws.send(JSON.stringify({ id, method, params }))
  })
}

function stopChrome(child: ChildProcess) {
  if (!child.pid) return
  try {
    process.kill(-child.pid, "SIGKILL")
  } catch {
    child.kill("SIGKILL")
  }
}

async function removeDirectory(directory: string) {
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      await rm(directory, { recursive: true, force: true })
      return
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 150))
    }
  }
}

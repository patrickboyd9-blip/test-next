import {
  decodePDFRawStream,
  PDFArray,
  PDFDict,
  PDFContext,
  PDFDocument,
  PDFName,
  PDFNumber,
  PDFRawStream,
  PDFStream,
} from "pdf-lib"

import type { PostcardGeometry } from "@/lib/print-spec/postcard-5x8-print-spec"

import { decodeRaster } from "./decode-raster"

export interface PdfPlacement {
  x: number
  y: number
  width: number
  height: number
}

export interface PdfImageInfo {
  width: number
  height: number
  ppiX: number | null
  ppiY: number | null
  placement: PdfPlacement | null
  rgba: Uint8Array | null
  coversKeepOut: boolean
  undecoded: boolean
}

export interface PdfInspection {
  pageCount: number
  widthPoints: number
  heightPoints: number
  unembeddedFonts: string[]
  images: PdfImageInfo[]
  keepOutHasMarks: boolean
  keepOutUnchecked: boolean
}

interface Matrix {
  a: number
  b: number
  c: number
  d: number
  e: number
  f: number
}

const IDENTITY: Matrix = { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 }

export async function inspectPdf(
  bytes: Uint8Array,
  geometry: PostcardGeometry,
  face: "front" | "back"
): Promise<PdfInspection> {
  const doc = await PDFDocument.load(bytes, { ignoreEncryption: true })
  const pages = doc.getPages()
  const page = pages[0]
  if (!page) {
    return {
      pageCount: 0,
      widthPoints: 0,
      heightPoints: 0,
      unembeddedFonts: [],
      images: [],
      keepOutHasMarks: false,
      keepOutUnchecked: false,
    }
  }

  const media = page.getMediaBox()
  const resources = page.node.Resources()
  const content = pageContent(page.node.Contents(), page.node.context)
  const placements = imagePlacements(content)
  const images = resources ? readImages(resources, placements) : []
  for (const image of images) {
    if (image.placement && rectHitsKeepOut(image.placement, geometry)) {
      image.coversKeepOut = true
    }
  }
  const vectorMarks = face === "back" && vectorTouchesKeepOut(content, geometry)
  const imageMarks =
    face === "back" &&
    images.some((image) => image.rgba && imageInkInKeepOut(image, geometry))
  const unchecked =
    face === "back" &&
    images.some((image) => image.undecoded && image.coversKeepOut)

  return {
    pageCount: pages.length,
    widthPoints: media.width,
    heightPoints: media.height,
    unembeddedFonts: resources ? unembeddedFontNames(resources) : [],
    images,
    keepOutHasMarks: vectorMarks || imageMarks,
    keepOutUnchecked: unchecked && !imageMarks && !vectorMarks,
  }
}

function pageContent(contents: PDFStream | PDFArray | undefined, context: PDFContext): string {
  if (!contents) return ""
  const parts = contents instanceof PDFArray ? contents.asArray() : [contents]
  return parts
    .map((part) => {
      const stream = part instanceof PDFStream ? part : context.lookup(part)
      if (!(stream instanceof PDFRawStream)) return ""
      try {
        return Buffer.from(decodePDFRawStream(stream).decode()).toString("latin1")
      } catch {
        return Buffer.from(stream.contents).toString("latin1")
      }
    })
    .join("\n")
}

function readImages(resources: PDFDict, placements: Map<string, PdfPlacement>): PdfImageInfo[] {
  const xobjects = resources.lookupMaybe(PDFName.of("XObject"), PDFDict)
  if (!xobjects) return []
  const images: PdfImageInfo[] = []
  for (const [name, object] of xobjects.entries()) {
    const stream = object instanceof PDFRawStream ? object : xobjects.lookup(name)
    if (!(stream instanceof PDFRawStream)) continue
    const subtype = stream.dict.lookupMaybe(PDFName.of("Subtype"), PDFName)
    if (!subtype || plainName(subtype) !== "Image") continue
    const width = numberOf(stream.dict, "Width")
    const height = numberOf(stream.dict, "Height")
    if (!width || !height) continue
    const placement = placements.get(plainName(name)) ?? null
    const ppiX = placement && placement.width > 0 ? width / (placement.width / 72) : null
    const ppiY = placement && placement.height > 0 ? height / (placement.height / 72) : null
    const decoded = decodeImageStream(stream)
    images.push({
      width,
      height,
      ppiX,
      ppiY,
      placement,
      rgba: decoded,
      coversKeepOut: false,
      undecoded: decoded === null,
    })
  }
  return images
}

function decodeImageStream(stream: PDFRawStream): Uint8Array | null {
  const filter = stream.dict.lookup(PDFName.of("Filter"))
  const filterName = filter instanceof PDFName ? plainName(filter) : ""
  if (filterName === "DCTDecode") {
    const jpeg = decodeRaster(stream.contents, "jpeg")
    return jpeg?.rgba ?? null
  }
  try {
    const raw = decodePDFRawStream(stream).decode()
    const width = numberOf(stream.dict, "Width")
    const height = numberOf(stream.dict, "Height")
    const color = stream.dict.lookupMaybe(PDFName.of("ColorSpace"), PDFName)
    if (!width || !height || !color) return null
    const channels = plainName(color) === "DeviceRGB" ? 3 : plainName(color) === "DeviceGray" ? 1 : 0
    if (!channels || raw.length < width * height * channels) return null
    const rgba = new Uint8Array(width * height * 4)
    for (let index = 0; index < width * height; index += 1) {
      const source = index * channels
      const target = index * 4
      if (channels === 1) {
        const gray = raw[source] ?? 0
        rgba[target] = gray
        rgba[target + 1] = gray
        rgba[target + 2] = gray
      } else {
        rgba[target] = raw[source] ?? 0
        rgba[target + 1] = raw[source + 1] ?? 0
        rgba[target + 2] = raw[source + 2] ?? 0
      }
      rgba[target + 3] = 255
    }
    return rgba
  } catch {
    return null
  }
}

function unembeddedFontNames(resources: PDFDict): string[] {
  const fonts = resources.lookupMaybe(PDFName.of("Font"), PDFDict)
  if (!fonts) return []
  const names: string[] = []
  for (const [key] of fonts.entries()) {
    const font = fonts.lookupMaybe(key, PDFDict)
    if (!font) continue
    if (!fontIsEmbedded(font)) names.push(fontLabel(font))
  }
  return names
}

function fontIsEmbedded(font: PDFDict): boolean {
  const subtype = font.lookupMaybe(PDFName.of("Subtype"), PDFName)
  const subtypeName = subtype ? plainName(subtype) : ""
  if (subtypeName === "Type3") return true
  if (subtypeName === "Type0") {
    const kids = font.lookupMaybe(PDFName.of("DescendantFonts"), PDFArray)
    if (!kids || kids.size() === 0) return false
    const child = kids.lookup(0, PDFDict)
    return descriptorHasFile(child)
  }
  return descriptorHasFile(font)
}

function descriptorHasFile(font: PDFDict): boolean {
  const descriptor = font.lookupMaybe(PDFName.of("FontDescriptor"), PDFDict)
  if (!descriptor) return false
  return (
    descriptor.has(PDFName.of("FontFile")) ||
    descriptor.has(PDFName.of("FontFile2")) ||
    descriptor.has(PDFName.of("FontFile3"))
  )
}

function fontLabel(font: PDFDict): string {
  const baseName = font.lookupMaybe(PDFName.of("BaseFont"), PDFName)
  if (!baseName) return "a font"
  return plainName(baseName).replace(/^[A-Z]{6}\+/, "").replace(/-/g, " ")
}

function plainName(name: PDFName): string {
  const text = name.asString()
  return text.startsWith("/") ? text.slice(1) : text
}

function numberOf(dict: PDFDict, key: string): number | null {
  const value = dict.lookupMaybe(PDFName.of(key), PDFNumber)
  return value ? value.asNumber() : null
}

function imagePlacements(content: string): Map<string, PdfPlacement> {
  const tokens = tokenize(content)
  const placements = new Map<string, PdfPlacement>()
  const stack: Matrix[] = []
  let current = { ...IDENTITY }
  const numbers: number[] = []
  let name: string | null = null

  for (const token of tokens) {
    if (token.startsWith("/")) {
      name = token.slice(1)
      numbers.length = 0
      continue
    }
    const numeric = Number(token)
    if (token !== "cm" && token !== "Do" && Number.isFinite(numeric) && /^-?\d/.test(token)) {
      numbers.push(numeric)
      if (numbers.length > 6) numbers.shift()
      continue
    }
    if (token === "q") {
      stack.push(current)
      current = { ...current }
    } else if (token === "Q") {
      current = stack.pop() ?? { ...IDENTITY }
    } else if (token === "cm" && numbers.length >= 6) {
      const [a, b, c, d, e, f] = numbers.slice(-6) as [number, number, number, number, number, number]
      current = multiply({ a, b, c, d, e, f }, current)
    } else if (token === "Do" && name) {
      placements.set(name, {
        x: current.e,
        y: current.f,
        width: Math.abs(current.a),
        height: Math.abs(current.d),
      })
    }
    if (token !== "cm") numbers.length = 0
  }
  return placements
}

function multiply(next: Matrix, current: Matrix): Matrix {
  return {
    a: next.a * current.a + next.b * current.c,
    b: next.a * current.b + next.b * current.d,
    c: next.c * current.a + next.d * current.c,
    d: next.c * current.b + next.d * current.d,
    e: next.e * current.a + next.f * current.c + current.e,
    f: next.e * current.b + next.f * current.d + current.f,
  }
}

function vectorTouchesKeepOut(content: string, geometry: PostcardGeometry): boolean {
  const tokens = tokenize(content)
  let fill = { r: 0, g: 0, b: 0 }
  let rect: { x: number; y: number; width: number; height: number } | null = null
  let textX = 0
  let textY = 0
  const numbers: number[] = []

  const pushNumber = (token: string) => {
    const numeric = Number(token)
    if (Number.isFinite(numeric) && /^-?\d/.test(token)) {
      numbers.push(numeric)
      if (numbers.length > 6) numbers.shift()
      return true
    }
    return false
  }

  for (const token of tokens) {
    if (token.startsWith("/")) {
      numbers.length = 0
      continue
    }
    if (pushNumber(token)) continue
    if (token === "rg" && numbers.length >= 3) {
      const [r, g, b] = numbers.slice(-3)
      fill = { r: r ?? 0, g: g ?? 0, b: b ?? 0 }
    } else if (token === "re" && numbers.length >= 4) {
      const [x, y, width, height] = numbers.slice(-4)
      rect = { x: x ?? 0, y: y ?? 0, width: width ?? 0, height: height ?? 0 }
    } else if ((token === "f" || token === "F" || token === "b" || token === "B") && rect) {
      if (!isNearWhite(fill.r, fill.g, fill.b) && rectHitsKeepOut(rect, geometry)) return true
    } else if (token === "Tm" && numbers.length >= 6) {
      textX = numbers[numbers.length - 2] ?? 0
      textY = numbers[numbers.length - 1] ?? 0
    } else if (token === "Td" && numbers.length >= 2) {
      textX += numbers[numbers.length - 2] ?? 0
      textY += numbers[numbers.length - 1] ?? 0
    } else if (token === "Tj" || token === "TJ") {
      if (pointInKeepOut(textX, textY, geometry)) return true
    }
    numbers.length = 0
  }
  return false
}

function rectHitsKeepOut(
  rect: { x: number; y: number; width: number; height: number },
  geometry: PostcardGeometry
): boolean {
  const left = Math.min(rect.x, rect.x + rect.width)
  const right = Math.max(rect.x, rect.x + rect.width)
  const bottom = Math.min(rect.y, rect.y + rect.height)
  const top = Math.max(rect.y, rect.y + rect.height)
  return geometry.keepOuts.some((keepOut) => {
    const zoneRight = keepOut.pdf.xPoints + keepOut.pdf.widthPoints
    const zoneTop = keepOut.pdf.yPoints + keepOut.pdf.heightPoints
    return left < zoneRight && right > keepOut.pdf.xPoints && bottom < zoneTop && top > keepOut.pdf.yPoints
  })
}

function pointInKeepOut(x: number, y: number, geometry: PostcardGeometry): boolean {
  return geometry.keepOuts.some(
    (keepOut) =>
      x >= keepOut.pdf.xPoints &&
      x <= keepOut.pdf.xPoints + keepOut.pdf.widthPoints &&
      y >= keepOut.pdf.yPoints &&
      y <= keepOut.pdf.yPoints + keepOut.pdf.heightPoints
  )
}

function imageInkInKeepOut(image: PdfImageInfo, geometry: PostcardGeometry): boolean {
  if (!image.rgba || !image.placement) return false
  const place = image.placement
  if (place.width < 1 || place.height < 1) return false
  let ink = 0
  for (const keepOut of geometry.keepOuts) {
    const left = Math.max(keepOut.pdf.xPoints, place.x)
    const right = Math.min(keepOut.pdf.xPoints + keepOut.pdf.widthPoints, place.x + place.width)
    const bottom = Math.max(keepOut.pdf.yPoints, place.y)
    const top = Math.min(keepOut.pdf.yPoints + keepOut.pdf.heightPoints, place.y + place.height)
    if (right <= left || top <= bottom) continue
    const startX = Math.floor(((left - place.x) / place.width) * image.width)
    const endX = Math.ceil(((right - place.x) / place.width) * image.width)
    const startY = Math.floor(((place.y + place.height - top) / place.height) * image.height)
    const endY = Math.ceil(((place.y + place.height - bottom) / place.height) * image.height)
    const step = Math.max(1, Math.floor(Math.min(image.width, image.height) / 400))
    for (let y = Math.max(0, startY); y < Math.min(image.height, endY); y += step) {
      for (let x = Math.max(0, startX); x < Math.min(image.width, endX); x += step) {
        const index = (y * image.width + x) * 4
        const alpha = image.rgba[index + 3] ?? 255
        if (alpha < 20) continue
        if (!isNearWhite(image.rgba[index] ?? 255, image.rgba[index + 1] ?? 255, image.rgba[index + 2] ?? 255)) {
          ink += 1
          if (ink >= 8) {
            image.coversKeepOut = true
            return true
          }
        }
      }
    }
  }
  return false
}

/** Paper white and a light cream count as empty. A real mark is darker than this. */
export function isNearWhite(red: number, green: number, blue: number): boolean {
  return red >= 230 && green >= 230 && blue >= 230
}

function tokenize(content: string): string[] {
  const tokens: string[] = []
  let index = 0
  while (index < content.length) {
    const character = content[index] ?? ""
    if (character === "%") {
      while (index < content.length && content[index] !== "\n") index += 1
      continue
    }
    if (character === "(") {
      index += 1
      let depth = 1
      while (index < content.length && depth > 0) {
        if (content[index] === "\\") {
          index += 2
          continue
        }
        if (content[index] === "(") depth += 1
        else if (content[index] === ")") depth -= 1
        index += 1
      }
      tokens.push("Tj")
      continue
    }
    if (character === "<") {
      if (content[index + 1] === "<") {
        index += 2
        let depth = 1
        while (index < content.length && depth > 0) {
          if (content[index] === "<" && content[index + 1] === "<") {
            depth += 1
            index += 2
            continue
          }
          if (content[index] === ">" && content[index + 1] === ">") {
            depth -= 1
            index += 2
            continue
          }
          index += 1
        }
        continue
      }
      const end = content.indexOf(">", index)
      index = end === -1 ? content.length : end + 1
      continue
    }
    if (/\s/.test(character) || character === "[" || character === "]") {
      index += 1
      continue
    }
    if (character === "/") {
      let end = index + 1
      while (end < content.length && /[^\s<>[\]()/%]/.test(content[end] ?? "")) end += 1
      tokens.push(content.slice(index, end))
      index = end
      continue
    }
    if (/[0-9.+-]/.test(character)) {
      let end = index + 1
      while (end < content.length && /[0-9.eE+-]/.test(content[end] ?? "")) end += 1
      tokens.push(content.slice(index, end))
      index = end
      continue
    }
    let end = index + 1
    while (end < content.length && /[A-Za-z*]/.test(content[end] ?? "")) end += 1
    tokens.push(content.slice(index, end))
    index = end
  }
  return tokens
}

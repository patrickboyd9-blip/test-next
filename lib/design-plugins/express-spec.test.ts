import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { createRequire } from "node:module"
import { test } from "node:test"

import { buildPostcard5x8PrintSpec } from "@/lib/print-spec/postcard-5x8-print-spec"
import { buildPostcard6x9PrintSpec } from "@/lib/print-spec/postcard-6x9-print-spec"

const require = createRequire(import.meta.url)
const spec = require("../../plugins/express/spec.js") as {
  PIXELS_PER_INCH: number
  POSTCARD_SIZES: Record<string, { page: { width: number; height: number }; address: { x: number; y: number; width: number; height: number } }>
  physicalInches: (w: number, h: number, ppi: number) => { width: number; height: number }
  reservedHits: (id: string, boxes: { x: number; y: number; width: number; height: number; guide?: boolean }[]) => string[]
}
const { createSandbox } = require("../../plugins/express/sandbox/code.js") as {
  createSandbox: (editor: FakeEditor, sizes: typeof spec.POSTCARD_SIZES) => {
    create: (id: string) => { width: number; height: number }
    hideGuides: () => void
    showGuides: () => void
    warnings: (id: string, page: { width: number; height: number; back?: boolean; pixelsPerInch?: number }, marks: { x: number; y: number; width: number; height: number; pixels: number; guide?: boolean }[]) => string[]
  }
}

type ChildList = Node[] & { append: (child: Node) => void }
type Node = { width?: number; height?: number; translation?: { x: number; y: number }; locked?: boolean; opacity?: number; parent?: Node; children: ChildList; removeFromParent: () => void }
type FakeEditor = {
  documentRoot: { pages: { addPage: (size: { width: number; height: number }) => { artboards: { first: Node } } } }
  createRectangle: () => Node
  createText: (value: string) => Node & { text: string }
}

test("Express pages match the print file at 300 pixels per inch", () => {
  const five = buildPostcard5x8PrintSpec()
  const six = buildPostcard6x9PrintSpec()
  const scale = spec.PIXELS_PER_INCH / 72
  assert.ok(Math.abs(spec.POSTCARD_SIZES["5x8"].page.width - five.pdfPagePoints.widthPoints * scale) < 0.01)
  assert.ok(Math.abs(spec.POSTCARD_SIZES["5x8"].page.height - five.pdfPagePoints.heightPoints * scale) < 0.01)
  assert.ok(Math.abs(spec.POSTCARD_SIZES["6x9"].page.width - six.pdfPagePoints.widthPoints * scale) < 0.01)
  assert.ok(Math.abs(spec.POSTCARD_SIZES["6x9"].page.height - six.pdfPagePoints.heightPoints * scale) < 0.01)
  const inches = spec.physicalInches(2550, 1650, 300)
  assert.equal(inches.width, 8.5)
  assert.equal(inches.height, 5.5)
})

test("Express guides are locked and leave the page before export", () => {
  const pages: Array<{ artboards: { first: Node } }> = []
  const editor: FakeEditor = {
    documentRoot: {
      pages: {
        addPage(size) {
          const artboard = node()
          artboard.width = size.width
          artboard.height = size.height
          const page = { artboards: { first: artboard } }
          pages.push(page)
          return page
        },
      },
    },
    createRectangle: () => node(),
    createText: (value) => Object.assign(node(), { text: value }),
  }
  const sandbox = createSandbox(editor, spec.POSTCARD_SIZES)
  const created = sandbox.create("5x8")
  assert.equal(created.width, 2550)
  assert.equal(created.height, 1650)
  assert.equal(pages.length, 2)
  const back = pages[1].artboards.first
  assert.ok(back.children.some((child) => child.locked))
  const before = back.children.length
  sandbox.hideGuides()
  assert.equal(back.children.length, 0)
  sandbox.showGuides()
  assert.equal(back.children.length, before)
  const address = spec.POSTCARD_SIZES["5x8"].address
  const notes = sandbox.warnings("5x8", { width: 2550, height: 1650, back: true, pixelsPerInch: 300 }, [
    { x: address.x + 1, y: address.y + 1, width: 20, height: 20, pixels: 10 },
  ])
  assert.match(notes.join(" "), /address or barcode/)
  const source = readFileSync(new URL("../../plugins/express/index.html", import.meta.url), "utf8")
  assert.match(source, /hideGuides/)
  assert.match(source, /RenditionFormat\.pdf/)
})

function node(): Node {
  const children = [] as unknown as ChildList
  const item = {
    children,
    removeFromParent() {
      if (!item.parent) return
      const index = item.parent.children.indexOf(item)
      if (index >= 0) item.parent.children.splice(index, 1)
    },
  } as Node
  children.append = (child: Node) => {
    child.parent = item
    children.push(child)
  }
  return item
}

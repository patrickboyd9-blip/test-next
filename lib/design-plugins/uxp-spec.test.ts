import assert from "node:assert/strict"
import { createRequire } from "node:module"
import { test } from "node:test"

import { buildPostcard5x8PrintSpec } from "@/lib/print-spec/postcard-5x8-print-spec"
import { buildPostcard6x9PrintSpec } from "@/lib/print-spec/postcard-6x9-print-spec"

const require = createRequire(import.meta.url)
const spec = require("../../plugins/uxp/spec.js") as {
  PIXELS_PER_INCH: number
  POSTCARD_SIZES: Record<string, { page: { width: number; height: number }; points: { width: number; height: number }; inches: { pageWidth: number; pageHeight: number }; address: { x: number; y: number; width: number; height: number } }>
  reservedHits: (id: string, boxes: { x: number; y: number; width: number; height: number; guide?: boolean }[]) => string[]
}
const host = require("../../plugins/uxp/index.js") as {
  createPhotoshop: (photoshop: FakePhotoshop, pageSpec: (typeof spec.POSTCARD_SIZES)["5x8"]) => Promise<FakeDoc[]>
  exportPhotoshopPdf: (doc: FakeDoc, file: string) => Promise<void>
  createInDesign: (indesign: FakeInDesign, pageSpec: (typeof spec.POSTCARD_SIZES)["5x8"]) => FakeInDesignDoc
  exportInDesignPdf: (doc: FakeInDesignDoc, file: string) => void
  createHost: (hosts: object, sizes: typeof spec.POSTCARD_SIZES) => { warnings: (id: string, page: { width: number; height: number; resolution?: number; back?: boolean }, marks: { x: number; y: number; width: number; height: number; pixels?: number; guide?: boolean }[]) => string[] }
}

type FakeLayer = { name: string; visible: boolean; locked: boolean }
type FakeDoc = { width: number; height: number; resolution: number; name: string; layers: FakeLayer[]; saveAs: { pdf: (file: string) => Promise<void> } }
type FakePhotoshop = {
  app: { createDocument: (opts: { width: number; height: number; resolution: number; name: string }) => Promise<FakeDoc> }
  core: { executeAsModal: (fn: () => Promise<void>) => Promise<void> }
  action: { batchPlay: (commands: unknown[]) => Promise<void> }
}
type Frame = { name: string; locked: boolean; geometricBounds: number[] }
type Page = { rectangles: { add: (opts: { name: string }) => Frame } }
type GuideLayer = { name: string; printable: boolean; locked: boolean; visible: boolean }
type FakeInDesignDoc = {
  documentPreferences: { facingPages?: boolean; pageWidth?: string; pageHeight?: string }
  pages: Page[] & { add: () => Page }
  layers: { add: (opts: { name: string }) => GuideLayer; items: GuideLayer[] }
  exportFile: (format: string, file: string) => void
}
type FakeInDesign = { app: { documents: { add: () => FakeInDesignDoc } } }

test("Photoshop and InDesign pages match the print file", () => {
  const five = buildPostcard5x8PrintSpec()
  const six = buildPostcard6x9PrintSpec()
  const scale = spec.PIXELS_PER_INCH / 72
  assert.ok(Math.abs(spec.POSTCARD_SIZES["5x8"].page.width - five.pdfPagePoints.widthPoints * scale) < 0.01)
  assert.ok(Math.abs(spec.POSTCARD_SIZES["5x8"].page.height - five.pdfPagePoints.heightPoints * scale) < 0.01)
  assert.equal(spec.POSTCARD_SIZES["5x8"].points.width, five.pdfPagePoints.widthPoints)
  assert.equal(spec.POSTCARD_SIZES["6x9"].points.height, six.pdfPagePoints.heightPoints)
  assert.equal(spec.POSTCARD_SIZES["5x8"].inches.pageWidth, 8.5)
  assert.equal(spec.POSTCARD_SIZES["6x9"].inches.pageHeight, 6.5)
})

test("Photoshop hides guide layers while saving the PDF", async () => {
  const saved: string[] = []
  let guidesVisibleDuringSave = true
  const photoshop: FakePhotoshop = {
    app: {
      async createDocument(opts) {
        const doc: FakeDoc = {
          width: opts.width,
          height: opts.height,
          resolution: opts.resolution,
          name: opts.name,
          layers: [],
          saveAs: {
            async pdf() {
              guidesVisibleDuringSave = doc.layers.some((layer) => layer.name === "Modern Mail guides" && layer.visible)
              saved.push(doc.name)
            },
          },
        }
        return doc
      },
    },
    core: { executeAsModal: (fn) => fn() },
    action: { batchPlay: async () => undefined },
  }
  const docs = await host.createPhotoshop(photoshop, spec.POSTCARD_SIZES["5x8"])
  assert.equal(docs.length, 2)
  assert.equal(docs[0].width, 2550)
  assert.equal(docs[0].height, 1650)
  assert.equal(docs[0].resolution, 300)
  assert.equal(docs[1].name, "Postcard back")
  assert.ok(docs[1].layers.some((layer) => layer.locked && layer.name === "Modern Mail guides"))
  await host.exportPhotoshopPdf(docs[1], "back.pdf")
  assert.equal(guidesVisibleDuringSave, false)
  assert.ok(docs[1].layers.every((layer) => layer.visible))
  assert.deepEqual(saved, ["Postcard back"])
})

test("InDesign keeps guide marks off the print file", () => {
  let exportedWhileHidden = false
  const indesign: FakeInDesign = {
    app: {
      documents: {
        add() {
          const layers: GuideLayer[] = []
          const makePage = (): Page => ({
            rectangles: {
              add(opts) {
                return { name: opts.name, locked: false, geometricBounds: [] }
              },
            },
          })
          const doc: FakeInDesignDoc = {
            documentPreferences: {},
            pages: Object.assign([makePage()], {
              add() {
                const page = makePage()
                doc.pages.push(page)
                return page
              },
            }),
            layers: {
              items: layers,
              add(opts) {
                const layer = { name: opts.name, printable: true, locked: false, visible: true }
                layers.push(layer)
                return layer
              },
            },
            exportFile() {
              exportedWhileHidden = layers.some((layer) => layer.name === "Modern Mail guides" && layer.visible === false && layer.printable === false)
            },
          }
          return doc
        },
      },
    },
  }
  const doc = host.createInDesign(indesign, spec.POSTCARD_SIZES["6x9"])
  assert.equal(doc.documentPreferences.pageWidth, "9.5 in")
  assert.equal(doc.documentPreferences.pageHeight, "6.5 in")
  assert.equal(doc.pages.length, 2)
  assert.equal(doc.layers.items[0].printable, false)
  assert.equal(doc.layers.items[0].locked, true)
  host.exportInDesignPdf(doc, "card.pdf")
  assert.equal(exportedWhileHidden, true)
  assert.equal(doc.layers.items[0].visible, true)
  const address = spec.POSTCARD_SIZES["5x8"].address
  const notes = host.createHost({}, spec.POSTCARD_SIZES).warnings("5x8", { width: 2550, height: 1650, resolution: 200, back: true }, [
    { x: address.x, y: address.y, width: address.width, height: 10, pixels: 100 },
  ])
  assert.match(notes.join(" "), /300 pixels per inch/)
  assert.match(notes.join(" "), /address or barcode/)
  assert.deepEqual(spec.reservedHits("5x8", [{ ...address, guide: true }]), [])
})

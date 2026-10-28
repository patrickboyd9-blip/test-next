import { PDFDocument } from "pdf-lib"

import { preflightDesignFile } from "@/lib/bring-your-own-design/preflight"
import type { UploadedDesignIssue } from "@/lib/campaign-creator/types"
import { geometryFor } from "@/lib/postcard-layouts/compose"
import type { PostcardSizeId } from "@/lib/postcard-layouts/ids"

/** One face of a two-page print file (front, then back) as its own one-page PDF. */
export async function printFilePage(bytes: Uint8Array, face: "front" | "back"): Promise<Uint8Array> {
  const source = await PDFDocument.load(bytes)
  const out = await PDFDocument.create()
  const [page] = await out.copyPages(source, [face === "front" ? 0 : 1])
  out.addPage(page)
  return out.save()
}

/**
 * The same address-area check the upload flow runs, on the AI card's own back page.
 * Only the address, postage, and barcode warning is surfaced here.
 */
export async function printFileKeepOutIssues(bytes: Uint8Array, size: PostcardSizeId): Promise<UploadedDesignIssue[]> {
  const back = await printFilePage(bytes, "back")
  const issues = await preflightDesignFile({
    bytes: back,
    declaredType: "application/pdf",
    face: "back",
    geometry: geometryFor(size),
  })
  return issues
    .filter((item) => item.code === "keep_out")
    .map((item) => ({ severity: item.severity, code: item.code, face: "back", message: item.message }))
}

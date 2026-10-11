import { designTemplate, isDesignTemplateSize } from "@/lib/print-spec/design-templates"
import { renderDesignOverlayPng } from "@/lib/print-spec/render-design-template-png"
import { renderDesignTemplatePdf } from "@/lib/print-spec/render-design-template-pdf"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const cache = new Map<string, Buffer>()

function cached(key: string, build: () => Buffer): Buffer {
  const hit = cache.get(key)
  if (hit) return hit
  const value = build()
  cache.set(key, value)
  return value
}

/**
 * Designer templates for the 5×8 and 6×9 postcards.
 * PDF is two pages (front, then back) at the full bleed size.
 * PNG is a transparent overlay of one face. Geometry comes from the print spec.
 */
export function GET(request: Request): Response {
  const url = new URL(request.url)
  const sizeParam = url.searchParams.get("size")
  if (!isDesignTemplateSize(sizeParam)) {
    return new Response("Choose size 5x8 or 6x9.", { status: 400 })
  }
  const template = designTemplate(sizeParam)
  const download = url.searchParams.get("download") === "1"
  const disposition = download ? "attachment" : "inline"

  if (url.searchParams.get("format") === "png") {
    const face = url.searchParams.get("face") === "front" ? "front" : "back"
    const png = cached(`png:${sizeParam}:${face}`, () => renderDesignOverlayPng(template.geometry, face))
    return new Response(new Uint8Array(png), {
      headers: {
        "Content-Type": "image/png",
        "Content-Disposition": `${disposition}; filename="modern-mail-${template.fileToken}-${face}-overlay.png"`,
        "Cache-Control": "public, max-age=86400",
      },
    })
  }

  const pdf = cached(`pdf:${sizeParam}`, () => renderDesignTemplatePdf(template))
  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${disposition}; filename="modern-mail-${template.fileToken}-postcard-template.pdf"`,
      "Cache-Control": "public, max-age=86400",
    },
  })
}

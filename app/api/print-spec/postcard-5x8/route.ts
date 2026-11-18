import { denyUnlessSignedIn } from "@/lib/auth/require-session"
import { limitPublic } from "@/lib/ops/public-rate"
import { renderPostcard5x8PrintSpecPdf } from "@/lib/print-spec/render-print-spec-pdf"
import { renderPostcard5x8PrintSpecPng } from "@/lib/print-spec/render-print-spec-png"

/**
 * Geometry proof for the 5×8 catalog.
 * PDF by default. `?format=png&face=front|back` returns the 300 DPI RGB raster.
 * No Click2Mail login, job, or payment. Signed-in accounts only.
 */
export async function GET(request: Request): Promise<Response> {
  const denied = await denyUnlessSignedIn()
  if (denied) return denied
  const limited = await limitPublic(request, "print-spec", 20)
  if (limited) return limited
  const url = new URL(request.url)
  if (url.searchParams.get("format") === "png") {
    const face = url.searchParams.get("face") === "front" ? "front" : "back"
    const png = renderPostcard5x8PrintSpecPng(face)
    return new Response(new Uint8Array(png), {
      headers: {
        "Content-Type": "image/png",
        "Content-Disposition": `inline; filename="postcard-5x8-${face}-300dpi.png"`,
        "Cache-Control": "no-store",
      },
    })
  }

  const pdf = renderPostcard5x8PrintSpecPdf()
  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": 'inline; filename="postcard-5x8-print-spec.pdf"',
      "Cache-Control": "no-store",
    },
  })
}

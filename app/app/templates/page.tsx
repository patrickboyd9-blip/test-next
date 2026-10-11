import Link from "next/link"

import { SidebarTrigger } from "@/components/ui/sidebar"
import { designTemplate, formatInches, type DesignTemplateSize } from "@/lib/print-spec/design-templates"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const SIZES: DesignTemplateSize[] = ["5x8", "6x9"]

export default function TemplatesPage() {
  return (
    <div className="flex min-h-svh flex-col">
      <header className="flex h-14 shrink-0 items-center gap-2 border-b px-4">
        <SidebarTrigger className="-ml-1" />
        <span className="text-sm font-medium text-muted-foreground">Templates</span>
      </header>
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-10 px-6 py-10">
        <div className="flex flex-col gap-3">
          <h1 className="text-2xl font-semibold tracking-tight">Design the postcard somewhere else</h1>
          <p className="text-sm leading-6 text-muted-foreground">
            Download a template, design the front and the back in Figma, Canva, or Photoshop,
            then upload both files in your campaign. The page is larger than the finished card
            so the color can run past the cut.
          </p>
        </div>

        <div className="grid gap-6 sm:grid-cols-2">
          {SIZES.map((size) => {
            const template = designTemplate(size)
            const page = template.geometry.artworkCanvasInches
            const trim = template.geometry.finishedTrimInches
            return (
              <section key={size} className="flex flex-col gap-4 rounded-xl border p-4">
                <div>
                  <h2 className="text-base font-medium">{template.displayName}</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Finished card {formatInches(trim.widthInches)} × {formatInches(trim.heightInches)} in.
                    Page {formatInches(page.widthInches)} × {formatInches(page.heightInches)} in,
                    with a quarter inch of bleed on every side.
                  </p>
                </div>
                <div className="overflow-hidden rounded-lg bg-muted">
                  {/* The overlay is a generated transparent PNG. The muted ground makes the guides visible. */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={`/api/templates/postcard?size=${size}&format=png&face=back`}
                    alt={`${template.displayName} back template, with trim line, safe zone, and address area`}
                    className="h-auto w-full"
                  />
                </div>
                <div className="flex flex-col gap-2 text-sm">
                  <a className="underline-offset-4 hover:underline" href={downloadHref(size, "pdf")}>
                    Download PDF (front and back)
                  </a>
                  <a className="underline-offset-4 hover:underline" href={downloadHref(size, "png", "front")}>
                    Download front overlay (transparent PNG)
                  </a>
                  <a className="underline-offset-4 hover:underline" href={downloadHref(size, "png", "back")}>
                    Download back overlay (transparent PNG)
                  </a>
                </div>
              </section>
            )
          })}
        </div>

        <section className="flex flex-col gap-3">
          <h2 className="text-base font-medium">Figma</h2>
          <ol className="list-decimal space-y-2 pl-5 text-sm leading-6 text-muted-foreground">
            <li>
              Make one frame per side at the full page size. Figma treats one pixel as one point,
              so a 5×8 frame is {designTemplate("5x8").figmaFrame.widthPx} × {designTemplate("5x8").figmaFrame.heightPx},
              and a 6×9 frame is {designTemplate("6x9").figmaFrame.widthPx} × {designTemplate("6x9").figmaFrame.heightPx}.
            </li>
            <li>Place the transparent PNG on top of the frame and lock it. Design underneath it.</li>
            <li>Hide the overlay before you export. Figma’s PDF export has no bleed setting, and the bleed is already the frame.</li>
            <li>Export a PDF. Do not add crop marks. They change the page size, and the printer will reject it.</li>
          </ol>
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="text-base font-medium">Canva</h2>
          <ol className="list-decimal space-y-2 pl-5 text-sm leading-6 text-muted-foreground">
            <li>
              Create a custom size of {formatInches(designTemplate("5x8").geometry.artworkCanvasInches.widthInches)} × {formatInches(designTemplate("5x8").geometry.artworkCanvasInches.heightInches)} inches
              for a 5×8, or {formatInches(designTemplate("6x9").geometry.artworkCanvasInches.widthInches)} × {formatInches(designTemplate("6x9").geometry.artworkCanvasInches.heightInches)} inches
              for a 6×9.
            </li>
            <li>
              Turn bleed off and turn crop marks off. Canva’s print bleed is only an eighth of an inch.
              This postcard needs a quarter inch, and the custom size already includes it.
            </li>
            <li>Download a PDF or a PNG. Upload the front and the back as two files.</li>
          </ol>
        </section>

        <p className="text-sm text-muted-foreground">
          The black line is the cut. The blue line is where words should stay.
          On the back, leave the shaded area empty. That is where the address, postage, and barcode print.
          Campaigns currently mail the 5×8. The 6×9 template is here for a design you are preparing.
        </p>
        <p className="text-sm">
          <Link href="/app/campaigns/new" className="underline-offset-4 hover:underline">
            Start a campaign
          </Link>
        </p>
      </main>
    </div>
  )
}

function downloadHref(size: DesignTemplateSize, format: "pdf" | "png", face?: "front" | "back"): string {
  const params = new URLSearchParams({ size, format, download: "1" })
  if (face) params.set("face", face)
  return `/api/templates/postcard?${params.toString()}`
}

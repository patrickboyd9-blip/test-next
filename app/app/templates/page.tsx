import Link from "next/link"

import { GalleryBoard } from "@/components/mail-gallery/GalleryBoard"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { designTemplate, formatInches, type DesignTemplateSize } from "@/lib/print-spec/design-templates"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const SIZES: DesignTemplateSize[] = ["5x8", "6x9"]

export default async function TemplatesPage({
  searchParams,
}: {
  searchParams: Promise<{ edit?: string }>
}) {
  const params = await searchParams
  return (
    <div className="flex min-h-svh flex-col">
      <header className="flex h-14 shrink-0 items-center gap-2 border-b px-4">
        <SidebarTrigger className="-ml-1" />
        <span className="text-sm font-medium text-muted-foreground">Mailer Gallery</span>
      </header>
      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-10 px-6 py-10">
        <div className="flex flex-col gap-3">
          <h1 className="text-2xl font-semibold tracking-tight">Mailer Gallery</h1>
          <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
            Pick a picture. Edit it yourself, or have the card designed around that same picture. Nothing is mailed from this page.
          </p>
        </div>
        <GalleryBoard editingId={params.edit} />

        <section className="flex flex-col gap-4 border-t pt-8">
          <h2 className="text-base font-medium">Blank design templates</h2>
          <p className="text-sm leading-6 text-muted-foreground">
            Download a template, design the front and the back in Figma, Canva, or Photoshop, then upload both files.
          </p>
          <div className="grid gap-6 sm:grid-cols-2">
            {SIZES.map((size) => {
              const template = designTemplate(size)
              const page = template.geometry.artworkCanvasInches
              const trim = template.geometry.finishedTrimInches
              return (
                <section key={size} className="flex flex-col gap-3 rounded-xl border p-4">
                  <h3 className="text-sm font-medium">{template.displayName}</h3>
                  <p className="text-sm text-muted-foreground">
                    Finished card {formatInches(trim.widthInches)} × {formatInches(trim.heightInches)} in.
                    Page {formatInches(page.widthInches)} × {formatInches(page.heightInches)} in.
                  </p>
                  <a className="text-sm underline-offset-4 hover:underline" href={downloadHref(size, "pdf")}>
                    Download PDF (front and back)
                  </a>
                </section>
              )
            })}
          </div>
          <p className="text-sm">
            <Link href="/app/campaigns/new" className="underline-offset-4 hover:underline">
              Start a campaign
            </Link>
          </p>
        </section>
      </main>
    </div>
  )
}

function downloadHref(size: DesignTemplateSize, format: "pdf" | "png", face?: "front" | "back"): string {
  const params = new URLSearchParams({ size, format, download: "1" })
  if (face) params.set("face", face)
  return `/api/templates/postcard?${params.toString()}`
}

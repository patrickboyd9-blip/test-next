import Link from "next/link"
import { notFound } from "next/navigation"

import { GalleryBoard } from "@/components/mail-gallery/GalleryBoard"
import { galleryCategoryBySlug } from "@/lib/mail-templates/gallery-categories"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export default async function IndustryGalleryPage({
  params,
}: {
  params: Promise<{ industry: string }>
}) {
  const { industry } = await params
  const category = galleryCategoryBySlug(industry)
  if (!category) notFound()

  return (
    <>
      <Link
        href="/app/templates"
        className="inline-flex min-h-11 w-fit items-center rounded-xl border px-3 text-sm"
      >
        Back
      </Link>
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">{category.label}</h1>
        {category.photos.length === 0 ? (
          <p className="text-sm text-muted-foreground">More coming soon.</p>
        ) : (
          <p className="text-sm text-muted-foreground">
            {category.photos.length === 1 ? "1 photo" : `${category.photos.length} photos`}
          </p>
        )}
      </div>
      {category.photos.length === 0 ? null : <GalleryBoard category={category} />}
    </>
  )
}

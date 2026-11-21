import Link from "next/link"

import { galleryCategories, galleryIndustrySlug } from "@/lib/mail-templates/gallery-categories"

/** Compact industry labels. The photos live on each industry page. */
export function GalleryIndex() {
  const categories = [...galleryCategories()].sort((a, b) => a.label.localeCompare(b.label, "en"))

  if (categories.length === 0) {
    return <p className="text-sm text-muted-foreground">No pictures in this gallery yet.</p>
  }

  return (
    <ul className="flex flex-wrap gap-2">
      {categories.map((category) => {
        const count = category.photos.length === 1 ? "1 photo" : `${category.photos.length} photos`
        return (
          <li key={category.id} className="max-w-full">
            <Link
              href={`/app/templates/${galleryIndustrySlug(category.id)}`}
              className="inline-flex min-h-11 max-w-full items-center gap-2 whitespace-normal rounded-xl border px-3 py-2 text-left text-sm leading-5"
            >
              <span className="font-medium">{category.label}</span>
              <span className="shrink-0 text-muted-foreground">{count}</span>
            </Link>
          </li>
        )
      })}
    </ul>
  )
}

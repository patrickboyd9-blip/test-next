import Link from "next/link"

import { galleryCategories, galleryIndustrySlug } from "@/lib/mail-templates/gallery-categories"

/** One tile per industry that has a gallery photo. The photos themselves live on the industry page. */
export function GalleryIndex() {
  const categories = galleryCategories()

  if (categories.length === 0) {
    return <p className="text-sm text-muted-foreground">No pictures in this gallery yet.</p>
  }

  return (
    <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      {categories.map((category) => {
        const cover = category.photos[0]
        const count = category.photos.length === 1 ? "1 photo" : `${category.photos.length} photos`
        return (
          <li key={category.id}>
            <Link
              href={`/app/templates/${galleryIndustrySlug(category.id)}`}
              className="block overflow-hidden rounded-2xl border text-left"
            >
              {cover ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={cover.src} alt="" className="aspect-[8/5] w-full object-cover" />
              ) : null}
              <span className="flex items-baseline justify-between gap-3 px-3 py-3">
                <span className="text-base font-semibold">{category.label}</span>
                <span className="shrink-0 text-sm text-muted-foreground">{count}</span>
              </span>
            </Link>
          </li>
        )
      })}
    </ul>
  )
}

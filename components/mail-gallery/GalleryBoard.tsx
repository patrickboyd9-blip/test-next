"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"

import { GalleryProof } from "@/components/cockpit/GalleryProof"
import type { ProofLayer } from "@/lib/image-edit/types"
import { galleryCategories, photoCountLabel, type GalleryCategory } from "@/lib/mail-templates/gallery-categories"
import { layersForGallery } from "@/lib/mail-templates/gallery-layers"
import { getMailTemplate } from "@/lib/mail-templates/query"

export function GalleryBoard() {
  const categories = galleryCategories()
  const [open, setOpen] = useState<{ category: number; index: number } | null>(null)

  if (categories.length === 0) {
    return <p className="text-sm text-muted-foreground">No pictures in this gallery yet.</p>
  }

  return (
    <div className="flex flex-col gap-10">
      {categories.map((category, categoryIndex) => (
        <section key={category.id} className="flex flex-col gap-4" data-gallery-category={category.id}>
          <div className="flex flex-wrap items-end justify-between gap-3">
            <h2 className="text-xl font-semibold">{category.label}</h2>
            <button
              type="button"
              className="min-h-11 rounded-xl border px-3 text-sm"
              onClick={() => setOpen({ category: categoryIndex, index: 0 })}
            >
              View {category.label}
            </button>
          </div>
          <ul className="grid gap-4 sm:grid-cols-2">
            {category.photos.map((photo, index) => (
              <li key={photo.id}>
                <button
                  type="button"
                  className="block w-full overflow-hidden rounded-2xl border text-left"
                  onClick={() => setOpen({ category: categoryIndex, index })}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={photo.src} alt="" className="aspect-[8/5] w-full object-cover" />
                  <span className="block px-3 py-3 text-sm font-medium">{photo.name}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      ))}
      {open ? (
        <PhotoViewer
          categories={categories}
          categoryIndex={open.category}
          index={open.index}
          onIndex={(index) => setOpen({ category: open.category, index })}
          onClose={() => setOpen(null)}
        />
      ) : null}
    </div>
  )
}

function PhotoViewer({
  categories,
  categoryIndex,
  index,
  onIndex,
  onClose,
}: {
  categories: GalleryCategory[]
  categoryIndex: number
  index: number
  onIndex: (index: number) => void
  onClose: () => void
}) {
  const category = categories[categoryIndex]
  const photos = category?.photos ?? []
  const photo = photos[index]
  const dialog = useRef<HTMLDivElement>(null)
  const touch = useRef<{ x: number; y: number } | null>(null)
  const [editing, setEditing] = useState(false)
  const [layers, setLayers] = useState<ProofLayer[] | null>(null)

  function step(delta: number) {
    if (photos.length === 0) return
    const next = (index + delta + photos.length) % photos.length
    setEditing(false)
    setLayers(null)
    onIndex(next)
  }

  useEffect(() => {
    dialog.current?.focus()
    function onKey(event: KeyboardEvent) {
      if (event.key === "ArrowRight") step(1)
      if (event.key === "ArrowLeft") step(-1)
      if (event.key === "Escape") onClose()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
    // The listener always reads the latest index through this render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, photos.length])

  if (!photo) return null
  const template = getMailTemplate(photo.id)
  const activeLayers = layers ?? (template ? layersForGallery(template) : [])

  return (
    <div
      ref={dialog}
      role="dialog"
      aria-modal="true"
      aria-label={`${category.label} pictures`}
      tabIndex={-1}
      className="fixed inset-0 z-50 flex flex-col bg-[#041018]/95 p-4 text-white outline-none sm:p-8"
      data-photo-viewer={category.id}
      onTouchStart={(event) => {
        const point = event.changedTouches[0]
        if (!point) return
        touch.current = { x: point.clientX, y: point.clientY }
      }}
      onTouchEnd={(event) => {
        const start = touch.current
        const point = event.changedTouches[0]
        touch.current = null
        if (!start || !point) return
        const dx = point.clientX - start.x
        const dy = point.clientY - start.y
        if (Math.abs(dx) < 40 || Math.abs(dx) < Math.abs(dy)) return
        step(dx < 0 ? 1 : -1)
      }}
    >
      <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-3">
        <p className="text-sm">
          {category.label} · <span data-photo-count>{photoCountLabel(index, photos.length)}</span>
        </p>
        <button type="button" className="min-h-11 rounded-xl border border-white/30 px-3 text-sm" onClick={onClose}>
          Close
        </button>
      </div>
      <div className="mx-auto flex w-full max-w-5xl flex-1 items-center gap-3 py-4">
        <button type="button" aria-label="Previous photo" className="hidden min-h-12 min-w-12 rounded-full border border-white/30 text-xl sm:inline-flex sm:items-center sm:justify-center" onClick={() => step(-1)}>
          ‹
        </button>
        <div className="min-w-0 flex-1">
          {editing && template ? (
            <GalleryProof
              layers={activeLayers}
              backgroundSrc={photo.src}
              onChange={setLayers}
            />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={photo.src} alt="" className="mx-auto max-h-[68vh] w-full rounded-2xl object-contain" />
          )}
          <p className="mt-3 text-sm text-white/80">{photo.name}</p>
        </div>
        <button type="button" aria-label="Next photo" className="hidden min-h-12 min-w-12 rounded-full border border-white/30 text-xl sm:inline-flex sm:items-center sm:justify-center" onClick={() => step(1)}>
          ›
        </button>
      </div>
      <div className="mx-auto flex w-full max-w-5xl flex-wrap gap-2">
        <button type="button" aria-label="Previous photo" className="min-h-11 rounded-xl border border-white/30 px-3 text-sm sm:hidden" onClick={() => step(-1)}>
          Previous
        </button>
        <button type="button" aria-label="Next photo" className="min-h-11 rounded-xl border border-white/30 px-3 text-sm sm:hidden" onClick={() => step(1)}>
          Next
        </button>
        <button type="button" className="min-h-11 rounded-xl border border-white/30 px-3 text-sm" onClick={() => setEditing(true)}>
          Edit it myself
        </button>
        <Link href={`/app/mail?hero=${photo.id}`} className="inline-flex min-h-11 items-center rounded-xl bg-[#5ce1ff] px-3 text-sm font-semibold text-[#041018]">
          Design it for me
        </Link>
      </div>
    </div>
  )
}

"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"

import { GalleryProof } from "@/components/cockpit/GalleryProof"
import { ChangeTheWords } from "@/components/mail-gallery/ChangeTheWords"
import type { ProofLayer } from "@/lib/image-edit/types"
import { galleryPhotoActions } from "@/lib/mail-templates/gallery-actions"
import { photoCountLabel, type GalleryCategory } from "@/lib/mail-templates/gallery-categories"
import { layersForGallery } from "@/lib/mail-templates/gallery-layers"
import { getMailTemplate } from "@/lib/mail-templates/query"

export function GalleryBoard({ category }: { category: GalleryCategory }) {
  const [open, setOpen] = useState<number | null>(null)

  if (category.photos.length === 0) {
    return <p className="text-sm text-muted-foreground">No pictures in this gallery yet.</p>
  }

  return (
    <div className="flex flex-col gap-4" data-gallery-category={category.id}>
      <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {category.photos.map((photo, index) => (
          <li key={photo.id}>
            <button
              type="button"
              className="block w-full overflow-hidden rounded-2xl border text-left"
              onClick={() => setOpen(index)}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={photo.src} alt="" className="aspect-[8/5] w-full object-cover" />
              <span className="block px-3 py-3 text-sm font-medium">{photo.name}</span>
            </button>
          </li>
        ))}
      </ul>
      {open !== null ? (
        <PhotoViewer
          category={category}
          index={open}
          onIndex={setOpen}
          onClose={() => setOpen(null)}
        />
      ) : null}
    </div>
  )
}

function PhotoViewer({
  category,
  index,
  onIndex,
  onClose,
}: {
  category: GalleryCategory
  index: number
  onIndex: (index: number) => void
  onClose: () => void
}) {
  const photos = category.photos
  const photo = photos[index]
  const dialog = useRef<HTMLDivElement>(null)
  const touch = useRef<{ x: number; y: number } | null>(null)
  const [mode, setMode] = useState<"view" | "self" | "words">("view")
  const [layers, setLayers] = useState<ProofLayer[] | null>(null)

  function step(delta: number) {
    if (photos.length === 0) return
    const next = (index + delta + photos.length) % photos.length
    setMode("view")
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
  const actions = galleryPhotoActions(photo.kind)
  const activeLayers = layers ?? (template ? layersForGallery(template) : [])

  return (
    <div
      ref={dialog}
      role="dialog"
      aria-modal="true"
      aria-label={`${category.label} pictures`}
      tabIndex={-1}
      className="fixed inset-0 z-50 flex flex-col overflow-y-auto bg-[#041018]/95 p-4 text-white outline-none sm:p-8"
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
          {mode === "self" && template && actions.editMyself ? (
            <GalleryProof
              key={photo.id}
              layers={activeLayers}
              backgroundSrc={photo.src}
              templateId={photo.id}
              onChange={setLayers}
            />
          ) : mode === "words" && actions.changeWords ? (
            <ChangeTheWords key={photo.id} templateId={photo.id} imageSrc={photo.src} onBack={() => setMode("view")} />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={photo.src} alt="" className="mx-auto max-h-[46vh] w-full rounded-2xl object-contain sm:max-h-[68vh]" />
          )}
          <p className="mt-3 text-sm text-white/80">{photo.name}</p>
        </div>
        <button type="button" aria-label="Next photo" className="hidden min-h-12 min-w-12 rounded-full border border-white/30 text-xl sm:inline-flex sm:items-center sm:justify-center" onClick={() => step(1)}>
          ›
        </button>
      </div>
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-2">
        <div className="flex gap-2 sm:hidden">
          <button type="button" aria-label="Previous photo" className="min-h-11 flex-1 rounded-xl border border-white/30 px-3 text-sm" onClick={() => step(-1)}>
            Previous
          </button>
          <button type="button" aria-label="Next photo" className="min-h-11 flex-1 rounded-xl border border-white/30 px-3 text-sm" onClick={() => step(1)}>
            Next
          </button>
        </div>
        {mode === "view" ? (
          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
            {actions.editMyself ? (
              <button type="button" className="min-h-11 w-full whitespace-normal rounded-xl border border-white/30 px-3 py-2 text-center text-sm leading-5 sm:w-auto" onClick={() => setMode("self")}>
                Use this photo to edit myself
              </button>
            ) : null}
            {actions.changeWords ? (
              <button type="button" className="min-h-11 w-full whitespace-normal rounded-xl border border-white/30 px-3 py-2 text-center text-sm leading-5 sm:w-auto" onClick={() => setMode("words")}>
                Change the words
              </button>
            ) : null}
            {actions.designForMe ? (
              <Link href={`/app/mail?hero=${photo.id}`} className="inline-flex min-h-11 w-full items-center justify-center whitespace-normal rounded-xl bg-[#5ce1ff] px-3 py-2 text-center text-sm font-semibold leading-5 text-[#041018] sm:w-auto">
                Use this and have the AI make edits for me
              </Link>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  )
}

"use client"

import { useState } from "react"
import Link from "next/link"

import { GalleryProof } from "@/components/cockpit/GalleryProof"
import type { ProofLayer } from "@/lib/image-edit/types"
import { galleryPhotoSrc } from "@/lib/mail-templates/gallery-photo-src"
import { layersForGallery } from "@/lib/mail-templates/gallery-layers"
import { galleryV1 } from "@/lib/mail-templates/gallery-v1"
import { TEMPLATE_INDUSTRY_LABELS } from "@/lib/mail-templates/types"

export function GalleryBoard({ editingId }: { editingId?: string }) {
  const mailers = galleryV1().map((template) => ({
    id: template.id,
    name: template.name,
    summary: template.summary,
    industry: TEMPLATE_INDUSTRY_LABELS[template.industry],
    src: galleryPhotoSrc(template.id),
    template,
  }))
  const [layers, setLayers] = useState<ProofLayer[] | null>(null)
  const [openId, setOpenId] = useState<string | null>(editingId ?? null)

  return (
    <ul className="grid gap-4 sm:grid-cols-2">
      {mailers.map((mailer) => {
        const open = openId === mailer.id
        const activeLayers = open ? layers ?? layersForGallery(mailer.template) : null
        return (
          <li key={mailer.id} className="flex flex-col gap-3 rounded-2xl border border-[#1c3d52] bg-[#0c1424] p-3" data-gallery-card={mailer.id}>
            {mailer.src ? (
              // Gallery art is our own picture. It stays the hero of this card.
              // eslint-disable-next-line @next/next/no-img-element
              <img src={mailer.src} alt="" className="aspect-[8/5] w-full rounded-xl object-cover" />
            ) : (
              <div className="aspect-[8/5] w-full rounded-xl bg-[#102433]" />
            )}
            <div>
              <p className="text-xs text-[#8aa0b4]">{mailer.industry}</p>
              <h2 className="text-lg font-semibold">{mailer.name}</h2>
              <p className="text-sm leading-6 text-[#b7c9d8]">{mailer.summary}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className="min-h-11 rounded-xl border border-[#245068] px-3 text-sm"
                onClick={() => {
                  setOpenId(mailer.id)
                  setLayers(layersForGallery(mailer.template))
                }}
              >
                Edit it myself
              </button>
              <Link
                href={`/app/mail?hero=${mailer.id}`}
                className="inline-flex min-h-11 items-center rounded-xl bg-[#5ce1ff] px-3 text-sm font-semibold text-[#041018]"
              >
                Design it for me
              </Link>
            </div>
            {open && activeLayers ? (
              <GalleryProof layers={activeLayers} backgroundSrc={mailer.src} onChange={setLayers} />
            ) : null}
          </li>
        )
      })}
    </ul>
  )
}

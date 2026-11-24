"use client"

import { useState, type ReactNode } from "react"

import { PhotoAdjust } from "@/components/mail-gallery/PhotoAdjust"
import { askComet } from "@/lib/image-edit/ask"
import { nextLayerId, placeLayer, placementLimits } from "@/lib/image-edit/placement"
import type { ProofFace, ProofLayer } from "@/lib/image-edit/types"
import type { PostcardSizeId } from "@/lib/postcard-layouts/ids"

import { ProofFrame } from "./ProofFrame"

export function ProofEditor({
  src,
  mediaType,
  face,
  label,
  size,
  layers,
  onChange,
  overlay,
}: {
  src: string
  mediaType: string
  face: ProofFace
  label: string
  size: PostcardSizeId
  layers: ProofLayer[]
  onChange: (layers: ProofLayer[]) => void
  overlay?: ReactNode
}) {
  const [past, setPast] = useState<ProofLayer[][]>([])
  const [ask, setAsk] = useState("")
  const [reply, setReply] = useState("")
  const [busy, setBusy] = useState(false)
  const [shown, setShown] = useState(src)
  const image = mediaType.startsWith("image/")
  const mine = layers.filter((layer) => layer.face === face).sort((a, b) => a.z - b.z)

  function commit(next: ProofLayer[]) {
    setPast((history) => [...history, layers].slice(-20))
    onChange(next)
  }

  function addText() {
    const limits = placementLimits(size, face)
    const box = placeLayer({ x: limits.safe.x + 4, y: limits.safe.y + 4, w: 40, h: 12 }, limits)
    commit([
      ...layers,
      { id: nextLayerId(layers), face, kind: "text", ...box, z: top(layers) + 1, text: "Your words", color: "#102033", name: "Text" },
    ])
  }

  function addImage(file: File | null) {
    if (!file) return
    const url = URL.createObjectURL(file)
    const limits = placementLimits(size, face)
    const box = placeLayer({ x: limits.safe.x + 6, y: limits.safe.y + 8, w: 28, h: 22 }, limits)
    commit([
      ...layers,
      { id: nextLayerId(layers), face, kind: "image", ...box, z: top(layers) + 1, src: url, name: file.name },
    ])
  }

  return (
    <div className="space-y-3" data-proof-editor={face}>
      <ProofFrame src={image ? shown : src} mediaType={mediaType} face={face} label={label} size={size}>
        {mine.map((layer) => (
          <LayerView
            key={layer.id}
            layer={layer}
            size={size}
            onChange={(next) => onChange(layers.map((item) => (item.id === next.id ? next : item)))}
          />
        ))}
        {overlay}
      </ProofFrame>
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={addText} className="min-h-11 rounded-xl border border-[#245068] px-3 text-sm">
          Add text
        </button>
        <label className="inline-flex min-h-11 cursor-pointer items-center rounded-xl border border-[#245068] px-3 text-sm">
          Add artwork
          <input type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" onChange={(event) => addImage(event.target.files?.[0] ?? null)} />
        </label>
        <button
          type="button"
          onClick={() => {
            const previous = past[past.length - 1]
            if (!previous) return
            setPast((history) => history.slice(0, -1))
            onChange(previous)
          }}
          className="min-h-11 rounded-xl border border-[#245068] px-3 text-sm"
        >
          Undo
        </button>
      </div>
      {mine.length > 0 ? (
        <ul className="space-y-1 text-sm">
          {mine.map((layer) => (
            <li key={layer.id} className="flex items-center justify-between gap-2">
              <span>{layer.kind === "text" ? layer.text : layer.name}</span>
              <button type="button" className="min-h-11 text-[#8ecfff]" onClick={() => commit(layers.filter((item) => item.id !== layer.id))}>
                Delete
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      <form
        className="space-y-2"
        onSubmit={(event) => {
          event.preventDefault()
          setBusy(true)
          void askComet({ instruction: ask, layers, face, size })
            .then((result) => {
              if (result.layers !== layers) commit(result.layers)
              setReply(result.message)
              setAsk("")
            })
            .finally(() => setBusy(false))
        }}
      >
        <label className="block text-sm">
          Ask Comet to make any adjustment!
          <textarea
            value={ask}
            onChange={(event) => setAsk(event.target.value)}
            rows={2}
            placeholder="Move the text right, or add the words Spring tune-up"
            className="mt-1 min-h-11 w-full rounded-xl border border-[#245068] bg-[#071018] px-3 py-2 text-sm"
          />
        </label>
        <p className="text-xs leading-5 text-[#8aa0b4]">
          Comet can change text, logos, and artwork it added, including position, color, and size. It cannot rewrite words that are already printed in the uploaded picture.
        </p>
        <button type="submit" disabled={busy || !ask.trim()} className="min-h-11 rounded-xl bg-[#5ce1ff] px-4 text-sm font-semibold text-[#041018] disabled:opacity-40">
          {busy ? "Working" : "Ask Comet"}
        </button>
        {reply ? <p className="text-sm text-[#e7f2fb]">{reply}</p> : null}
      </form>
      {image ? (
        <PhotoAdjust imageSrc={src} onKept={setShown} onOriginal={() => setShown(src)} />
      ) : null}
    </div>
  )
}

function LayerView({
  layer,
  size,
  onChange,
}: {
  layer: ProofLayer
  size: PostcardSizeId
  onChange: (layer: ProofLayer) => void
}) {
  const limits = placementLimits(size, layer.face)
  return (
    <div
      role="group"
      aria-label={layer.kind === "text" ? layer.text : layer.name}
      className="absolute touch-none"
      style={{ left: `${layer.x}%`, top: `${layer.y}%`, width: `${layer.w}%`, height: `${layer.h}%`, zIndex: 5 + layer.z }}
      onPointerDown={(event) => {
        if ((event.target as HTMLElement).dataset.resize) return
        const startX = event.clientX
        const startY = event.clientY
        const origin = { x: layer.x, y: layer.y }
        const bounds = (event.currentTarget.parentElement?.getBoundingClientRect()) ?? null
        const move = (next: PointerEvent) => {
          if (!bounds) return
          const dx = ((next.clientX - startX) / bounds.width) * 100
          const dy = ((next.clientY - startY) / bounds.height) * 100
          const placed = placeLayer({ x: origin.x + dx, y: origin.y + dy, w: layer.w, h: layer.h }, limits)
          onChange({ ...layer, ...placed })
        }
        const stop = () => {
          window.removeEventListener("pointermove", move)
          window.removeEventListener("pointerup", stop)
        }
        window.addEventListener("pointermove", move)
        window.addEventListener("pointerup", stop)
      }}
    >
      {layer.kind === "color" ? (
        <div className="h-full w-full rounded-sm" style={{ background: layer.color }} />
      ) : layer.kind === "text" ? (
        <p className="h-full w-full overflow-hidden text-center font-semibold leading-tight" style={{ color: layer.color, fontSize: "clamp(10px, 1.6vw, 18px)" }}>
          {layer.text}
        </p>
      ) : (
        // Artwork the customer just added. It stays a layer, not a new file.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={layer.src} alt="" className="h-full w-full object-contain" />
      )}
      <button
        type="button"
        data-resize="true"
        aria-label="Resize"
        className="absolute bottom-0 right-0 size-4 cursor-nwse-resize rounded-sm bg-[#5ce1ff]"
        onPointerDown={(event) => {
          event.stopPropagation()
          const startX = event.clientX
          const startY = event.clientY
          const origin = { w: layer.w, h: layer.h }
          const bounds = event.currentTarget.parentElement?.parentElement?.getBoundingClientRect() ?? null
          const move = (next: PointerEvent) => {
            if (!bounds) return
            const dw = ((next.clientX - startX) / bounds.width) * 100
            const dh = ((next.clientY - startY) / bounds.height) * 100
            const placed = placeLayer({ x: layer.x, y: layer.y, w: origin.w + dw, h: origin.h + dh }, limits)
            onChange({ ...layer, ...placed })
          }
          const stop = () => {
            window.removeEventListener("pointermove", move)
            window.removeEventListener("pointerup", stop)
          }
          window.addEventListener("pointermove", move)
          window.addEventListener("pointerup", stop)
        }}
      />
    </div>
  )
}

function top(layers: ProofLayer[]): number {
  return layers.reduce((highest, layer) => Math.max(highest, layer.z), 0)
}

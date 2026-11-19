"use client"

import { useState } from "react"

import { askComet } from "@/lib/image-edit/ask"
import { placeLayer, placementLimits } from "@/lib/image-edit/placement"
import type { ProofLayer } from "@/lib/image-edit/types"
import { geometryFor } from "@/lib/postcard-layouts/compose"

export function GalleryProof({
  layers,
  onChange,
}: {
  layers: ProofLayer[]
  onChange: (layers: ProofLayer[]) => void
}) {
  const [past, setPast] = useState<ProofLayer[][]>([])
  const [ask, setAsk] = useState("")
  const [reply, setReply] = useState("")
  const spec = geometryFor("5x8")
  const width = spec.artworkCanvasInches.widthInches
  const height = spec.artworkCanvasInches.heightInches

  function commit(next: ProofLayer[]) {
    setPast((history) => [...history, layers].slice(-20))
    onChange(next)
  }

  return (
    <div className="space-y-3" data-gallery-proof>
      <div className="relative overflow-hidden rounded-lg border bg-[#071018]" style={{ aspectRatio: `${width} / ${height}` }}>
        {layers.map((layer) => (
          <div
            key={layer.id}
            className="absolute"
            style={{ left: `${layer.x}%`, top: `${layer.y}%`, width: `${layer.w}%`, height: `${layer.h}%`, zIndex: layer.z, background: layer.kind === "color" ? layer.color : undefined }}
            onPointerDown={(event) => {
              if (layer.kind !== "text") return
              const startX = event.clientX
              const startY = event.clientY
              const origin = { x: layer.x, y: layer.y }
              const bounds = event.currentTarget.parentElement?.getBoundingClientRect() ?? null
              const limits = placementLimits("5x8", "front")
              const move = (next: PointerEvent) => {
                if (!bounds) return
                const placed = placeLayer(
                  {
                    x: origin.x + ((next.clientX - startX) / bounds.width) * 100,
                    y: origin.y + ((next.clientY - startY) / bounds.height) * 100,
                    w: layer.w,
                    h: layer.h,
                  },
                  limits
                )
                onChange(layers.map((item) => (item.id === layer.id ? { ...item, ...placed } : item)))
              }
              const stop = () => {
                window.removeEventListener("pointermove", move)
                window.removeEventListener("pointerup", stop)
              }
              window.addEventListener("pointermove", move)
              window.addEventListener("pointerup", stop)
            }}
          >
            {layer.kind === "text" ? (
              <p className="px-1 font-semibold leading-tight" style={{ color: layer.color, fontSize: "clamp(11px, 1.5vw, 20px)" }}>
                {layer.text}
              </p>
            ) : null}
          </div>
        ))}
      </div>
      <button
        type="button"
        className="min-h-11 rounded-xl border border-[#245068] px-3 text-sm"
        onClick={() => {
          const previous = past[past.length - 1]
          if (!previous) return
          setPast((history) => history.slice(0, -1))
          onChange(previous)
        }}
      >
        Undo
      </button>
      <form
        className="space-y-2"
        onSubmit={(event) => {
          event.preventDefault()
          void askComet({ instruction: ask, layers, face: "front", size: "5x8" }).then((result) => {
            if (result.layers !== layers) commit(result.layers)
            setReply(result.message)
            setAsk("")
          })
        }}
      >
        <label className="block text-sm">
          Ask Comet to make any adjustment!
          <textarea
            value={ask}
            onChange={(event) => setAsk(event.target.value)}
            rows={2}
            placeholder="Change the words to Roof check this week"
            className="mt-1 w-full rounded-xl border border-[#245068] bg-[#071018] px-3 py-2 text-sm"
          />
        </label>
        <button type="submit" disabled={!ask.trim()} className="min-h-11 rounded-xl bg-[#5ce1ff] px-4 text-sm font-semibold text-[#041018] disabled:opacity-40">
          Ask Comet
        </button>
        {reply ? <p className="text-sm">{reply}</p> : null}
      </form>
    </div>
  )
}

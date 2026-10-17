"use client"

import { useEffect, useState } from "react"

import { analyzePhotoField } from "@/lib/design-intelligence/photo-field"
import type { TypeSeat } from "@/lib/design-intelligence/rationale"

/**
 * Reads the photograph Studio is showing and finds a calm patch for type.
 * Same-origin campaign photos can be sampled. A failure leaves the layout alone.
 */
export function useTypeSeat(src: string | null | undefined): TypeSeat | null {
  const [reading, setReading] = useState<{ src: string; seat: TypeSeat | null } | null>(null)

  useEffect(() => {
    if (!src) return
    let cancelled = false
    void measure(src).then((seat) => {
      if (!cancelled) setReading({ src, seat })
    })
    return () => {
      cancelled = true
    }
  }, [src])

  if (!src || reading?.src !== src) return null
  return reading.seat
}

async function measure(src: string): Promise<TypeSeat | null> {
  try {
    const image = await loadImage(src)
    const width = 96
    const height = 60
    const canvas = document.createElement("canvas")
    canvas.width = width
    canvas.height = height
    const context = canvas.getContext("2d", { willReadFrequently: true })
    if (!context) return null
    context.drawImage(image, 0, 0, width, height)
    const pixels = context.getImageData(0, 0, width, height)
    return analyzePhotoField(pixels.data, width, height).seat
  } catch {
    return null
  }
}

function loadImage(src: string): Promise<CanvasImageSource> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error("photo"))
    image.src = src
  })
}

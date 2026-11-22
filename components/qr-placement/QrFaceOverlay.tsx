"use client"

import { useMemo, useRef, type RefObject } from "react"

import { paintQr } from "@/lib/campaign-creator/studio-qr"
import type { Click2MailSize } from "@/lib/print-spec/click2mail-keep-outs"

import {
  frameBox,
  qrBoxPercent,
  qrScanUrl,
  qrShortLabel,
  scanDestinationLine,
  type PlacedQr,
  type QrFrame,
  type QrSide,
} from "@/lib/qr-placement/model"

/**
 * Drag layer for one side of a card. The picture underneath is the finished
 * edit. This layer only draws the codes.
 */
export function QrFaceOverlay({
  size,
  side,
  frame,
  codes,
  onMove,
}: {
  size: Click2MailSize
  side: QrSide
  frame: QrFrame
  codes: readonly PlacedQr[]
  onMove: (id: string, xInches: number, yInches: number) => void
}) {
  const boxRef = useRef<HTMLDivElement>(null)
  const origin = typeof window === "undefined" ? "" : window.location.origin
  const mine = codes.filter((code) => code.side === side)
  if (mine.length === 0) return null

  return (
    <div ref={boxRef} className="pointer-events-none absolute inset-0" data-qr-overlay={side}>
      {mine.map((code) => (
        <QrHandle
          key={code.id}
          size={size}
          frame={frame}
          qr={code}
          payload={origin ? qrScanUrl(origin, code.code) : qrScanUrl("https://example.com", code.code)}
          boxRef={boxRef}
          onMove={onMove}
        />
      ))}
    </div>
  )
}

function QrHandle({
  size,
  frame,
  qr,
  payload,
  boxRef,
  onMove,
}: {
  size: Click2MailSize
  frame: QrFrame
  qr: PlacedQr
  payload: string
  boxRef: RefObject<HTMLDivElement | null>
  onMove: (id: string, xInches: number, yInches: number) => void
}) {
  const box = qrBoxPercent(size, frame, qr)
  const label = qrShortLabel(qr)
  const sentence = scanDestinationLine(qr)
  const grab = useRef({ x: 0, y: 0 })

  function pointerToTrim(clientX: number, clientY: number): { x: number; y: number } | null {
    const rect = boxRef.current?.getBoundingClientRect()
    if (!rect || rect.width < 1 || rect.height < 1) return null
    const physical = frameBox(size, frame)
    return {
      x: ((clientX - rect.left) / rect.width) * physical.widthInches - physical.bleedInches,
      y: ((clientY - rect.top) / rect.height) * physical.heightInches - physical.bleedInches,
    }
  }

  return (
    <button
      type="button"
      aria-label={`QR code. ${sentence} Drag to move it.`}
      title={sentence}
      className="pointer-events-auto absolute cursor-grab touch-none active:cursor-grabbing"
      style={{ left: `${box.left}%`, top: `${box.top}%`, width: `${box.width}%`, aspectRatio: "1" }}
      onPointerDown={(event) => {
        const point = pointerToTrim(event.clientX, event.clientY)
        if (!point) return
        grab.current = { x: point.x - qr.xInches, y: point.y - qr.yInches }
        event.currentTarget.setPointerCapture(event.pointerId)
      }}
      onPointerMove={(event) => {
        if (!event.currentTarget.hasPointerCapture(event.pointerId)) return
        const point = pointerToTrim(event.clientX, event.clientY)
        if (!point) return
        onMove(qr.id, point.x - grab.current.x, point.y - grab.current.y)
      }}
    >
      <QrGraphic payload={payload} />
      <span className="sr-only">{label}</span>
    </button>
  )
}

function QrGraphic({ payload }: { payload: string }) {
  const painted = useMemo(() => paintQr(payload), [payload])
  if (!painted) return <span className="block h-full w-full bg-white" />
  const total = painted.modules + painted.quiet * 2
  return (
    <svg viewBox={`0 0 ${total} ${total}`} className="h-full w-full bg-white shadow-sm" aria-hidden="true">
      <rect width={total} height={total} fill="#ffffff" />
      {painted.dark.map(([col, row]) => (
        <rect key={`${col}-${row}`} x={col + painted.quiet} y={row + painted.quiet} width="1" height="1" fill="#111111" />
      ))}
    </svg>
  )
}

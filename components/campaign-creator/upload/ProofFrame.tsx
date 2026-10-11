"use client"

import { buildPostcard5x8PrintSpec } from "@/lib/print-spec/postcard-5x8-print-spec"

interface ProofFrameProps {
  src: string
  mediaType: string
  face: "front" | "back"
  label: string
}

/**
 * The uploaded face, with the trim line and the address keep-out drawn on top.
 * Guides use the 5×8 print spec, the same geometry as the template.
 */
export function ProofFrame({ src, mediaType, face, label }: ProofFrameProps) {
  const spec = buildPostcard5x8PrintSpec()
  const width = spec.artworkCanvasInches.widthInches
  const height = spec.artworkCanvasInches.heightInches
  const isPdf = mediaType === "application/pdf"

  return (
    <figure className="flex flex-col gap-2">
      <figcaption className="text-sm font-medium">{label}</figcaption>
      <div
        className="relative overflow-hidden rounded-lg border bg-muted"
        style={{ aspectRatio: `${width} / ${height}` }}
      >
        {isPdf ? (
          <iframe
            title={label}
            src={`${src}#toolbar=0&navpanes=0&view=FitH`}
            className="absolute inset-0 h-full w-full border-0 bg-white"
          />
        ) : (
          // The proof is the customer's file. Leave the bytes alone.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={src} alt={label} className="absolute inset-0 h-full w-full object-contain bg-white" />
        )}
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="pointer-events-none absolute inset-0 h-full w-full"
          aria-hidden="true"
        >
          <rect
            x={spec.trimOnCanvas.xInches}
            y={spec.trimOnCanvas.yInches}
            width={spec.trimOnCanvas.widthInches}
            height={spec.trimOnCanvas.heightInches}
            fill="none"
            stroke="#1c1c1c"
            strokeWidth={0.02}
          />
          <rect
            x={spec.safeTextOnCanvas.xInches}
            y={spec.safeTextOnCanvas.yInches}
            width={spec.safeTextOnCanvas.widthInches}
            height={spec.safeTextOnCanvas.heightInches}
            fill="none"
            stroke="#1e4696"
            strokeWidth={0.015}
          />
          {face === "back" &&
            spec.keepOuts.map((keepOut) => (
              <rect
                key={keepOut.id}
                x={keepOut.canvas.xInches}
                y={keepOut.canvas.yInches}
                width={keepOut.canvas.widthInches}
                height={keepOut.canvas.heightInches}
                fill="rgba(196, 48, 48, 0.28)"
                stroke="#a02020"
                strokeWidth={0.015}
              />
            ))}
          {face === "back" && (
            <text
              x={spec.keepOuts[0]?.canvas.xInches ?? 0 + 0.15}
              y={(spec.keepOuts[0]?.canvas.yInches ?? 0) + 0.35}
              fill="#3a1010"
              fontSize={0.16}
            >
              Address, postage, and barcode
            </text>
          )}
        </svg>
      </div>
    </figure>
  )
}

"use client"

import { useMemo, type CSSProperties, type ReactNode } from "react"

import type { StudioContact } from "@/lib/campaign-creator/studio-contact"
import { displayWebsite } from "@/lib/campaign-creator/studio-contact"
import type { CreativeSpec } from "@/lib/campaign-creator/types"
import {
  composePostcardFace,
  showsReviewStars,
  type PostcardFacePlan,
  type ShapePlan,
} from "@/lib/postcard-layouts/compose"
import type { PostcardTemplateId, VerticalPaletteId } from "@/lib/postcard-layouts/ids"
import { isVerticalPalette } from "@/lib/postcard-layouts/ids"
import { trimInches } from "@/lib/postcard-layouts/templates"
import type { InchRect } from "@/lib/postcard-layouts/typefit"
import { lineHeightFor } from "@/lib/postcard-layouts/typefit"
import { paintQr } from "@/lib/campaign-creator/studio-qr"

const DISPLAY_CSS = {
  trade: 'var(--font-display-family), "Arial Black", "Helvetica Neue", Helvetica, Arial, sans-serif',
  signal: 'var(--font-signal-family), "Arial Narrow", "Helvetica Neue", Helvetica, Arial, sans-serif',
  letter: 'var(--font-letter-family), Georgia, "Times New Roman", serif',
} as const

const TEXT_CSS = 'var(--font-studio-family), "Helvetica Neue", Helvetica, Arial, sans-serif'

export function PremiumPostcardFront({
  templateId,
  spec,
  contact,
  photoSrc,
  alternatePhotoSrc,
  businessName,
  paletteId,
  compact,
}: {
  templateId: PostcardTemplateId
  spec: CreativeSpec
  contact: StudioContact
  photoSrc: string | null
  alternatePhotoSrc?: string | null
  businessName?: string
  paletteId?: VerticalPaletteId
  compact?: boolean
}) {
  const plan = composePostcardFace({
    templateId,
    spec: {
      ...spec,
      phone: contact.phone ?? spec.phone,
      website: contact.website ?? spec.website,
    },
    businessName: businessName ?? contact.businessName,
    qrPayload: contact.qrPayload,
    paletteId: paletteId ?? (isVerticalPalette(spec.layoutHints?.verticalPalette) ? spec.layoutHints.verticalPalette : "general"),
    face: "front",
  })
  const photos = [photoSrc, alternatePhotoSrc ?? null]
  return (
    <FaceFrame plan={plan} compact={Boolean(compact)}>
      <Shapes plan={plan} layer="back" />
      {plan.photos.map((slot, index) => (
        <PhotoSlot
          key={slot.id}
          rect={slot.rect}
          size={plan.size}
          src={photos[index] ?? (index === 0 ? photoSrc : null)}
          alt={spec.visualDirection?.trim() || "Campaign photograph"}
          wash={plan.palette.field}
          paper={plan.palette.paper}
        />
      ))}
      <Shapes plan={plan} layer="mid" />
      <Shapes plan={plan} layer="front" />
      {showsReviewStars(spec) ? <StarRow plan={plan} /> : null}
      {plan.texts.map((text) => (
        <Fitted key={`${text.role}-${text.rect.y}`} plan={plan} text={text} />
      ))}
      {plan.lockup ? <Lockup plan={plan} payload={contact.qrPayload} /> : null}
    </FaceFrame>
  )
}

export function PremiumBackMessage({
  templateId,
  spec,
  businessName,
  paletteId,
  disclaimer,
}: {
  templateId: PostcardTemplateId
  spec: CreativeSpec
  businessName?: string
  paletteId?: VerticalPaletteId
  disclaimer?: boolean
}) {
  const plan = composePostcardFace({
    templateId,
    spec,
    businessName,
    paletteId: paletteId ?? (isVerticalPalette(spec.layoutHints?.verticalPalette) ? spec.layoutHints.verticalPalette : "general"),
    face: "back",
    disclaimer,
  })
  return (
    <div data-template-back={plan.templateId} data-overflow={plan.overflows ? "yes" : "no"} className="absolute inset-0">
      <Shapes plan={plan} layer="front" />
      {plan.texts.map((text) => (
        <Fitted key={`${text.role}-${text.rect.y}`} plan={plan} text={text} />
      ))}
    </div>
  )
}

function FaceFrame({
  plan,
  compact,
  children,
}: {
  plan: PostcardFacePlan
  compact: boolean
  children: ReactNode
}) {
  return (
    <div
      className="relative h-full overflow-hidden"
      data-template={plan.templateId}
      data-pairing={plan.pairing}
      data-palette={plan.palette.id}
      data-overflow={plan.overflows ? "yes" : "no"}
      data-photo-slots={plan.photos.length}
      data-compact={compact ? "yes" : "no"}
      style={{
        backgroundColor: plan.palette.paper,
        color: plan.palette.ink,
        containerType: "inline-size",
        position: "relative",
        width: "100%",
        height: "100%",
        overflow: "hidden",
      }}
    >
      {children}
    </div>
  )
}

function Shapes({ plan, layer }: { plan: PostcardFacePlan; layer: "back" | "mid" | "front" }) {
  const shapes = plan.shapes.filter((shape) => shapeLayer(shape.role) === layer)
  return (
    <>
      {shapes.map((shape) => (
        <Shape key={shape.id} plan={plan} shape={shape} />
      ))}
    </>
  )
}

function shapeLayer(role: string): "back" | "mid" | "front" {
  if (role === "paper" || role === "field") return "back"
  if (role === "scrim" || role === "band") return "mid"
  return "front"
}

function Shape({ plan, shape }: { plan: PostcardFacePlan; shape: ShapePlan }) {
  const style = box(shape.rect, plan.size)
  if (shape.role === "scrim") {
    return (
      <div
        data-region="scrim"
        className="pointer-events-none absolute"
        style={{ ...style, background: scrimGradient(plan.palette.scrim) }}
      />
    )
  }
  if (shape.role === "starburst") {
    return (
      <svg viewBox="0 0 100 100" className="absolute" style={style} aria-hidden>
        <polygon points={starPoints(16, 0.72)} fill={plan.palette.accent} />
      </svg>
    )
  }
  if (shape.role === "badge") {
    return <div className="absolute rounded-full" style={{ ...style, backgroundColor: shape.fill }} />
  }
  if (shape.role === "coupon") {
    return (
      <div
        data-region="coupon"
        className="absolute"
        style={{
          ...style,
          backgroundColor: plan.palette.paper,
          border: `1.5px dashed ${plan.palette.accent}`,
        }}
      />
    )
  }
  if (shape.role === "rule") {
    return <div className="absolute" style={{ ...style, backgroundColor: plan.palette.accent }} />
  }
  return <div className="absolute" style={{ ...style, backgroundColor: shape.fill }} />
}

function PhotoSlot({
  rect,
  size,
  src,
  alt,
  wash,
  paper,
}: {
  rect: InchRect
  size: PostcardFacePlan["size"]
  src: string | null
  alt: string
  wash: string
  paper: string
}) {
  return (
    <div className="absolute overflow-hidden" data-photo-slot={src ? "filled" : "empty"} style={box(rect, size)}>
      {src ? (
        <img src={src} alt={alt} className="h-full w-full object-cover" draggable={false} />
      ) : (
        <div
          className="h-full w-full"
          style={{ background: `linear-gradient(160deg, ${wash} 0%, ${paper} 78%)` }}
        />
      )}
    </div>
  )
}

function Fitted({ plan, text }: { plan: PostcardFacePlan; text: PostcardFacePlan["texts"][number] }) {
  if (text.lines.length === 0) return null
  const family = text.font === "display" ? DISPLAY_CSS[plan.pairing] : TEXT_CSS
  return (
    <p
      className="absolute m-0 overflow-hidden"
      data-role={text.role}
      style={{
        ...box(text.rect, plan.size),
        color: text.color,
        fontFamily: family,
        fontWeight: text.font === "display" ? 800 : 600,
        fontSize: pointsToCqw(text.fontPt, plan.size),
        lineHeight: lineHeightFor(text.font),
        letterSpacing: text.font === "display" ? "-0.03em" : "0",
        textAlign: text.align,
      }}
    >
      {text.lines.map((line) => (
        <span key={line} style={{ display: "block" }}>
          {line}
        </span>
      ))}
    </p>
  )
}

function Lockup({ plan, payload }: { plan: PostcardFacePlan; payload: string | null }) {
  const lockup = plan.lockup
  if (!lockup) return null
  const trim = trimInches(plan.size)
  const qrSize = `${(lockup.qrInches / trim.w) * 100}%`
  return (
    <div className="absolute" data-contact-lockup="response" style={box(lockup.rect, plan.size)}>
      <div className="flex h-full items-center" style={{ gap: "0.12in" }}>
        {payload ? <QrMark payload={payload} label={lockup.qrLabel} width={qrSize} /> : null}
        <div className="min-w-0">
          {lockup.phone?.text ? (
            <p
              className="m-0 font-semibold leading-none"
              data-contact-phone={lockup.phone.text}
              style={{
                color: lockup.phone.color,
                fontFamily: TEXT_CSS,
                fontSize: pointsToCqw(lockup.phone.fontPt, plan.size),
              }}
            >
              {lockup.phone.text}
            </p>
          ) : null}
          {lockup.website?.text ? (
            <p
              className="m-0 mt-[0.2em] font-medium leading-none"
              data-contact-website={displayWebsite(lockup.website.text)}
              style={{
                color: lockup.website.color,
                fontFamily: TEXT_CSS,
                fontSize: pointsToCqw(lockup.website.fontPt, plan.size),
              }}
            >
              {displayWebsite(lockup.website.text)}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  )
}

function QrMark({ payload, label, width }: { payload: string; label: string; width: string }) {
  const painted = useMemo(() => paintQr(payload), [payload])
  if (!painted) return null
  const total = painted.modules + painted.quiet * 2
  return (
    <div className="shrink-0" style={{ width }}>
      <div className="bg-white" data-qr-tile="rounded">
        <svg viewBox={`0 0 ${total} ${total}`} role="img" aria-label={`QR code for ${payload}`} shapeRendering="crispEdges">
          <rect width={total} height={total} fill="#ffffff" />
          {painted.dark.map(([x, y]) => (
            <rect key={`${x}-${y}`} x={x + painted.quiet} y={y + painted.quiet} width={1} height={1} fill="#111111" />
          ))}
        </svg>
      </div>
      {label ? (
        <p data-qr-label={label} className="m-0 text-center font-semibold leading-none" style={{ color: "#14120f", background: "#fff", fontSize: "8px" }}>
          {label}
        </p>
      ) : null}
    </div>
  )
}

function StarRow({ plan }: { plan: PostcardFacePlan }) {
  const proof = plan.texts.find((text) => text.role === "proof")
  if (!proof) return null
  const rect = { x: proof.rect.x, y: Math.max(0.25, proof.rect.y - 0.28), w: 1.3, h: 0.24 }
  return (
    <svg viewBox="0 0 120 24" className="absolute" style={box(rect, plan.size)} aria-hidden data-stars="review">
      {Array.from({ length: 5 }, (_, index) => (
        <polygon key={index} transform={`translate(${index * 24},0) scale(0.22)`} points={starPoints(5, 0.45)} fill={plan.palette.accent} />
      ))}
    </svg>
  )
}

function box(rect: InchRect, size: PostcardFacePlan["size"]): CSSProperties {
  const trim = trimInches(size)
  return {
    position: "absolute",
    left: `${(rect.x / trim.w) * 100}%`,
    top: `${(rect.y / trim.h) * 100}%`,
    width: `${(rect.w / trim.w) * 100}%`,
    height: `${(rect.h / trim.h) * 100}%`,
  }
}

function pointsToCqw(points: number, size: PostcardFacePlan["size"]): string {
  const trim = trimInches(size)
  return `${((points / 72) * (100 / trim.w)).toFixed(3)}cqw`
}

function scrimGradient(color: string): string {
  return `linear-gradient(to bottom, ${withAlpha(color, 0)} 0%, ${withAlpha(color, 0.5)} 30%, ${withAlpha(color, 0.9)} 68%, ${withAlpha(color, 0.94)} 100%)`
}

function withAlpha(hex: string, alpha: number): string {
  const value = hex.replace("#", "")
  const r = Number.parseInt(value.slice(0, 2), 16)
  const g = Number.parseInt(value.slice(2, 4), 16)
  const b = Number.parseInt(value.slice(4, 6), 16)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

function starPoints(points: number, inner: number): string {
  const coords: string[] = []
  for (let index = 0; index < points * 2; index += 1) {
    const radius = index % 2 === 0 ? 46 : 46 * inner
    const angle = -Math.PI / 2 + (index * Math.PI) / points
    coords.push(`${(50 + Math.cos(angle) * radius).toFixed(2)},${(50 + Math.sin(angle) * radius).toFixed(2)}`)
  }
  return coords.join(" ")
}

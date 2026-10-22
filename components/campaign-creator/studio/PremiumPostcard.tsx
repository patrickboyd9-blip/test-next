"use client"

import { useMemo, type CSSProperties, type ReactNode } from "react"

import type { StudioContact } from "@/lib/campaign-creator/studio-contact"
import { displayWebsite } from "@/lib/campaign-creator/studio-contact"
import type { CreativeSpec } from "@/lib/campaign-creator/types"
import {
  composePostcardFace,
  type PostcardFacePlan,
  type ShapePlan,
} from "@/lib/postcard-layouts/compose"
import type { LayoutSizeId, PostcardTemplateId, VerticalPaletteId } from "@/lib/postcard-layouts/ids"
import { isVerticalPalette } from "@/lib/postcard-layouts/ids"
import { trimInches } from "@/lib/postcard-layouts/templates"
import type { InchRect } from "@/lib/postcard-layouts/typefit"
import { lineHeightFor } from "@/lib/postcard-layouts/typefit"
import { paintQr } from "@/lib/campaign-creator/studio-qr"
import { studioShapeLayer } from "@/lib/design-intelligence/studio-layer"
import { planWithRealThumbnails } from "./photo-plan"

const DISPLAY_CSS = {
  trade: 'var(--font-display-family), "Arial Black", "Helvetica Neue", Helvetica, Arial, sans-serif',
  signal: 'var(--font-signal-family), "Arial Narrow", "Helvetica Neue", Helvetica, Arial, sans-serif',
  letter: 'var(--font-letter-family), Georgia, "Times New Roman", serif',
} as const

const TEXT_CSS = 'var(--font-studio-family), "Helvetica Neue", Helvetica, Arial, sans-serif'

type FacePlan = PostcardFacePlan<LayoutSizeId>

export function PremiumPostcardFront({
  templateId,
  spec,
  contact,
  photoSrc,
  alternatePhotoSrc,
  cutoutSrc,
  thumbnailSrc,
  businessName,
  paletteId,
  compact,
  plan: prepared,
}: {
  templateId: PostcardTemplateId
  spec: CreativeSpec
  contact: StudioContact
  photoSrc: string | null
  alternatePhotoSrc?: string | null
  cutoutSrc?: string | null
  thumbnailSrc?: string | null
  businessName?: string
  paletteId?: VerticalPaletteId
  compact?: boolean
  plan?: FacePlan
}) {
  const plan = prepared ?? composePostcardFace({
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
  const thumbFill = thumbnailSrc ?? photoSrc ?? alternatePhotoSrc ?? cutoutSrc ?? null
  const painted = planWithRealThumbnails(plan, thumbFill)
  return (
    <FaceFrame plan={painted} compact={Boolean(compact)}>
      <Shapes plan={painted} layer="back" />
      {painted.photos.map((slot, index) => (
        <PhotoSlot
          key={slot.id}
          rect={slot.rect}
          size={painted.size}
          src={
            slot.treatment === "cutout"
              ? cutoutSrc ?? null
              : slot.treatment === "thumbnail"
                ? thumbFill
                : photos[index] ?? null
          }
          alt={spec.visualDirection?.trim() || "Campaign photograph"}
          paper={plan.palette.paper}
          treatment={slot.treatment}
        />
      ))}
      <Shapes plan={painted} layer="mid" />
      <Shapes plan={painted} layer="front" />
      <TrustChips plan={painted} />
      {painted.texts.map((text) => (
        <Fitted key={`${text.role}-${text.rect.y}`} plan={painted} text={text} />
      ))}
      {painted.lockup ? <Lockup plan={painted} payload={contact.qrPayload} /> : null}
    </FaceFrame>
  )
}

export function PremiumBackMessage({
  templateId,
  spec,
  businessName,
  paletteId,
  disclaimer,
  complianceMark,
}: {
  templateId: PostcardTemplateId
  spec: CreativeSpec
  businessName?: string
  paletteId?: VerticalPaletteId
  disclaimer?: boolean
  complianceMark?: string | null
}) {
  const plan = composePostcardFace({
    templateId,
    spec,
    businessName,
    paletteId: paletteId ?? (isVerticalPalette(spec.layoutHints?.verticalPalette) ? spec.layoutHints.verticalPalette : "general"),
    face: "back",
    disclaimer,
    complianceMark,
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
  plan: FacePlan
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

function Shapes({ plan, layer }: { plan: FacePlan; layer: "back" | "mid" | "front" }) {
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
  return studioShapeLayer(role)
}

function Shape({ plan, shape }: { plan: FacePlan; shape: ShapePlan }) {
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
  if (shape.role === "local-scrim") {
    const fromRight = shape.rect.x > trimInches(plan.size).w * 0.45
    return (
      <div
        data-region="local-scrim"
        className="pointer-events-none absolute"
        style={{ ...style, background: localScrimGradient(shape.fill, fromRight) }}
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
          backgroundColor: shape.fill,
          border: `1.5px dashed ${plan.palette.accent}`,
        }}
      />
    )
  }
  if (shape.role === "offer-tile") {
    return <div data-region="offer-tile" className="absolute" style={{ ...style, backgroundColor: shape.fill }} />
  }
  if (shape.role === "rule") {
    return <div className="absolute" style={{ ...style, backgroundColor: plan.palette.accent }} />
  }
  if (shape.role === "chip") {
    return (
      <div
        data-region="chip"
        className="absolute rounded-full"
        style={{ ...style, backgroundColor: shape.fill }}
      />
    )
  }
  return <div className="absolute" style={{ ...style, backgroundColor: shape.fill }} />
}

function PhotoSlot({
  rect,
  size,
  src,
  alt,
  paper,
  treatment,
}: {
  rect: InchRect
  size: LayoutSizeId
  src: string | null
  alt: string
  paper: string
  treatment?: "cover" | "cutout" | "thumbnail"
}) {
  const cutout = treatment === "cutout"
  if (cutout && !src) return null
  return (
    <div
      className={cutout ? "absolute overflow-visible" : "absolute overflow-hidden"}
      data-photo-slot={src ? "filled" : "empty"}
      data-photo-treatment={treatment ?? "cover"}
      style={box(rect, size)}
    >
      {src ? (
        <img
          src={src}
          alt={alt}
          className={cutout ? "h-full w-full object-contain object-left" : "h-full w-full object-cover"}
          draggable={false}
        />
      ) : (
        <div className="h-full w-full" style={{ backgroundColor: paper }} />
      )}
    </div>
  )
}

function Fitted({ plan, text }: { plan: FacePlan; text: FacePlan["texts"][number] }) {
  if (text.lines.length === 0) return null
  const family = text.font === "display" ? DISPLAY_CSS[plan.pairing] : TEXT_CSS
  return (
    <p
      className="absolute m-0"
      data-role={text.role}
      style={{
        ...box(text.rect, plan.size),
        color: text.color,
        fontFamily: family,
        fontWeight: text.font === "display" ? 800 : 600,
        fontSize: pointsToCqw(text.fontPt, plan.size),
        lineHeight: text.role === "offer" ? 0.8 : lineHeightFor(text.font),
        letterSpacing: text.font === "display" ? "-0.03em" : "0",
        textAlign: text.align,
        textShadow: plan.shapes.some((shape) => shape.role === "local-scrim")
          ? "0 1px 1px rgba(20, 18, 15, 0.35)"
          : undefined,
        display: text.role === "offer" || text.role === "label" ? "flex" : "block",
        flexDirection: "column",
        justifyContent: "center",
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

function Lockup({ plan, payload }: { plan: FacePlan; payload: string | null }) {
  const lockup = plan.lockup
  if (!lockup) return null
  return (
    <div data-contact-lockup="response">
      {lockup.phoneBox ? (
        <div
          data-phone-box="yes"
          className="absolute"
          style={{ ...box(lockup.phoneBox.rect, plan.size), backgroundColor: lockup.phoneBox.fill }}
        />
      ) : null}
      {payload ? (
        <div className="absolute" style={box(lockup.qrRect, plan.size)}>
          <QrMark payload={payload} label={lockup.qrLabel} labelPt={lockup.qrLabelPt} size={plan.size} />
        </div>
      ) : null}
      {lockup.phone?.text ? (
        <p
          className="absolute m-0 flex items-center font-semibold leading-none"
          data-contact-phone={lockup.phone.text}
          style={{
            ...box(lockup.phone.rect, plan.size),
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
          className="absolute m-0 font-medium leading-none"
          data-contact-website={displayWebsite(lockup.website.text)}
          style={{
            ...box(lockup.website.rect, plan.size),
            color: lockup.website.color,
            fontFamily: TEXT_CSS,
            fontSize: pointsToCqw(lockup.website.fontPt, plan.size),
          }}
        >
          {displayWebsite(lockup.website.text)}
        </p>
      ) : null}
    </div>
  )
}

function TrustChips({ plan }: { plan: FacePlan }) {
  if (plan.trust.length === 0) return null
  return (
    <>
      {plan.trust.map((chip) => (
        <div
          key={chip.id}
          data-trust-chip={chip.label}
          className="absolute flex items-center justify-center overflow-hidden rounded-full font-semibold"
          style={{
            ...box(chip.rect, plan.size),
            backgroundColor: chip.fill,
            color: chip.color,
            fontFamily: TEXT_CSS,
            fontSize: pointsToCqw(chip.fontPt, plan.size),
          }}
        >
          {chip.label}
        </div>
      ))}
    </>
  )
}

function QrMark({
  payload,
  label,
  labelPt,
  size,
}: {
  payload: string
  label: string
  labelPt: number
  size: LayoutSizeId
}) {
  const painted = useMemo(() => paintQr(payload), [payload])
  if (!painted) return null
  const total = painted.modules + painted.quiet * 2
  return (
    <div className="flex h-full w-full flex-col">
      <div className="min-h-0 flex-1 bg-white" data-qr-tile="rounded">
        <svg viewBox={`0 0 ${total} ${total}`} role="img" aria-label={`QR code for ${payload}`} shapeRendering="crispEdges" className="h-full w-full">
          <rect width={total} height={total} fill="#ffffff" />
          {painted.dark.map(([x, y]) => (
            <rect key={`${x}-${y}`} x={x + painted.quiet} y={y + painted.quiet} width={1} height={1} fill="#111111" />
          ))}
        </svg>
      </div>
      {label ? (
        <p data-qr-label={label} className="m-0 shrink-0 bg-white text-center font-semibold leading-none" style={{ color: "#14120f", fontSize: pointsToCqw(labelPt, size) }}>
          {label}
        </p>
      ) : null}
    </div>
  )
}

function box(rect: InchRect, size: LayoutSizeId): CSSProperties {
  const trim = trimInches(size)
  return {
    position: "absolute",
    left: `${(rect.x / trim.w) * 100}%`,
    top: `${(rect.y / trim.h) * 100}%`,
    width: `${(rect.w / trim.w) * 100}%`,
    height: `${(rect.h / trim.h) * 100}%`,
  }
}

function pointsToCqw(points: number, size: LayoutSizeId): string {
  const trim = trimInches(size)
  return `${((points / 72) * (100 / trim.w)).toFixed(3)}cqw`
}

function scrimGradient(color: string): string {
  return `linear-gradient(to bottom, ${withAlpha(color, 0)} 0%, ${withAlpha(color, 0.5)} 30%, ${withAlpha(color, 0.9)} 68%, ${withAlpha(color, 0.94)} 100%)`
}

function localScrimGradient(color: string, fromRight: boolean): string {
  const solid = withAlpha(color, 0.4)
  const clear = withAlpha(color, 0)
  return fromRight
    ? `linear-gradient(to left, ${solid} 0%, ${solid} 62%, ${clear} 100%)`
    : `linear-gradient(to right, ${solid} 0%, ${solid} 62%, ${clear} 100%)`
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

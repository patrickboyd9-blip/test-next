"use client"

import { useMemo, type CSSProperties } from "react"

import { cn } from "@/lib/utils"
import type { CreativeSpec, LayoutVariant } from "@/lib/campaign-creator/types"
import {
  businessNameForCard,
  displayWebsite,
  type StudioContact,
} from "@/lib/campaign-creator/studio-contact"
import { paintQr } from "@/lib/campaign-creator/studio-qr"
import { STUDIO_DISPLAY_CSS, STUDIO_TEXT_CSS } from "@/lib/campaign-creator/studio-typeface"

import {
  layoutIssueCopy,
  photoScrimGradient,
  pointsToCqw,
  postcardBackRegions,
  resolvePostcardLayout,
  type NormRect,
  type PostcardLayoutPlan,
} from "./postcard-layout-qa"
import { rubricFailures } from "./postcard-rubric"
import {
  studioCompositionTreatment,
  studioPrintMarks,
  type CropPreset,
  type CtaMark,
} from "./studio-composition-treatment"
import { studioCompositionStructure } from "./studio-composition-structure"
import {
  studioCompositionDerivation,
  typeOnlyRealization,
} from "./studio-composition-derivation"

const CROP_CLASS: Record<CropPreset, string> = {
  tight: "object-[68%_28%] scale-[1.12]",
  default: "object-[72%_40%]",
  open: "object-[50%_46%]",
}

const ROLE_LABELS: Record<string, string> = {
  return_address: "Return address",
  postage_indicia: "Postage indicia",
  delivery_address: "Delivery address",
  barcode_clear_zone: "Barcode clear zone",
}

export function postcardLayoutIssues(
  spec: CreativeSpec,
  compact: boolean,
  showWordmark: boolean,
  contact?: StudioContact
) {
  return resolvePostcardLayout({ spec, compact, showWordmark, contact }).issues
}

export function PostcardFrontFace({
  spec,
  layout,
  compact,
  photoSrc,
  showMonogram,
  contact,
  photoAlt,
}: {
  spec: CreativeSpec
  layout: LayoutVariant
  compact: boolean
  photoSrc: string | null
  showMonogram: boolean
  contact: StudioContact
  photoAlt: string
}) {
  const wordmark = businessNameForCard(contact.businessName, spec.headline)
  const plan = resolvePostcardLayout({
    spec,
    compact,
    showWordmark: Boolean(wordmark) && !compact,
    contact,
  })
  const treatment = studioCompositionTreatment({
    leadJob: spec.leadJob,
    imageryRole: spec.imageryRole,
    layoutVariant: layout,
  })
  const derivation = studioCompositionDerivation({
    layoutVariant: layout,
    typeRole: spec.typeRole,
    imagePresence: spec.imagePresence,
  })
  const structure = studioCompositionStructure(layout)
  const realization = typeOnlyRealization(derivation, compact)
  const marks = studioPrintMarks(treatment, layout)
  const photoRegion = photoRegionName(layout)
  const typeRegion = typeRegionName(layout)
  const banded = layout === "banded_split"

  return (
    <div
      className="relative h-full"
      style={{
        backgroundColor: plan.family === "photo-dominant" ? "#1c1917" : plan.colors.field,
        fontFamily: STUDIO_TEXT_CSS,
        color: plan.colors.ink,
      }}
      data-composition={structure.layoutVariant}
      data-layout-family={plan.family}
      data-photo-share={plan.photoShare.toFixed(3)}
      data-headline-pt={plan.typePt.headline.toFixed(1)}
      data-headline-weight={plan.headlineWeight}
      data-layout-issues={plan.issues.map((issue) => issue.code).join(" ") || "none"}
      data-rubric-fails={rubricFailures(plan.rubric).map((check) => check.id).join(" ") || "none"}
      data-qr-in={plan.qrInches.toFixed(3)}
      data-type-presence={derivation.typePresence}
      data-image-plate={derivation.imagePlate}
      data-void={derivation.voidShape}
      data-safe-inset="0.25in"
      data-type-measure={realization.typeMeasure}
      data-marks-region={realization.marksRegion}
      data-figure-source={realization.figureSource ?? undefined}
    >
      {plan.photoRect && photoRegion ? (
        <div
          data-region={photoRegion}
          className="absolute overflow-hidden"
          style={rectStyle(plan.photoRect)}
        >
          <PhotoSlot
            src={photoSrc}
            alt={photoAlt}
            wordmark={showMonogram ? contact.businessName ?? null : null}
            monogram={showMonogram && !contact.businessName ? monogramLetter(plan.hero) : null}
            fallback={plan.colors.field}
            primary={plan.colors.ink}
            crop={treatment.cropPreset}
          />
        </div>
      ) : null}
      {plan.family === "photo-dominant" && plan.scrimRect ? (
        <div
          data-region="scrim"
          data-scrim="gradient"
          className="pointer-events-none absolute"
          style={{
            ...rectStyle(plan.scrimRect),
            background: photoScrimGradient(plan) ?? undefined,
          }}
        />
      ) : null}
      <div
        data-region={typeRegion}
        className="absolute flex flex-col overflow-hidden"
        style={{
          ...rectStyle(plan.textColumn),
          backgroundColor: plan.family === "photo-dominant" ? "transparent" : plan.colors.field,
          padding: "1.25% 1.5%",
        }}
      >
        <div data-region={banded ? "band" : undefined} className="min-w-0 shrink-0">
          {wordmark && !compact ? (
            <p
              className="mb-[0.35em] font-semibold uppercase tracking-[0.16em]"
              style={{
                color: plan.colors.ink,
                fontSize: pointsToCqw(plan.typePt.wordmark),
                opacity: 0.88,
              }}
            >
              {wordmark}
            </p>
          ) : null}
          <DisplayStack plan={plan} compact={compact} />
        </div>
        <div
          data-region={
            banded ? "supporting" : realization.mode === "object" ? "field" : undefined
          }
          className="mt-auto shrink-0 pt-[0.35em]"
        >
          <PrintMarks
            spec={spec}
            plan={plan}
            compact={compact}
            contact={contact}
            mark={marks.ctaMark}
          />
        </div>
      </div>
    </div>
  )
}

export function LayoutIssueNote({ issues }: { issues: PostcardLayoutPlan["issues"] }) {
  if (issues.length === 0) return null
  const lines = [...new Set(issues.map(layoutIssueCopy))]
  return (
    <p className="mt-2 max-w-sm text-center text-xs text-muted-foreground" role="status">
      {lines.join(" ")}
    </p>
  )
}

export function PostcardBackFace({
  primary,
  secondary,
  accent,
  reservedRoles,
  compact,
}: {
  primary: string
  secondary: string
  accent: string
  reservedRoles: readonly string[]
  compact: boolean
}) {
  const regions = postcardBackRegions()
  const has = (role: string) => reservedRoles.includes(role)
  const paper = accent || "#f7f6f2"

  return (
    <div className="relative h-full" style={{ backgroundColor: paper }} data-safe-inset="0.25in">
      {has("return_address") ? (
        <ReservedRegion
          label={ROLE_LABELS.return_address}
          compact={compact}
          border={secondary}
          rect={regions.returnAddress}
        />
      ) : null}
      {has("postage_indicia") ? (
        <ReservedRegion
          label={ROLE_LABELS.postage_indicia}
          compact={compact}
          border={secondary}
          rect={regions.indicia}
        />
      ) : null}
      {has("delivery_address") ? (
        <ReservedRegion
          label={ROLE_LABELS.delivery_address}
          compact={compact}
          border={primary}
          rect={regions.mailingPanel}
          emphasis
        />
      ) : null}
      {has("barcode_clear_zone") ? (
        <ReservedRegion
          label={ROLE_LABELS.barcode_clear_zone}
          compact={compact}
          border={secondary}
          rect={regions.barcodeStrip}
        />
      ) : null}
    </div>
  )
}

function DisplayStack({ plan, compact }: { plan: PostcardLayoutPlan; compact: boolean }) {
  return (
    <div className="min-w-0">
      {plan.hero ? (
        <p
          className="font-extrabold"
          data-headline-weight={plan.headlineWeight}
          style={{
            fontFamily: STUDIO_DISPLAY_CSS,
            fontWeight: plan.headlineWeight,
            fontSize: pointsToCqw(plan.typePt.headline),
            lineHeight: 1.02,
            letterSpacing: "-0.03em",
            color: plan.colors.headline,
          }}
        >
          {plan.hero}
        </p>
      ) : null}
      {!compact && plan.subheadline ? (
        <p
          className="mt-[0.35em] font-semibold"
          style={{
            fontSize: pointsToCqw(plan.typePt.subhead),
            lineHeight: 1.18,
            color: plan.colors.ink,
          }}
        >
          {plan.subheadline}
        </p>
      ) : null}
      {!compact && plan.offerLine ? (
        <p
          className="mt-[0.3em] font-semibold"
          style={{
            fontSize: pointsToCqw(plan.typePt.offer),
            lineHeight: 1.15,
            color: plan.colors.ink,
          }}
        >
          {plan.offerLine}
        </p>
      ) : null}
      {!compact && plan.body ? (
        <p
          className="mt-[0.35em]"
          style={{
            fontSize: pointsToCqw(plan.typePt.body),
            lineHeight: 1.25,
            color: plan.colors.ink,
          }}
        >
          {plan.body}
        </p>
      ) : null}
    </div>
  )
}

function PrintMarks({
  spec,
  plan,
  compact,
  contact,
  mark,
}: {
  spec: CreativeSpec
  plan: PostcardLayoutPlan
  compact: boolean
  contact: StudioContact
  mark: CtaMark
}) {
  return (
    <div className="flex items-end gap-[0.6em]">
      <div className="min-w-0 flex-1 space-y-[0.28em]">
        {spec.callToAction ? (
          <PrintCta
            mark={mark}
            size={pointsToCqw(plan.typePt.cta)}
            color={plan.colors.ink}
            fill={plan.colors.ctaFill}
            ink={plan.colors.ctaInk}
          >
            {spec.callToAction}
          </PrintCta>
        ) : null}
        {!compact ? (
          <ContactPrint
            contact={contact}
            color={plan.colors.ink}
            phoneSize={pointsToCqw(plan.typePt.contact)}
            websiteSize={pointsToCqw(Math.max(11, plan.typePt.contact - 3))}
          />
        ) : null}
      </div>
      {contact.qrPayload ? (
        <QrMark payload={contact.qrPayload} sizeIn={plan.qrInches} />
      ) : null}
    </div>
  )
}

function PrintCta({
  children,
  color,
  fill,
  ink,
  size,
  mark,
}: {
  children: string
  color: string
  fill: string
  ink: string
  size: string
  mark: CtaMark
}) {
  if (mark === "reverse-slug") {
    return (
      <p
        className="inline-block max-w-[18ch] font-bold leading-[1.05] tracking-[-0.02em]"
        style={{
          backgroundColor: fill,
          color: ink,
          fontSize: size,
          padding: "0.22em 0.4em 0.16em",
        }}
      >
        {children}
      </p>
    )
  }

  return (
    <p
      className="max-w-[22ch] font-semibold leading-snug tracking-[-0.015em]"
      style={{ color, fontSize: size }}
    >
      {children}
    </p>
  )
}

function ContactPrint({
  contact,
  color,
  phoneSize,
  websiteSize,
}: {
  contact: StudioContact
  color: string
  phoneSize: string
  websiteSize: string
}) {
  if (!contact.phone && !contact.website) return null
  return (
    <div className="min-w-0">
      {contact.phone ? (
        <p
          className="font-semibold leading-none tabular-nums tracking-[-0.02em]"
          style={{ color, fontSize: phoneSize }}
        >
          {contact.phone}
        </p>
      ) : null}
      {contact.website ? (
        <p className="mt-[0.2em] font-medium leading-none" style={{ color, fontSize: websiteSize }}>
          {displayWebsite(contact.website)}
        </p>
      ) : null}
    </div>
  )
}

function QrMark({ payload, sizeIn }: { payload: string; sizeIn: number }) {
  const painted = useMemo(() => paintQr(payload), [payload])
  if (!painted) return null
  const total = painted.modules + painted.quiet * 2
  const symbol = `${((sizeIn / 8) * 100).toFixed(3)}cqw`
  // Stay inside the four-module quiet zone so the rounded corner never clips a module.
  const radius = `${(((sizeIn * 1.6) / total / 8) * 100).toFixed(3)}cqw`
  return (
    <div
      className="shrink-0 bg-white"
      data-qr-tile="rounded"
      style={{ width: symbol, borderRadius: radius, overflow: "hidden" }}
    >
      <svg
        viewBox={`0 0 ${total} ${total}`}
        role="img"
        aria-label={`QR code for ${payload}`}
        data-qr-modules={painted.modules}
        data-qr-quiet-modules={painted.quiet}
        shapeRendering="crispEdges"
        style={{ display: "block", width: "100%", height: "auto" }}
      >
        <rect width={total} height={total} fill="#ffffff" />
        {painted.dark.map(([x, y]) => (
          <rect
            key={`${x}-${y}`}
            x={x + painted.quiet}
            y={y + painted.quiet}
            width={1}
            height={1}
            fill="#111111"
          />
        ))}
      </svg>
      <p
        className="text-center font-semibold uppercase tracking-[0.12em]"
        style={{
          color: "#14120f",
          fontSize: "clamp(7px, 1.2cqw, 11px)",
          lineHeight: 1,
          padding: "0.35em 0.4em 0.55em",
        }}
      >
        Scan to book
      </p>
    </div>
  )
}

function PhotoSlot({
  src,
  alt,
  wordmark,
  monogram,
  fallback,
  primary,
  crop = "default",
}: {
  src: string | null
  alt: string
  wordmark: string | null
  monogram: string | null
  fallback: string
  primary: string
  crop?: CropPreset
}) {
  if (src) {
    return (
      <img
        src={src}
        alt={alt}
        className={cn("h-full w-full object-cover", CROP_CLASS[crop])}
        draggable={false}
      />
    )
  }

  if (wordmark) {
    return (
      <div
        className="flex h-full w-full items-center justify-center px-[12%]"
        style={{ backgroundColor: fallback }}
      >
        <p
          className="text-center font-semibold uppercase leading-tight tracking-[0.14em]"
          style={{ color: primary, fontSize: "clamp(11px, 4.2cqw, 18px)" }}
        >
          {wordmark}
        </p>
      </div>
    )
  }

  if (monogram) {
    return (
      <div
        className="flex h-full w-full items-center justify-center"
        style={{ backgroundColor: fallback }}
      >
        <span
          className="font-semibold uppercase tracking-[0.18em]"
          style={{ color: primary, fontSize: "clamp(18px, 8cqw, 36px)" }}
        >
          {monogram}
        </span>
      </div>
    )
  }

  return null
}

function ReservedRegion({
  label,
  compact,
  border,
  rect,
  emphasis = false,
}: {
  label: string
  compact: boolean
  border: string
  rect: NormRect
  emphasis?: boolean
}) {
  return (
    <div
      className={cn("absolute flex items-end", compact ? "px-1 py-0.5" : "px-2 py-1.5")}
      style={{
        ...rectStyle(rect),
        boxShadow: `inset 0 0 0 1px ${border}59`,
        backgroundColor: emphasis ? "#fff" : "transparent",
      }}
    >
      <span
        className={cn(
          "uppercase tracking-[0.12em]",
          compact ? "text-[5px]" : "text-[7px]",
          emphasis ? "font-medium" : "font-normal"
        )}
        style={{ color: border, opacity: 0.55 }}
      >
        {label}
      </span>
    </div>
  )
}

function photoRegionName(layout: LayoutVariant): string | null {
  if (layout === "peer_split") return "peer-image"
  if (layout === "type_primary_split") return "supporting-image"
  if (layout === "banded_split") return "image"
  if (layout === "image_grounded") return "image-ground"
  return null
}

function typeRegionName(layout: LayoutVariant): string {
  if (layout === "peer_split") return "peer-type"
  if (layout === "image_grounded") return "inscription"
  return "type"
}

function rectStyle(rect: NormRect): CSSProperties {
  return {
    left: `${rect.x * 100}%`,
    top: `${rect.y * 100}%`,
    width: `${rect.w * 100}%`,
    height: `${rect.h * 100}%`,
  }
}

function monogramLetter(headline: string | undefined): string {
  const letter = headline?.trim().charAt(0)
  return letter ? letter.toUpperCase() : "M"
}

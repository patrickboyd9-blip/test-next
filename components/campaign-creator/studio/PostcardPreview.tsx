"use client"

import { motion } from "framer-motion"

import { cn } from "@/lib/utils"
import type { CreativeCanvas } from "@/lib/campaign-creator/creative-canvas"
import { resolveCreativeImage } from "@/lib/campaign-creator/resolve-creative-image"
import {
  normalizeLayoutVariant,
  type CreativeSpec,
  type LayoutVariant,
} from "@/lib/campaign-creator/types"
import { useReducedMotion } from "@/hooks/use-reduced-motion"

import { ShimmerOverlay, SpecDiffHighlight } from "./SpecDiffHighlight"
import {
  studioCompositionTreatment,
  type CropPreset,
  type CtaWeight,
  type PhotoWeight,
  type StudioCompositionTreatment,
  type TypeEmphasis,
} from "./studio-composition-treatment"
import {
  studioCopyHierarchy,
  type StudioCopyHierarchy,
} from "./studio-copy-hierarchy"

export type PostcardPreviewSize = "hero" | "medium" | "thumbnail"

interface PostcardPreviewProps {
  canvas: CreativeCanvas
  spec: CreativeSpec
  side?: "front" | "back"
  size?: PostcardPreviewSize
  className?: string
  enableHoverTilt?: boolean
  highlightRegions?: string[]
  isShimmering?: boolean
  ariaLabel?: string
}

const SIZE_CLASSES: Record<PostcardPreviewSize, string> = {
  hero: "w-full max-w-[320px] sm:max-w-[360px] md:max-w-[420px]",
  medium: "w-full max-w-[280px]",
  thumbnail: "w-full h-full min-h-[100px]",
}

/**
 * ADR-006 Studio viewing convention for the 5×8 postcard: 8:5 landscape.
 * Presentation only — not catalog orientation, not production width×height.
 * Do not derive this from canvas.trimSizeInches.
 */
const STUDIO_VIEWING_ASPECT_CLASS = "aspect-[8/5]"

const DEFAULT_PALETTE = ["#1e3a5f", "#4a90a4", "#f5f5f0"] as const

const ROLE_LABELS: Record<string, string> = {
  return_address: "Return address",
  postage_indicia: "Postage indicia",
  delivery_address: "Delivery address",
  barcode_clear_zone: "Barcode clear zone",
}

const CROP_CLASS: Record<CropPreset, string> = {
  tight: "object-[68%_28%] scale-[1.12]",
  default: "object-[72%_40%]",
  open: "object-[50%_46%]",
}

export function PostcardPreview({
  canvas,
  spec,
  side = "front",
  size = "hero",
  className,
  enableHoverTilt = true,
  highlightRegions = [],
  isShimmering = false,
  ariaLabel,
}: PostcardPreviewProps) {
  const reducedMotion = useReducedMotion()
  const [primary, secondary, accent] = spec.palette ?? DEFAULT_PALETTE
  const layout = normalizeLayoutVariant(spec.layoutVariant) ?? "peer_split"
  const isAddressSide = side === canvas.addressFace
  const imagery = resolveCreativeImage(spec.imagery, spec.imageryRole)
  const photoSrc = imagery.src
  const showMonogram = imagery.showMonogram

  const content = isAddressSide ? (
    <PostcardBack
      primary={primary}
      secondary={secondary}
      accent={accent}
      reservedRoles={canvas.reservedRegionRoles}
      compact={size === "thumbnail"}
    />
  ) : (
    <PostcardFront
      spec={spec}
      primary={primary}
      secondary={secondary}
      accent={accent}
      layout={layout}
      size={size}
      photoSrc={photoSrc}
      showMonogram={showMonogram}
      fullBleed={canvas.fullBleedExpected}
    />
  )

  const hoverProps =
    enableHoverTilt && !reducedMotion
      ? {
          whileHover: {
            rotateY: 2,
            scale: 1.01,
            transition: { duration: 0.2, ease: "easeOut" as const },
          },
          style: { transformPerspective: 800 },
        }
      : {}

  return (
    <motion.div
      className={cn(
        "@container relative overflow-hidden rounded-lg shadow-lg sm:shadow-lg",
        STUDIO_VIEWING_ASPECT_CLASS,
        SIZE_CLASSES[size],
        size === "thumbnail" && "shadow-md",
        className
      )}
      role="img"
      aria-label={ariaLabel ?? `Postcard preview: ${spec.headline ?? "Creative design"}`}
      {...hoverProps}
    >
      {content}
      {!isAddressSide && (
        <>
          <ShimmerOverlay active={isShimmering} />
          <SpecDiffHighlight regions={highlightRegions} active={highlightRegions.length > 0} />
        </>
      )}
    </motion.div>
  )
}

function PostcardFront({
  spec,
  primary,
  secondary,
  accent,
  layout,
  size,
  photoSrc,
  showMonogram,
  fullBleed,
}: {
  spec: CreativeSpec
  primary: string
  secondary: string
  accent: string
  layout: LayoutVariant
  size: PostcardPreviewSize
  photoSrc: string | null
  showMonogram: boolean
  fullBleed: boolean
}) {
  const compact = size === "thumbnail"
  const treatment = studioCompositionTreatment({
    leadJob: spec.leadJob,
    imageryRole: spec.imageryRole,
    layoutVariant: layout,
  })
  const headlineScale = spec.layoutHints?.headlineScale ?? 1
  const hierarchy = studioCopyHierarchy(spec.leadJob)
  const field = treatment.paletteMode === "field"
  const surface = field ? primary : accent
  const ink = field ? inkOn(primary) : primary
  const context: FrontContext = {
    spec,
    primary,
    secondary,
    accent,
    surface,
    ink,
    compact,
    type: typeScale(
      compact,
      spec.leadJob === "urgency" ? Math.min(headlineScale * 1.1, 1.25) : headlineScale,
      treatment.typeEmphasis
    ),
    phoneBottomRight: spec.layoutHints?.phonePosition === "bottom-right",
    qrLarge: spec.layoutHints?.qrProminence === "large",
    showQr: Boolean(spec.qrDestination?.trim() || spec.website?.trim()),
    offer: spec.offer?.trim() || "",
    photoAlt: spec.visualDirection?.trim() || "Campaign photography",
    inkPrimary: inkOn(primary),
    photoSrc,
    showMonogram,
    hierarchy,
    treatment,
  }

  const face =
    layout === "type_primary_split" ? (
      <OfferHeroFront {...context} />
    ) : layout === "banded_split" ? (
      <UrgencyBannerFront {...context} />
    ) : layout === "image_grounded" ? (
      <PhotoLedFront {...context} />
    ) : layout === "type_only" ? (
      <MinimalCtaFront {...context} />
    ) : (
      <TrustFirstFront {...context} />
    )

  if (fullBleed) return face

  return (
    <div className="h-full p-[2%]" style={{ backgroundColor: accent }}>
      <div className="h-full overflow-hidden">{face}</div>
    </div>
  )
}

interface FrontContext {
  spec: CreativeSpec
  primary: string
  secondary: string
  accent: string
  surface: string
  ink: string
  compact: boolean
  type: TypeScale
  phoneBottomRight: boolean
  qrLarge: boolean
  showQr: boolean
  offer: string
  photoAlt: string
  inkPrimary: string
  photoSrc: string | null
  showMonogram: boolean
  hierarchy: StudioCopyHierarchy
  treatment: StudioCompositionTreatment
}

interface TypeScale {
  headline: string
  offer: string
  sub: string
  body: string
  cta: string
  footer: string
}

function typeScale(
  compact: boolean,
  headlineScale: number,
  emphasis: TypeEmphasis
): TypeScale {
  const emphasisBoost = emphasis === "aggressive" ? 1.12 : emphasis === "quiet" ? 0.9 : 1
  const h = Math.min(Math.max(headlineScale * emphasisBoost, 0.85), 1.28)
  return {
    headline: compact
      ? `clamp(15px, ${8.2 * h}cqw, 22px)`
      : `clamp(20px, ${7.6 * h}cqw, 30px)`,
    offer: compact
      ? `clamp(16px, ${9.4 * h}cqw, 24px)`
      : `clamp(22px, ${8.8 * h}cqw, 34px)`,
    sub: compact ? "clamp(9px, 3.4cqw, 11px)" : "clamp(11px, 3.2cqw, 13px)",
    body: "clamp(10px, 2.9cqw, 12px)",
    cta: compact ? "clamp(9px, 3.6cqw, 11px)" : "clamp(11px, 3.3cqw, 13px)",
    footer: "clamp(7px, 2.3cqw, 9px)",
  }
}

function headlineWeight(emphasis: TypeEmphasis): string {
  return emphasis === "quiet" ? "font-medium" : "font-bold"
}

function typeBreathing(compact: boolean, emphasis: TypeEmphasis): string {
  if (emphasis === "quiet") return compact ? "px-3 py-2.5" : "px-5 py-5 sm:px-6 sm:py-5"
  if (emphasis === "aggressive") return compact ? "px-2 py-1.5" : "px-3.5 py-3 sm:px-4 sm:py-3.5"
  return compact ? "px-2 py-2" : "px-4 py-3.5 sm:px-5 sm:py-4"
}

function offerLeads(
  hierarchy: StudioCopyHierarchy,
  layoutDefault: boolean
): boolean {
  if (hierarchy === "layout-default") return layoutDefault
  return hierarchy === "offer-hero"
}

function offerHeroPhotoWidth(weight: PhotoWeight): string {
  if (weight === "subordinate") return "w-[36%]"
  if (weight === "dominant") return "w-[58%]"
  return "w-[48%]"
}

function offerHeroTypeWidth(weight: PhotoWeight): string {
  if (weight === "subordinate") return "w-[68%]"
  if (weight === "dominant") return "w-[50%]"
  return "w-[58%]"
}

function trustPhotoFlex(weight: PhotoWeight): string {
  if (weight === "subordinate") return "flex-[4]"
  if (weight === "dominant") return "flex-[7]"
  return "flex-[5]"
}

function trustTypeFlex(weight: PhotoWeight): string {
  if (weight === "subordinate") return "flex-[7]"
  if (weight === "dominant") return "flex-[5]"
  return "flex-[6]"
}

function bannerPhotoFlex(weight: PhotoWeight): string {
  if (weight === "subordinate") return "flex-[1]"
  if (weight === "dominant") return "flex-[2]"
  return "flex-[1.35]"
}

function photoLedPanelWidth(weight: PhotoWeight): string {
  if (weight === "dominant") return "w-[34%]"
  if (weight === "subordinate") return "w-[48%]"
  return "w-[40%]"
}

function isQuietInk(treatment: StudioCompositionTreatment): boolean {
  return treatment.paletteMode === "ink" && treatment.typeEmphasis === "quiet"
}

function OfferHeroFront({
  spec,
  secondary,
  surface,
  ink,
  compact,
  type,
  phoneBottomRight,
  qrLarge,
  showQr,
  offer,
  photoAlt,
  photoSrc,
  showMonogram,
  hierarchy,
  treatment,
}: FrontContext) {
  const leadWithOffer = offerLeads(hierarchy, true)
  const photoWeight = treatment.photoWeight
  return (
    <div className="relative h-full" style={{ backgroundColor: surface }}>
      <div className={cn("absolute inset-y-0 right-0 overflow-hidden", offerHeroPhotoWidth(photoWeight))}>
        <PhotoSlot
          src={photoSrc}
          alt={photoAlt}
          monogram={showMonogram ? monogramLetter(spec.headline) : null}
          fallback={secondary}
          primary={ink}
          crop={treatment.cropPreset}
        />
      </div>
      <div
        className={cn(
          "relative z-10 flex h-full flex-col justify-between",
          offerHeroTypeWidth(photoWeight),
          typeBreathing(compact, treatment.typeEmphasis)
        )}
        style={{ backgroundColor: surface }}
      >
        <div className="min-w-0 max-w-[22ch]">
          {leadWithOffer && offer ? (
            <p
              className={cn(headlineWeight(treatment.typeEmphasis), "leading-[0.95] tracking-[-0.035em]")}
              style={{ color: ink, fontSize: type.offer }}
            >
              {offer}
            </p>
          ) : null}
          <p
            className={cn(
              "max-w-[18ch] leading-[1.05] tracking-[-0.02em]",
              leadWithOffer && offer ? "mt-2" : "",
              treatment.typeEmphasis === "quiet" ? "font-medium" : "font-semibold"
            )}
            style={{
              color: ink,
              fontSize: type.headline,
              opacity: leadWithOffer && offer ? 0.88 : 1,
            }}
          >
            {spec.headline}
          </p>
          {!leadWithOffer && !compact && spec.subheadline ? (
            <p
              className="mt-2 max-w-[22ch] leading-snug"
              style={{ color: ink, fontSize: type.sub, opacity: 0.72 }}
            >
              {spec.subheadline}
            </p>
          ) : null}
        </div>
        <div>
          {!leadWithOffer && offer ? (
            <p
              className="mb-2 font-medium"
              style={{ color: ink, fontSize: type.sub, opacity: 0.8 }}
            >
              {offer}
            </p>
          ) : null}
          {spec.callToAction ? (
            <PrintCta color={ink} size={type.cta} weight={treatment.ctaWeight}>
              {spec.callToAction}
            </PrintCta>
          ) : null}
          <div className="mt-2 flex items-end justify-between gap-2">
            {!compact ? (
              <PostcardFooter
                spec={spec}
                color={ink}
                phoneBottomRight={phoneBottomRight}
                size={type.footer}
                quiet
              />
            ) : (
              <span />
            )}
            {showQr ? <QrMark tone={ink} compact={compact} large={qrLarge} /> : null}
          </div>
        </div>
      </div>
    </div>
  )
}

function TrustFirstFront({
  spec,
  secondary,
  surface,
  ink,
  compact,
  type,
  phoneBottomRight,
  qrLarge,
  showQr,
  offer,
  photoAlt,
  photoSrc,
  showMonogram,
  hierarchy,
  treatment,
}: FrontContext) {
  const leadWithOffer = offerLeads(hierarchy, false)
  const quiet = treatment.typeEmphasis === "quiet"
  return (
    <div
      className={cn(
        "flex h-full",
        quiet
          ? compact
            ? "gap-2.5 p-2"
            : "gap-4 p-4 sm:p-5"
          : compact
            ? "gap-2 p-1.5"
            : "gap-3.5 p-3 sm:p-3.5"
      )}
      style={{ backgroundColor: surface }}
    >
      <div className={cn("relative min-w-0 overflow-hidden", trustPhotoFlex(treatment.photoWeight))}>
        <PhotoSlot
          src={photoSrc}
          alt={photoAlt}
          monogram={showMonogram ? monogramLetter(spec.headline) : null}
          fallback={secondary}
          primary={ink}
          crop={treatment.cropPreset}
        />
      </div>
      <div className={cn("flex min-w-0 flex-col justify-between", trustTypeFlex(treatment.photoWeight))}>
        <div>
          {leadWithOffer && offer ? (
            <p
              className={cn(headlineWeight(treatment.typeEmphasis), "leading-[0.95] tracking-[-0.035em]")}
              style={{ color: ink, fontSize: type.offer }}
            >
              {offer}
            </p>
          ) : null}
          <p
            className={cn(
              "max-w-[16ch] leading-[1.05] tracking-[-0.025em]",
              leadWithOffer && offer ? "mt-2" : "",
              treatment.typeEmphasis === "quiet" ? "font-medium" : "font-semibold"
            )}
            style={{
              color: ink,
              fontSize: type.headline,
              opacity: leadWithOffer && offer ? 0.88 : 1,
            }}
          >
            {spec.headline}
          </p>
          <div className="mt-1.5 h-px w-6" style={{ backgroundColor: secondary, opacity: quiet ? 0.5 : 1 }} />
          {!compact && spec.subheadline ? (
            <p
              className="mt-2 max-w-[22ch] leading-snug"
              style={{ color: ink, fontSize: type.sub, opacity: 0.72 }}
            >
              {spec.subheadline}
            </p>
          ) : null}
          {!compact && spec.body ? (
            <p
              className="mt-2 line-clamp-2 max-w-[24ch] leading-relaxed"
              style={{ color: ink, fontSize: type.body, opacity: quiet ? 0.5 : 0.58 }}
            >
              {spec.body}
            </p>
          ) : null}
        </div>
        <div>
          {!leadWithOffer && offer && !compact ? (
            <p
              className="mb-2 font-medium"
              style={{ color: ink, fontSize: type.sub, opacity: 0.8 }}
            >
              {offer}
            </p>
          ) : null}
          {spec.callToAction ? (
            <PrintCta color={ink} size={type.cta} weight={treatment.ctaWeight}>
              {spec.callToAction}
            </PrintCta>
          ) : null}
          <div className="mt-2 flex items-end justify-between gap-2">
            {!compact ? (
              <PostcardFooter
                spec={spec}
                color={ink}
                phoneBottomRight={phoneBottomRight}
                size={type.footer}
                quiet
              />
            ) : (
              <span />
            )}
            {showQr ? <QrMark tone={ink} compact={compact} large={qrLarge} /> : null}
          </div>
        </div>
      </div>
    </div>
  )
}

function UrgencyBannerFront({
  spec,
  primary,
  secondary,
  surface,
  ink,
  compact,
  type,
  phoneBottomRight,
  qrLarge,
  showQr,
  offer,
  photoAlt,
  inkPrimary,
  photoSrc,
  showMonogram,
  hierarchy,
  treatment,
}: FrontContext) {
  const leadWithOffer = offerLeads(hierarchy, false)
  const bannerText = leadWithOffer && offer ? offer : spec.headline
  const supportOffer = leadWithOffer ? "" : offer
  const offerSize = hierarchy === "layout-default" ? type.offer : type.sub
  const quietInk = isQuietInk(treatment)
  const bannerFill = quietInk ? surface : primary
  const bannerInk = quietInk ? ink : inkPrimary
  return (
    <div className="flex h-full" style={{ backgroundColor: surface }}>
      <div className="flex min-w-0 flex-[4] flex-col">
        <div
          className={cn(
            "flex flex-1 items-end",
            compact ? "px-2 py-1.5" : "px-4 py-3"
          )}
          style={{ backgroundColor: bannerFill, color: bannerInk }}
        >
          <p
            className={cn(
              "max-w-[16ch] leading-[0.92] tracking-[-0.03em]",
              headlineWeight(treatment.typeEmphasis)
            )}
            style={{ fontSize: leadWithOffer ? type.offer : type.headline }}
          >
            {bannerText}
          </p>
        </div>
        <div
          className={cn(
            "flex flex-[1.15] flex-col justify-between",
            compact ? "px-2 py-1.5" : "px-4 py-2.5"
          )}
        >
          {leadWithOffer && spec.headline ? (
            <p
              className="max-w-[18ch] font-semibold leading-[1.05] tracking-[-0.02em]"
              style={{ color: ink, fontSize: type.headline, opacity: 0.88 }}
            >
              {spec.headline}
            </p>
          ) : supportOffer ? (
            <p
              className="max-w-[18ch] font-semibold leading-[1.05] tracking-[-0.02em]"
              style={{ color: ink, fontSize: offerSize }}
            >
              {supportOffer}
            </p>
          ) : spec.subheadline ? (
            <p
              className="font-semibold leading-tight"
              style={{ color: ink, fontSize: type.sub }}
            >
              {spec.subheadline}
            </p>
          ) : null}
          <div>
            {spec.callToAction ? (
              <PrintCta color={ink} size={type.cta} weight={treatment.ctaWeight}>
                {spec.callToAction}
              </PrintCta>
            ) : null}
            {!compact ? (
              <div className="mt-1.5">
                <PostcardFooter
                  spec={spec}
                  color={ink}
                  phoneBottomRight={phoneBottomRight}
                  size={type.footer}
                  quiet
                />
              </div>
            ) : null}
          </div>
        </div>
      </div>
      <div className={cn("relative min-w-0 overflow-hidden", bannerPhotoFlex(treatment.photoWeight))}>
        <PhotoSlot
          src={photoSrc}
          alt={photoAlt}
          monogram={showMonogram ? monogramLetter(spec.headline) : null}
          fallback={secondary}
          primary={ink}
          crop={treatment.cropPreset}
        />
        {showQr ? (
          <div className="absolute bottom-1.5 right-1.5">
            <QrMark tone={ink} compact={compact} large={qrLarge} onPhoto />
          </div>
        ) : null}
      </div>
    </div>
  )
}

function PhotoLedFront({
  spec,
  primary,
  secondary,
  surface,
  ink,
  compact,
  type,
  phoneBottomRight,
  qrLarge,
  showQr,
  offer,
  photoAlt,
  inkPrimary,
  photoSrc,
  showMonogram,
  hierarchy,
  treatment,
}: FrontContext) {
  const leadWithOffer = offerLeads(hierarchy, false)
  const quietInk = isQuietInk(treatment)
  const panelFill = quietInk ? surface : primary
  const panelInk = quietInk ? ink : inkPrimary
  return (
    <div className="relative h-full" style={{ backgroundColor: secondary }}>
      <PhotoSlot
        src={photoSrc}
        alt={photoAlt}
        monogram={showMonogram ? monogramLetter(spec.headline) : null}
        fallback={secondary}
        primary={panelInk}
        crop={treatment.cropPreset}
      />
      <div
        className={cn(
          "absolute inset-y-0 right-0 flex flex-col justify-end",
          photoLedPanelWidth(treatment.photoWeight),
          compact
            ? "px-2 py-2"
            : treatment.typeEmphasis === "quiet"
              ? "px-4 py-4"
              : "px-3.5 py-3.5"
        )}
        style={{ backgroundColor: panelFill, color: panelInk }}
      >
        {leadWithOffer && offer ? (
          <p
            className={cn(headlineWeight(treatment.typeEmphasis), "max-w-[14ch] leading-[0.95] tracking-[-0.03em]")}
            style={{ fontSize: type.offer }}
          >
            {offer}
          </p>
        ) : null}
        <p
          className={cn(
            "max-w-[14ch] leading-[1.02] tracking-[-0.025em]",
            leadWithOffer && offer ? "mt-2" : "",
            treatment.typeEmphasis === "quiet" ? "font-medium" : "font-semibold"
          )}
          style={{ fontSize: type.headline, opacity: leadWithOffer && offer ? 0.88 : 1 }}
        >
          {spec.headline}
        </p>
        {!leadWithOffer && offer ? (
          <p
            className="mt-2 font-medium leading-snug"
            style={{ fontSize: type.sub, opacity: 0.88 }}
          >
            {offer}
          </p>
        ) : !leadWithOffer && !compact && spec.subheadline ? (
          <p className="mt-2 leading-snug opacity-75" style={{ fontSize: type.sub }}>
            {spec.subheadline}
          </p>
        ) : null}
        {spec.callToAction ? (
          <div className="mt-3">
            <PrintCta color={panelInk} size={type.cta} weight={treatment.ctaWeight}>
              {spec.callToAction}
            </PrintCta>
          </div>
        ) : null}
        <div className="mt-2 flex items-end justify-between gap-2">
          {!compact ? (
            <PostcardFooter
              spec={spec}
              color={panelInk}
              phoneBottomRight={phoneBottomRight}
              size={type.footer}
              quiet
            />
          ) : (
            <span />
          )}
          {showQr ? <QrMark tone={panelInk} compact={compact} large={qrLarge} /> : null}
        </div>
      </div>
    </div>
  )
}

function MinimalCtaFront({
  spec,
  surface,
  ink,
  compact,
  type,
  phoneBottomRight,
  qrLarge,
  showQr,
  offer,
  hierarchy,
  treatment,
}: FrontContext) {
  const leadWithOffer = offerLeads(hierarchy, false)
  return (
    <div
      className={cn(
        "flex h-full flex-col justify-between",
        treatment.typeEmphasis === "quiet"
          ? compact
            ? "px-3 py-2.5"
            : "px-8 py-7"
          : treatment.typeEmphasis === "aggressive"
            ? compact
              ? "px-2.5 py-2"
              : "px-6 py-5"
            : compact
              ? "px-2.5 py-2"
              : "px-7 py-6"
      )}
      style={{ backgroundColor: surface }}
    >
      <div>
        {leadWithOffer && offer ? (
          <p
            className={cn(headlineWeight(treatment.typeEmphasis), "max-w-[16ch] leading-[0.95] tracking-[-0.035em]")}
            style={{ color: ink, fontSize: type.offer }}
          >
            {offer}
          </p>
        ) : null}
        <p
          className={cn(
            "max-w-[14ch] leading-[0.95] tracking-[-0.035em]",
            leadWithOffer && offer ? "mt-2" : "",
            treatment.typeEmphasis === "quiet" ? "font-medium" : "font-semibold"
          )}
          style={{
            color: ink,
            fontSize: type.headline,
            opacity: leadWithOffer && offer ? 0.88 : 1,
          }}
        >
          {spec.headline}
        </p>
      </div>
      <div>
        {!leadWithOffer && offer ? (
          <p
            className="mb-3 max-w-[20ch] font-medium"
            style={{ color: ink, fontSize: type.sub, opacity: 0.75 }}
          >
            {offer}
          </p>
        ) : null}
        <div className="flex items-end justify-between gap-3">
          {spec.callToAction ? (
            <PrintCta color={ink} size={type.cta} weight={treatment.ctaWeight}>
              {spec.callToAction}
            </PrintCta>
          ) : (
            <span />
          )}
          {showQr ? <QrMark tone={ink} compact={compact} large={qrLarge} /> : null}
        </div>
        {!compact ? (
          <div className="mt-3">
            <PostcardFooter
              spec={spec}
              color={ink}
              phoneBottomRight={phoneBottomRight}
              size={type.footer}
              quiet
            />
          </div>
        ) : null}
      </div>
    </div>
  )
}

function PhotoSlot({
  src,
  alt,
  monogram,
  fallback,
  primary,
  crop = "default",
}: {
  src: string | null
  alt: string
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

  if (monogram) {
    return (
      <div
        className="flex h-full w-full items-center justify-center"
        style={{ backgroundColor: fallback }}
      >
        <span
          className="flex size-[38%] items-center justify-center text-[18px] font-semibold sm:text-[22px]"
          style={{ backgroundColor: primary, color: inkOn(primary) }}
        >
          {monogram}
        </span>
      </div>
    )
  }

  return <div className="h-full w-full" style={{ backgroundColor: fallback }} aria-hidden />
}

function PrintCta({
  children,
  color,
  size,
  weight = "default",
}: {
  children: string
  color: string
  size: string
  weight?: CtaWeight
}) {
  if (weight === "strong") {
    return (
      <span
        className="inline-flex items-center px-2 py-1 font-semibold leading-none tracking-[0.04em]"
        style={{ backgroundColor: color, color: inkOn(color), fontSize: size }}
      >
        {children}
      </span>
    )
  }

  if (weight === "quiet") {
    return (
      <span
        className="font-medium leading-none tracking-[0.06em]"
        style={{ color, fontSize: size, opacity: 0.72 }}
      >
        {children}
      </span>
    )
  }

  return (
    <div className="flex items-center gap-1.5">
      <span className="h-px w-3 shrink-0" style={{ backgroundColor: color }} />
      <span
        className="font-medium leading-none tracking-[0.04em]"
        style={{ color, fontSize: size }}
      >
        {children}
      </span>
    </div>
  )
}

function QrMark({
  tone,
  compact,
  large = false,
  onPhoto = false,
}: {
  tone: string
  compact: boolean
  large?: boolean
  onPhoto?: boolean
}) {
  const cells = [1, 1, 1, 1, 0, 1, 1, 1, 1]
  return (
    <div
      className={cn(
        "grid shrink-0 grid-cols-3 gap-px p-px",
        compact ? "size-3.5" : large ? "size-6" : "size-5",
        onPhoto && "bg-white/90"
      )}
      style={onPhoto ? undefined : { backgroundColor: `${tone}14` }}
      aria-hidden
    >
      {cells.map((on, index) => (
        <span
          key={index}
          className="block"
          style={{ backgroundColor: on ? tone : "transparent" }}
        />
      ))}
    </div>
  )
}

function PostcardFooter({
  spec,
  color,
  phoneBottomRight = false,
  size,
  quiet = false,
}: {
  spec: CreativeSpec
  color: string
  phoneBottomRight?: boolean
  size: string
  quiet?: boolean
}) {
  if (!spec.phone && !spec.website) return null

  const parts = [spec.phone, spec.website].filter(Boolean)
  const style = {
    color,
    fontSize: size,
    opacity: quiet ? 0.42 : 0.58,
    letterSpacing: "0.02em",
  }

  if (phoneBottomRight && spec.phone) {
    return (
      <p className="min-w-0 truncate" style={style}>
        {spec.phone}
      </p>
    )
  }

  return (
    <p className="min-w-0 truncate" style={style}>
      {parts.join("  ·  ")}
    </p>
  )
}

function PostcardBack({
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
  const has = (role: string) => reservedRoles.includes(role)
  const paper = accent || "#f7f6f2"

  return (
    <div
      className={cn("flex h-full flex-col", compact ? "gap-1 p-1.5" : "gap-2.5 p-3.5")}
      style={{ backgroundColor: paper }}
    >
      <div className="h-px w-10 shrink-0" style={{ backgroundColor: primary, opacity: 0.7 }} />
      <div className={cn("flex shrink-0", compact ? "gap-1.5" : "gap-2.5")}>
        {has("return_address") ? (
          <ReservedRegion
            label={ROLE_LABELS.return_address}
            compact={compact}
            className="h-9 flex-[2] sm:h-11"
            border={secondary}
          />
        ) : null}
        {has("postage_indicia") ? (
          <ReservedRegion
            label={ROLE_LABELS.postage_indicia}
            compact={compact}
            className="h-9 flex-1 sm:h-11"
            border={secondary}
          />
        ) : null}
      </div>
      {has("delivery_address") ? (
        <ReservedRegion
          label={ROLE_LABELS.delivery_address}
          compact={compact}
          className="min-h-0 flex-1"
          border={primary}
          emphasis
        />
      ) : (
        <div className="flex-1" />
      )}
      {has("barcode_clear_zone") ? (
        <ReservedRegion
          label={ROLE_LABELS.barcode_clear_zone}
          compact={compact}
          className="h-5 shrink-0 sm:h-6"
          border={secondary}
        />
      ) : null}
    </div>
  )
}

function ReservedRegion({
  label,
  compact,
  className,
  border,
  emphasis = false,
}: {
  label: string
  compact: boolean
  className?: string
  border: string
  emphasis?: boolean
}) {
  return (
    <div
      className={cn("flex items-end", compact ? "px-1 py-0.5" : "px-2 py-1.5", className)}
      style={{
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

function inkOn(background: string): string {
  const hex = background.replace("#", "")
  if (hex.length !== 6) return "#1a1a1a"
  const r = parseInt(hex.slice(0, 2), 16)
  const g = parseInt(hex.slice(2, 4), 16)
  const b = parseInt(hex.slice(4, 6), 16)
  const luma = (r * 299 + g * 587 + b * 114) / 1000
  return luma > 160 ? "#1a1a1a" : "#f7f7f4"
}

function monogramLetter(headline: string | undefined): string {
  const letter = headline?.trim().charAt(0)
  return letter ? letter.toUpperCase() : "M"
}

interface PostcardSideToggleProps {
  side: "front" | "back"
  onSideChange: (side: "front" | "back") => void
}

export function PostcardSideToggle({ side, onSideChange }: PostcardSideToggleProps) {
  return (
    <div
      className="inline-flex rounded-lg border border-border p-0.5"
      role="tablist"
      aria-label="Postcard side"
    >
      {(["front", "back"] as const).map((value) => (
        <button
          key={value}
          type="button"
          role="tab"
          aria-selected={side === value}
          onClick={() => onSideChange(value)}
          className={cn(
            "rounded-md px-3 py-1 text-xs font-medium capitalize transition-colors",
            side === value
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          {value}
        </button>
      ))}
    </div>
  )
}

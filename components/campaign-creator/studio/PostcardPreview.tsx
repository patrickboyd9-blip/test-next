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
  resolveStudioPalette,
  studioCompositionTreatment,
  studioPrintMarks,
  studioTypeExecution,
  type CropPreset,
  type CtaMark,
  type PhotoWeight,
  type StudioCompositionTreatment,
  type TypeRhythm,
  type TypeWeight,
} from "./studio-composition-treatment"
import {
  studioCopyHierarchy,
  copyOfferLeads,
  type StudioCopyHierarchy,
} from "./studio-copy-hierarchy"
import { studioCompositionStructure } from "./studio-composition-structure"

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
  const { field: surface, ink, emphasis } = resolveStudioPalette(
    [primary, secondary, accent],
    treatment
  )
  const context: FrontContext = {
    spec,
    primary,
    secondary,
    accent,
    surface,
    ink,
    emphasis,
    compact,
    type: typeScale(compact, headlineScale, studioTypeExecution(treatment).scale),
    phoneBottomRight: spec.layoutHints?.phonePosition === "bottom-right",
    qrLarge: spec.layoutHints?.qrProminence === "large",
    showQr: Boolean(spec.qrDestination?.trim() || spec.website?.trim()),
    offer: spec.offer?.trim() || "",
    photoAlt: spec.visualDirection?.trim() || "Campaign photography",
    photoSrc,
    showMonogram,
    hierarchy,
    treatment,
    layout,
  }

  const face =
    layout === "type_primary_split" ? (
      <TypePrimaryFront {...context} />
    ) : layout === "banded_split" ? (
      <BandedSplitFront {...context} />
    ) : layout === "image_grounded" ? (
      <ImageGroundedFront {...context} />
    ) : layout === "type_only" ? (
      <TypeOnlyFront {...context} />
    ) : (
      <PeerSplitFront {...context} />
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
  emphasis: string
  compact: boolean
  type: TypeScale
  phoneBottomRight: boolean
  qrLarge: boolean
  showQr: boolean
  offer: string
  photoAlt: string
  photoSrc: string | null
  showMonogram: boolean
  hierarchy: StudioCopyHierarchy
  treatment: StudioCompositionTreatment
  layout: LayoutVariant
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
  voiceScale: number
): TypeScale {
  const h = Math.min(Math.max(headlineScale * voiceScale, 0.85), 1.28)
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

function headlineWeight(weight: TypeWeight): string {
  if (weight === "medium") return "font-medium"
  if (weight === "extrabold") return "font-extrabold"
  return "font-bold"
}

function typeRhythmClass(rhythm: TypeRhythm): string {
  if (rhythm === "immediate") return "leading-[0.95] tracking-[-0.04em]"
  if (rhythm === "compressed") return "leading-[0.84] tracking-[-0.055em]"
  if (rhythm === "composed") return "leading-[1.12] tracking-[-0.012em]"
  if (rhythm === "tense") return "leading-[0.9] tracking-[-0.02em]"
  return "leading-[1.05] tracking-[-0.025em]"
}

function typeBreathing(compact: boolean, rhythm: TypeRhythm): string {
  if (rhythm === "composed") return compact ? "px-3 py-2.5" : "px-5 py-5 sm:px-6 sm:py-5"
  if (rhythm === "compressed") return compact ? "px-2 py-1.5" : "px-3 py-2.5 sm:px-3.5 sm:py-3"
  if (rhythm === "immediate" || rhythm === "tense") {
    return compact ? "px-2 py-1.5" : "px-3.5 py-3 sm:px-4 sm:py-3.5"
  }
  return compact ? "px-2 py-2" : "px-4 py-3.5 sm:px-5 sm:py-4"
}

function LeadType({
  spec,
  offer,
  leadWithOffer,
  compact,
  type,
  color,
  emphasis,
  treatment,
  showBody,
  heroSize,
}: {
  spec: CreativeSpec
  offer: string
  leadWithOffer: boolean
  compact: boolean
  type: TypeScale
  color: string
  emphasis: string
  treatment: StudioCompositionTreatment
  showBody: boolean
  heroSize?: string
}) {
  const hero = leadWithOffer && offer ? offer : spec.headline
  const size = heroSize ?? (leadWithOffer && offer ? type.offer : type.headline)
  const voice = studioTypeExecution(treatment)
  const heroColor = voice.heroColor === "emphasis" ? emphasis : color
  return (
    <div className="min-w-0">
      {hero ? (
        <p
          className={cn(headlineWeight(voice.weight), "max-w-[16ch]", typeRhythmClass(voice.rhythm))}
          style={{ color: heroColor, fontSize: size }}
        >
          {hero}
        </p>
      ) : null}
      {leadWithOffer && offer && spec.headline ? (
        <p
          className={cn(
            "mt-2 max-w-[18ch]",
            voice.rhythm === "composed"
              ? "font-medium leading-snug tracking-[-0.01em]"
              : "font-semibold leading-[1.05] tracking-[-0.02em]"
          )}
          style={{ color, fontSize: type.headline, opacity: voice.rhythm === "composed" ? 0.72 : 0.88 }}
        >
          {spec.headline}
        </p>
      ) : null}
      {!leadWithOffer && !compact && spec.subheadline ? (
        <p
          className="mt-2 max-w-[22ch] leading-snug"
          style={{ color, fontSize: type.sub, opacity: 0.72 }}
        >
          {spec.subheadline}
        </p>
      ) : null}
      {showBody && !compact && spec.body ? (
        <p
          className="mt-2 line-clamp-2 max-w-[24ch] leading-relaxed"
          style={{
            color,
            fontSize: type.body,
            opacity: voice.rhythm === "composed" ? 0.5 : 0.58,
          }}
        >
          {spec.body}
        </p>
      ) : null}
    </div>
  )
}

function PrintMarks({
  spec,
  offer,
  leadWithOffer,
  compact,
  type,
  color,
  emphasis,
  surface,
  treatment,
  phoneBottomRight,
  showQr,
  qrLarge,
  onPhoto = false,
  layout,
}: {
  spec: CreativeSpec
  offer: string
  leadWithOffer: boolean
  compact: boolean
  type: TypeScale
  color: string
  emphasis: string
  surface: string
  treatment: StudioCompositionTreatment
  phoneBottomRight: boolean
  showQr: boolean
  qrLarge: boolean
  onPhoto?: boolean
  layout: LayoutVariant
}) {
  const marks = studioPrintMarks(treatment, layout)
  const arrangement = marks.arrangement
  const cta = spec.callToAction ? (
    <PrintCta color={color} emphasis={emphasis} size={type.cta} mark={marks.ctaMark}>
      {spec.callToAction}
    </PrintCta>
  ) : null
  const contact = !compact ? (
    <ContactPrint
      spec={spec}
      color={color}
      phoneBottomRight={phoneBottomRight}
      size={type.footer}
    />
  ) : null
  const qr = showQr ? (
    <QrMark
      tone={color}
      field={onPhoto ? "#f7f7f4" : surface}
      compact={compact}
      large={qrLarge}
      onPhoto={onPhoto}
    />
  ) : null
  const supportingOffer =
    !leadWithOffer && offer ? (
      <p
        className="max-w-[20ch] font-medium leading-snug"
        style={{ color, fontSize: type.sub, opacity: 0.85 }}
      >
        {offer}
      </p>
    ) : null

  if (arrangement === "inscription") {
    return (
      <div className={compact ? "mt-1.5 space-y-1.5" : "mt-2 space-y-2"}>
        {supportingOffer}
        {cta}
        <div className="flex items-end gap-3">
          <div className="min-w-0 flex-1">{contact}</div>
          {qr}
        </div>
      </div>
    )
  }

  if (arrangement === "sole-type") {
    return (
      <div className={compact ? "mt-3 space-y-2" : "mt-5 space-y-2.5"}>
        {supportingOffer}
        <div className="flex items-end gap-3">
          <div className="min-w-0">{cta}</div>
          {qr}
        </div>
        {contact}
      </div>
    )
  }

  return (
    <div className={compact ? "mt-2 space-y-2" : "mt-3 space-y-2.5"}>
      {supportingOffer}
      {cta}
      {contact}
      {qr}
    </div>
  )
}

function supportingImagePlate(compact: boolean, weight: PhotoWeight): string {
  if (compact) {
    return weight === "balanced"
      ? "right-[3%] top-[16%] h-[68%] w-[32%]"
      : "right-[3%] top-[18%] h-[64%] w-[28%]"
  }
  return weight === "balanced"
    ? "right-[4%] top-[11%] h-[78%] w-[34%]"
    : "right-[4%] top-[13%] h-[74%] w-[30%]"
}

function inscriptionLockup(
  compact: boolean,
  role: FrontContext["spec"]["imageryRole"],
  weight: PhotoWeight
): string {
  const present = role === "consequence" || weight === "subordinate"
  const compactRole = role === "neighborhood" || weight === "dominant"
  if (compact) {
    return present
      ? "bottom-1.5 left-1.5 max-w-[62%] px-2 py-1.5"
      : "bottom-1.5 left-1.5 max-w-[54%] px-2 py-1.5"
  }
  if (present) return "bottom-[6%] left-[4%] w-[44%] px-3.5 py-3"
  if (compactRole) return "bottom-[6%] left-[4%] w-[34%] px-3 py-2.5"
  return "bottom-[6%] left-[4%] w-[38%] px-3.5 py-3"
}

function TypePrimaryFront({
  spec,
  secondary,
  surface,
  ink,
  emphasis,
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
  layout,
}: FrontContext) {
  const leadWithOffer = copyOfferLeads(hierarchy)
  const structure = studioCompositionStructure(layout)
  return (
    <div
      className="relative h-full"
      style={{ backgroundColor: surface }}
      data-composition={structure.layoutVariant}
    >
      <div
        data-region="type"
        className={cn(
          "relative z-10 flex h-full w-[66%] flex-col",
          typeBreathing(compact, studioTypeExecution(treatment).rhythm)
        )}
      >
        <LeadType
          spec={spec}
          offer={offer}
          leadWithOffer={leadWithOffer}
          compact={compact}
          type={type}
          color={ink}
          emphasis={emphasis}
          treatment={treatment}
          showBody={false}
        />
        <PrintMarks
          spec={spec}
          offer={offer}
          leadWithOffer={leadWithOffer}
          compact={compact}
          type={type}
          color={ink}
          emphasis={emphasis}
          surface={surface}
          treatment={treatment}
          phoneBottomRight={phoneBottomRight}
          showQr={showQr}
          qrLarge={qrLarge}
          layout={layout}
        />
      </div>
      <div
        data-region="supporting-image"
        className={cn(
          "absolute overflow-hidden",
          supportingImagePlate(compact, treatment.photoWeight)
        )}
      >
        <PhotoSlot
          src={photoSrc}
          alt={photoAlt}
          monogram={showMonogram ? monogramLetter(spec.headline) : null}
          fallback={secondary}
          primary={ink}
          crop={treatment.cropPreset}
        />
      </div>
    </div>
  )
}

function PeerSplitFront({
  spec,
  secondary,
  surface,
  ink,
  emphasis,
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
  layout,
}: FrontContext) {
  const leadWithOffer = copyOfferLeads(hierarchy)
  const structure = studioCompositionStructure(layout)
  const quiet = treatment.typeVoice === "trust"
  return (
    <div
      className="flex h-full"
      style={{ backgroundColor: surface }}
      data-composition={structure.layoutVariant}
    >
      <div data-region="peer-image" className="relative h-full min-w-0 w-[54%] overflow-hidden">
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
        data-region="peer-type"
        className={cn(
          "flex h-full w-[46%] min-w-0 flex-col",
          typeBreathing(compact, studioTypeExecution(treatment).rhythm)
        )}
      >
        <div>
          <LeadType
            spec={spec}
            offer={offer}
            leadWithOffer={leadWithOffer}
            compact={compact}
            type={type}
            color={ink}
            emphasis={emphasis}
            treatment={treatment}
            showBody
          />
          <div
            className="mt-1.5 h-px w-6"
            style={{ backgroundColor: emphasis, opacity: quiet ? 0.45 : 0.9 }}
          />
        </div>
        <PrintMarks
          spec={spec}
          offer={offer}
          leadWithOffer={leadWithOffer}
          compact={compact}
          type={type}
          color={ink}
          emphasis={emphasis}
          surface={surface}
          treatment={treatment}
          phoneBottomRight={phoneBottomRight}
          showQr={showQr}
          qrLarge={qrLarge}
          layout={layout}
        />
      </div>
    </div>
  )
}

function BandedSplitFront({
  spec,
  secondary,
  surface,
  ink,
  emphasis,
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
  layout,
}: FrontContext) {
  const leadWithOffer = copyOfferLeads(hierarchy)
  const structure = studioCompositionStructure(layout)
  const bandText = leadWithOffer && offer ? offer : spec.headline
  const voice = studioTypeExecution(treatment)
  const bandColor = voice.heroColor === "emphasis" ? emphasis : ink
  return (
    <div
      className="flex h-full flex-col"
      style={{ backgroundColor: surface }}
      data-composition={structure.layoutVariant}
    >
      <div
        data-region="band"
        className={cn(
          "flex w-full items-end",
          compact ? "min-h-[34%] px-2.5 py-2" : "min-h-[36%] px-5 py-3.5"
        )}
        style={{ backgroundColor: surface, color: bandColor }}
      >
        {bandText ? (
          <p
            className={cn("max-w-[28ch]", headlineWeight(voice.weight), typeRhythmClass(voice.rhythm))}
            style={{ fontSize: leadWithOffer && offer ? type.offer : type.headline }}
          >
            {bandText}
          </p>
        ) : null}
      </div>
      <div className="flex min-h-0 flex-1">
        <div
          data-region="supporting"
          className={cn(
            "flex min-w-0 flex-[5] flex-col",
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
          ) : !leadWithOffer && offer ? (
            <p
              className="max-w-[18ch] font-semibold leading-[1.05] tracking-[-0.02em]"
              style={{ color: ink, fontSize: type.sub }}
            >
              {offer}
            </p>
          ) : spec.subheadline ? (
            <p
              className="font-semibold leading-tight"
              style={{ color: ink, fontSize: type.sub }}
            >
              {spec.subheadline}
            </p>
          ) : (
            <span />
          )}
          <PrintMarks
            spec={spec}
            offer=""
            leadWithOffer={leadWithOffer}
            compact={compact}
            type={type}
            color={ink}
            emphasis={emphasis}
            surface={surface}
            treatment={treatment}
            phoneBottomRight={phoneBottomRight}
            showQr={showQr}
            qrLarge={qrLarge}
            layout={layout}
          />
        </div>
        <div data-region="image" className="relative min-w-0 flex-[4] overflow-hidden">
          <PhotoSlot
            src={photoSrc}
            alt={photoAlt}
            monogram={showMonogram ? monogramLetter(spec.headline) : null}
            fallback={secondary}
            primary={ink}
            crop={treatment.cropPreset}
          />
        </div>
      </div>
    </div>
  )
}

function ImageGroundedFront({
  spec,
  secondary,
  surface,
  ink,
  emphasis,
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
  layout,
}: FrontContext) {
  const leadWithOffer = copyOfferLeads(hierarchy)
  const structure = studioCompositionStructure(layout)
  return (
    <div
      className="relative h-full"
      style={{ backgroundColor: secondary }}
      data-composition={structure.layoutVariant}
    >
      <div data-region="image-ground" className="absolute inset-0">
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
        data-region="inscription"
        className={cn(
          "absolute flex flex-col justify-end",
          inscriptionLockup(compact, spec.imageryRole, treatment.photoWeight)
        )}
        style={{ backgroundColor: surface, color: ink }}
      >
        <LeadType
          spec={spec}
          offer={offer}
          leadWithOffer={leadWithOffer}
          compact={compact}
          type={type}
          color={ink}
          emphasis={emphasis}
          treatment={treatment}
          showBody={false}
        />
        <PrintMarks
          spec={spec}
          offer={offer}
          leadWithOffer={leadWithOffer}
          compact={compact}
          type={type}
          color={ink}
          emphasis={emphasis}
          surface={surface}
          treatment={treatment}
          phoneBottomRight={phoneBottomRight}
          showQr={showQr}
          qrLarge={qrLarge}
          onPhoto
          layout={layout}
        />
      </div>
    </div>
  )
}

function TypeOnlyFront({
  spec,
  surface,
  ink,
  emphasis,
  compact,
  type,
  phoneBottomRight,
  qrLarge,
  showQr,
  offer,
  hierarchy,
  treatment,
  layout,
}: FrontContext) {
  const leadWithOffer = copyOfferLeads(hierarchy)
  const structure = studioCompositionStructure(layout)
  const voice = studioTypeExecution(treatment)
  return (
    <div
      className={cn("flex h-full flex-col", typeBreathing(compact, voice.rhythm))}
      style={{ backgroundColor: surface }}
      data-composition={structure.layoutVariant}
    >
      <div data-region="type" className="w-[62%] max-w-[22ch]">
        <LeadType
          spec={spec}
          offer={offer}
          leadWithOffer={leadWithOffer}
          compact={compact}
          type={type}
          color={ink}
          emphasis={emphasis}
          treatment={treatment}
          showBody={false}
        />
        <PrintMarks
          spec={spec}
          offer={offer}
          leadWithOffer={leadWithOffer}
          compact={compact}
          type={type}
          color={ink}
          emphasis={emphasis}
          surface={surface}
          treatment={treatment}
          phoneBottomRight={phoneBottomRight}
          showQr={showQr}
          qrLarge={qrLarge}
          layout={layout}
        />
      </div>
      <div data-region="field" className="min-h-0 flex-1" aria-hidden />
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
  emphasis,
  size,
  mark,
}: {
  children: string
  color: string
  emphasis: string
  size: string
  mark: CtaMark
}) {
  if (mark === "reverse-slug") {
    return (
      <p
        className="w-full max-w-[18ch] font-bold leading-[1.05] tracking-[-0.02em]"
        style={{
          backgroundColor: emphasis,
          color: inkOn(emphasis),
          fontSize: size,
          padding: "0.35em 0.4em 0.3em 0",
        }}
      >
        {children}
      </p>
    )
  }

  if (mark === "quiet-line") {
    return (
      <p
        className="max-w-[20ch] font-medium leading-snug tracking-[-0.01em]"
        style={{ color, fontSize: size, opacity: 0.82 }}
      >
        {children}
      </p>
    )
  }

  return (
    <div>
      <span
        className="mb-1.5 block h-px w-8"
        style={{ backgroundColor: emphasis }}
        aria-hidden
      />
      <p
        className="max-w-[20ch] font-semibold leading-snug tracking-[-0.015em]"
        style={{ color, fontSize: size }}
      >
        {children}
      </p>
    </div>
  )
}

const QR_MODULES = [
  [1, 1, 1, 0, 1, 1, 1],
  [1, 0, 1, 0, 1, 0, 1],
  [1, 1, 1, 0, 1, 1, 1],
  [0, 0, 0, 1, 0, 0, 0],
  [1, 1, 1, 0, 1, 0, 1],
  [1, 0, 1, 1, 0, 1, 0],
  [1, 1, 1, 0, 1, 0, 1],
] as const

function QrMark({
  tone,
  field,
  compact,
  large = false,
  onPhoto = false,
}: {
  tone: string
  field: string
  compact: boolean
  large?: boolean
  onPhoto?: boolean
}) {
  const quiet = onPhoto ? "#f7f7f4" : field
  const module = tone
  return (
    <div
      className={cn(
        "grid shrink-0 grid-cols-7 gap-px p-[3px]",
        compact ? "size-8" : large ? "size-12" : "size-10"
      )}
      style={{ backgroundColor: quiet }}
      aria-hidden
    >
      {QR_MODULES.flatMap((row, y) =>
        row.map((on, x) => (
          <span
            key={`${y}-${x}`}
            className="block"
            style={{ backgroundColor: on ? module : quiet }}
          />
        ))
      )}
    </div>
  )
}

function ContactPrint({
  spec,
  color,
  phoneBottomRight = false,
  size,
}: {
  spec: CreativeSpec
  color: string
  phoneBottomRight?: boolean
  size: string
}) {
  if (!spec.phone && !spec.website) return null

  const style = {
    color,
    fontSize: size,
    opacity: 0.8,
    letterSpacing: "-0.01em",
  }

  if (phoneBottomRight && spec.phone) {
    return (
      <p className="min-w-0 font-medium leading-snug" style={style}>
        {spec.phone}
      </p>
    )
  }

  return (
    <div className="min-w-0 space-y-0.5">
      {spec.phone ? (
        <p className="font-medium leading-snug" style={style}>
          {spec.phone}
        </p>
      ) : null}
      {spec.website ? (
        <p className="leading-snug" style={style}>
          {spec.website}
        </p>
      ) : null}
    </div>
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

"use client"

import { useMemo, type CSSProperties } from "react"
import { motion } from "framer-motion"

import { cn } from "@/lib/utils"
import type { CreativeCanvas } from "@/lib/campaign-creator/creative-canvas"
import type { GeneratedAsset } from "@/lib/campaign-creator/image-generation"
import { resolveCreativeImage } from "@/lib/campaign-creator/resolve-creative-image"
import {
  businessNameForCard,
  displayWebsite,
  resolveStudioContact,
  type PostcardIdentity,
  type StudioContact,
} from "@/lib/campaign-creator/studio-contact"
import { buildQrMatrix } from "@/lib/campaign-creator/studio-qr"
import { postcard5x8SafeInset } from "@/lib/campaign-creator/studio-safe-inset"
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
import {
  studioCompositionDerivation,
  typeOnlyFigureText,
  typeOnlyRealization,
  type StudioCompositionDerivation,
} from "./studio-composition-derivation"

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
  /** Cached or just-resolved photograph. Not a CreativeSpec field. */
  generatedAsset?: GeneratedAsset | null
  /** Brief contact. Used when the spec is empty or still has toy placeholder chrome. */
  identity?: PostcardIdentity
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
  generatedAsset,
  identity,
}: PostcardPreviewProps) {
  const reducedMotion = useReducedMotion()
  const [primary, secondary, accent] = spec.palette ?? DEFAULT_PALETTE
  const layout = normalizeLayoutVariant(spec.layoutVariant) ?? "peer_split"
  const isAddressSide = side === canvas.addressFace
  const imagery = resolveCreativeImage(
    spec.imagery,
    spec.imageryRole,
    generatedAsset
  )
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
      identity={identity}
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
  identity,
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
  identity?: PostcardIdentity
  fullBleed: boolean
}) {
  const compact = size === "thumbnail"
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
  const headlineScale = spec.layoutHints?.headlineScale ?? 1
  const hierarchy = studioCopyHierarchy(spec.leadJob)
  const { field: surface, ink, emphasis } = resolveStudioPalette(
    [primary, secondary, accent],
    treatment
  )
  const voiceScale = studioTypeExecution(treatment).scale
  const objectScale = derivation.typePresence === "object" ? voiceScale * 1.16 : voiceScale
  const context: FrontContext = {
    spec,
    primary,
    secondary,
    accent,
    surface,
    ink,
    emphasis,
    compact,
    type: typeScale(compact, headlineScale, objectScale),
    derivation,
    phoneBottomRight: spec.layoutHints?.phonePosition === "bottom-right",
    qrLarge: spec.layoutHints?.qrProminence === "large",
    contact: resolveStudioContact(spec, identity),
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
  contact: StudioContact
  offer: string
  photoAlt: string
  photoSrc: string | null
  showMonogram: boolean
  hierarchy: StudioCopyHierarchy
  treatment: StudioCompositionTreatment
  layout: LayoutVariant
  derivation: StudioCompositionDerivation
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

function safePad(compact: boolean, rhythm: TypeRhythm): CSSProperties {
  const inset = postcard5x8SafeInset()
  const extra = rhythm === "composed" ? 1.5 : rhythm === "compressed" ? 0 : 0.35
  const scale = compact ? 0.72 : 1
  const x = inset.xPercent * scale
  const y = (inset.yPercent + extra) * scale
  return {
    paddingTop: `${y}%`,
    paddingRight: `${x}%`,
    paddingBottom: `${y}%`,
    paddingLeft: `${x}%`,
  }
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
  treatment,
  phoneBottomRight,
  contact,
  qrLarge,
  layout,
}: {
  spec: CreativeSpec
  offer: string
  leadWithOffer: boolean
  compact: boolean
  type: TypeScale
  color: string
  emphasis: string
  treatment: StudioCompositionTreatment
  phoneBottomRight: boolean
  contact: StudioContact
  qrLarge: boolean
  layout: LayoutVariant
}) {
  const marks = studioPrintMarks(treatment, layout)
  const arrangement = marks.arrangement
  const cta = spec.callToAction ? (
    <PrintCta color={color} emphasis={emphasis} size={type.cta} mark={marks.ctaMark}>
      {spec.callToAction}
    </PrintCta>
  ) : null
  const contactMark = !compact ? (
    <ContactPrint
      contact={contact}
      color={color}
      phoneBottomRight={phoneBottomRight}
      phoneSize={type.cta}
      websiteSize={type.footer}
    />
  ) : null
  const qr = contact.qrPayload ? (
    <QrMark payload={contact.qrPayload} compact={compact} large={qrLarge} />
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

  const spacing =
    arrangement === "sole-type"
      ? "mt-auto"
      : arrangement === "inscription"
        ? compact
          ? "mt-1.5"
          : "mt-2"
        : "mt-auto"

  return (
    <div className={cn(spacing, "flex items-end gap-2.5")}>
      <div className="min-w-0 flex-1 space-y-1.5">
        {supportingOffer}
        {cta}
        {contactMark}
      </div>
      {qr}
    </div>
  )
}

function brandMark(
  showMonogram: boolean,
  spec: CreativeSpec,
  contact: StudioContact
): { wordmark: string | null; monogram: string | null } {
  if (!showMonogram) return { wordmark: null, monogram: null }
  if (contact.businessName) return { wordmark: contact.businessName, monogram: null }
  return { wordmark: null, monogram: monogramLetter(spec.headline) }
}

function Wordmark({ name, color }: { name?: string; color: string }) {
  if (!name) return null
  return (
    <p
      className="mb-1.5 font-semibold uppercase tracking-[0.16em]"
      style={{ color, fontSize: "clamp(8px, 2.1cqw, 11px)", opacity: 0.62 }}
    >
      {name}
    </p>
  )
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
  contact,
  offer,
  photoAlt,
  photoSrc,
  showMonogram,
  hierarchy,
  treatment,
  layout,
  derivation,
}: FrontContext) {
  const leadWithOffer = copyOfferLeads(hierarchy)
  const structure = studioCompositionStructure(layout)
  const smallPlate = derivation.imagePlate === "small"
  const rhythm = studioTypeExecution(treatment).rhythm
  const mark = brandMark(showMonogram, spec, contact)
  return (
    <div
      className="relative h-full"
      style={{ backgroundColor: surface }}
      data-composition={structure.layoutVariant}
      data-type-presence={derivation.typePresence}
      data-image-plate={derivation.imagePlate}
      data-void={derivation.voidShape}
      data-safe-inset="0.25in"
    >
      <div
        data-region="supporting-image"
        className={cn(
          "absolute overflow-hidden",
          smallPlate ? "bottom-0 right-0 h-[58%] w-[34%]" : "inset-y-0 right-0 w-[42%]"
        )}
      >
        <PhotoSlot
          src={photoSrc}
          alt={photoAlt}
          wordmark={mark.wordmark}
          monogram={mark.monogram}
          fallback={secondary}
          primary={ink}
          crop={smallPlate ? "tight" : treatment.cropPreset}
        />
      </div>
      <div
        data-region="type"
        className={cn(
          "relative z-10 flex h-full flex-col",
          smallPlate ? "w-[68%]" : "w-[60%]"
        )}
        style={safePad(compact, rhythm)}
      >
        <Wordmark
          name={businessNameForCard(contact.businessName, spec.headline)}
          color={ink}
        />
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
          treatment={treatment}
          phoneBottomRight={phoneBottomRight}
          contact={contact}
          qrLarge={qrLarge}
          layout={layout}
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
  contact,
  offer,
  photoAlt,
  photoSrc,
  showMonogram,
  hierarchy,
  treatment,
  layout,
  derivation,
}: FrontContext) {
  const leadWithOffer = copyOfferLeads(hierarchy)
  const structure = studioCompositionStructure(layout)
  const quiet = treatment.typeVoice === "trust"
  const rhythm = studioTypeExecution(treatment).rhythm
  const mark = brandMark(showMonogram, spec, contact)
  return (
    <div
      className="relative flex h-full"
      style={{ backgroundColor: surface }}
      data-composition={structure.layoutVariant}
      data-type-presence={derivation.typePresence}
      data-image-plate={derivation.imagePlate}
      data-void={derivation.voidShape}
      data-safe-inset="0.25in"
    >
      <div data-region="peer-image" className="relative h-full min-w-0 w-[64%] shrink-0 overflow-hidden">
        <PhotoSlot
          src={photoSrc}
          alt={photoAlt}
          wordmark={mark.wordmark}
          monogram={mark.monogram}
          fallback={secondary}
          primary={ink}
          crop={treatment.cropPreset}
        />
      </div>
      <div
        data-region="peer-type"
        className="relative z-10 -ml-[8%] flex h-full w-[44%] min-w-0 flex-col"
        style={{ backgroundColor: surface, ...safePad(compact, rhythm) }}
      >
        <div>
          <Wordmark
            name={businessNameForCard(contact.businessName, spec.headline)}
            color={ink}
          />
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
            className="mt-2 h-px w-8"
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
          treatment={treatment}
          phoneBottomRight={phoneBottomRight}
          contact={contact}
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
  contact,
  offer,
  photoAlt,
  photoSrc,
  showMonogram,
  hierarchy,
  treatment,
  layout,
  derivation,
}: FrontContext) {
  const leadWithOffer = copyOfferLeads(hierarchy)
  const structure = studioCompositionStructure(layout)
  const bandText = leadWithOffer && offer ? offer : spec.headline
  const voice = studioTypeExecution(treatment)
  const bandColor = voice.heroColor === "emphasis" ? emphasis : ink
  const mark = brandMark(showMonogram, spec, contact)
  const inset = postcard5x8SafeInset()
  const bandPad = compact ? inset.yPercent * 0.45 : inset.yPercent * 0.7
  return (
    <div
      className="flex h-full flex-col"
      style={{ backgroundColor: surface }}
      data-composition={structure.layoutVariant}
      data-type-presence={derivation.typePresence}
      data-image-plate={derivation.imagePlate}
      data-void={derivation.voidShape}
      data-safe-inset="0.25in"
    >
      <div
        data-region="band"
        className="flex w-full shrink-0 items-end"
        style={{
          backgroundColor: surface,
          color: bandColor,
          paddingTop: `${bandPad}%`,
          paddingRight: `${inset.xPercent}%`,
          paddingBottom: `${bandPad * 0.65}%`,
          paddingLeft: `${inset.xPercent}%`,
        }}
      >
        <div className="min-w-0">
          <Wordmark
            name={businessNameForCard(contact.businessName, bandText)}
            color={bandColor}
          />
          {bandText ? (
            <p
              className={cn(
                "max-w-[22ch]",
                headlineWeight(voice.weight),
                typeRhythmClass(voice.rhythm)
              )}
              style={{ fontSize: leadWithOffer && offer ? type.offer : type.headline }}
            >
              {bandText}
            </p>
          ) : null}
          <span
            className="mt-1.5 block h-[3px] w-10"
            style={{ backgroundColor: emphasis }}
            aria-hidden
          />
        </div>
      </div>
      <div className="flex min-h-0 flex-1">
        <div
          data-region="supporting"
          className="flex min-w-0 flex-[5] flex-col"
          style={safePad(compact, voice.rhythm)}
        >
          {leadWithOffer && spec.headline ? (
            <p
              className="max-w-[18ch] font-semibold leading-[1.05] tracking-[-0.02em]"
              style={{ color: ink, fontSize: type.sub, opacity: 0.88 }}
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
            treatment={treatment}
            phoneBottomRight={phoneBottomRight}
            contact={contact}
            qrLarge={qrLarge}
            layout={layout}
          />
        </div>
        <div data-region="image" className="relative min-w-0 flex-[7] overflow-hidden">
          <PhotoSlot
            src={photoSrc}
            alt={photoAlt}
            wordmark={mark.wordmark}
            monogram={mark.monogram}
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
  ink,
  emphasis,
  compact,
  type,
  phoneBottomRight,
  qrLarge,
  contact,
  offer,
  photoAlt,
  photoSrc,
  showMonogram,
  hierarchy,
  treatment,
  layout,
  derivation,
}: FrontContext) {
  const leadWithOffer = copyOfferLeads(hierarchy)
  const structure = studioCompositionStructure(layout)
  const plate = "#f7f4ee"
  const plateInk = "#1c1917"
  const inset = postcard5x8SafeInset()
  const mark = brandMark(showMonogram, spec, contact)
  return (
    <div
      className="relative h-full"
      style={{ backgroundColor: secondary }}
      data-composition={structure.layoutVariant}
      data-type-presence={derivation.typePresence}
      data-image-plate={derivation.imagePlate}
      data-void={derivation.voidShape}
      data-safe-inset="0.25in"
    >
      <div data-region="image-ground" className="absolute inset-0">
        <PhotoSlot
          src={photoSrc}
          alt={photoAlt}
          wordmark={mark.wordmark}
          monogram={mark.monogram}
          fallback={secondary}
          primary={ink}
          crop={treatment.cropPreset}
        />
      </div>
      <div
        data-region="inscription"
        className="absolute flex flex-col justify-end"
        style={{
          left: `${inset.xPercent}%`,
          bottom: `${inset.yPercent}%`,
          width: compact ? "72%" : "58%",
          maxWidth: "30ch",
          backgroundColor: plate,
          color: plateInk,
          padding: compact ? "0.45rem 0.5rem" : "0.7rem 0.85rem 0.65rem",
        }}
      >
        <Wordmark
          name={businessNameForCard(contact.businessName, spec.headline)}
          color={plateInk}
        />
        <LeadType
          spec={spec}
          offer={offer}
          leadWithOffer={leadWithOffer}
          compact={compact}
          type={type}
          color={plateInk}
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
          color={plateInk}
          emphasis={emphasis}
          treatment={treatment}
          phoneBottomRight={phoneBottomRight}
          contact={contact}
          qrLarge={qrLarge}
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
  contact,
  offer,
  hierarchy,
  treatment,
  layout,
  derivation,
}: FrontContext) {
  const leadWithOffer = copyOfferLeads(hierarchy)
  const structure = studioCompositionStructure(layout)
  const voice = studioTypeExecution(treatment)
  const realization = typeOnlyRealization(derivation, compact)
  const cardName = businessNameForCard(contact.businessName, spec.headline)

  if (realization.mode === "object") {
    const figure = typeOnlyFigureText(spec)
    const figureColor = voice.heroColor === "emphasis" ? emphasis : ink
    return (
      <div
        className="flex h-full flex-col"
        style={{ backgroundColor: surface, ...safePad(compact, voice.rhythm) }}
        data-composition={structure.layoutVariant}
        data-type-presence={derivation.typePresence}
        data-image-plate={derivation.imagePlate}
        data-void={derivation.voidShape}
        data-type-measure={realization.typeMeasure}
        data-marks-region={realization.marksRegion}
        data-figure-source={realization.figureSource}
        data-safe-inset="0.25in"
      >
        <div data-region="type" className="w-auto max-w-[6ch]">
          <Wordmark name={cardName} color={ink} />
          {figure ? (
            <p
              className={cn(
                headlineWeight(voice.weight),
                "max-w-[6ch]",
                typeRhythmClass(voice.rhythm)
              )}
              style={{ color: figureColor, fontSize: realization.figureClamp ?? undefined }}
            >
              {figure}
            </p>
          ) : null}
        </div>
        <div
          data-region="field"
          className="flex min-h-0 flex-1 flex-col justify-end"
        >
          {!compact && spec.subheadline ? (
            <p
              className="max-w-[22ch] leading-snug"
              style={{ color: ink, fontSize: type.sub, opacity: 0.72 }}
            >
              {spec.subheadline}
            </p>
          ) : null}
          {offer ? (
            <p
              className="mt-1 max-w-[20ch] font-medium leading-snug"
              style={{ color: ink, fontSize: type.sub, opacity: 0.85 }}
            >
              {offer}
            </p>
          ) : null}
          <PrintMarks
            spec={spec}
            offer=""
            leadWithOffer={false}
            compact={compact}
            type={type}
            color={ink}
            emphasis={emphasis}
            treatment={treatment}
            phoneBottomRight={phoneBottomRight}
            contact={contact}
            qrLarge={qrLarge}
            layout={layout}
          />
        </div>
      </div>
    )
  }

  return (
    <div
      className="flex h-full"
      style={{ backgroundColor: surface }}
      data-composition={structure.layoutVariant}
      data-type-presence={derivation.typePresence}
      data-image-plate={derivation.imagePlate}
      data-void={derivation.voidShape}
      data-safe-inset="0.25in"
    >
      <div
        data-region="type"
        className="flex w-[68%] max-w-[24ch] flex-col"
        style={safePad(compact, voice.rhythm)}
      >
        <Wordmark name={cardName} color={ink} />
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
          treatment={treatment}
          phoneBottomRight={phoneBottomRight}
          contact={contact}
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
        className="inline-block max-w-[18ch] font-bold leading-[1.05] tracking-[-0.02em]"
        style={{
          backgroundColor: emphasis,
          color: inkOn(emphasis),
          fontSize: size,
          padding: "0.22em 0.38em 0.16em",
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

function QrMark({
  payload,
  compact,
  large = false,
}: {
  payload: string
  compact: boolean
  large?: boolean
}) {
  const matrix = useMemo(() => buildQrMatrix(payload), [payload])
  if (!matrix) return null
  const modules = matrix.length
  const box = compact ? 34 : large ? 76 : 62
  const quiet = Math.max(3, Math.round((4 / modules) * box))
  return (
    <div
      className="shrink-0 bg-white"
      style={{ width: box, height: box, padding: quiet }}
      role="img"
      aria-label={`QR code for ${payload}`}
    >
      <div
        className="grid h-full w-full"
        style={{ gridTemplateColumns: `repeat(${modules}, minmax(0, 1fr))` }}
      >
        {matrix.flatMap((row, y) =>
          row.map((on, x) => (
            <span
              key={`${y}-${x}`}
              className="block"
              style={{ backgroundColor: on ? "#111111" : "#ffffff" }}
            />
          ))
        )}
      </div>
    </div>
  )
}

function ContactPrint({
  contact,
  color,
  phoneBottomRight = false,
  phoneSize,
  websiteSize,
}: {
  contact: StudioContact
  color: string
  phoneBottomRight?: boolean
  phoneSize: string
  websiteSize: string
}) {
  if (!contact.phone && !contact.website) return null

  return (
    <div className="min-w-0">
      {contact.phone ? (
        <p
          className="font-semibold leading-none tabular-nums tracking-[-0.02em]"
          style={{
            color,
            fontSize: phoneSize,
            letterSpacing: phoneBottomRight ? "-0.03em" : "-0.02em",
          }}
        >
          {contact.phone}
        </p>
      ) : null}
      {contact.website ? (
        <p
          className="mt-1 font-medium leading-none"
          style={{ color, fontSize: websiteSize, opacity: 0.72 }}
        >
          {displayWebsite(contact.website)}
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

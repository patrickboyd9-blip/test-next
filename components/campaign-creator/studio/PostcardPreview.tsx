"use client"

import { motion } from "framer-motion"

import { cn } from "@/lib/utils"
import type { CreativeCanvas } from "@/lib/campaign-creator/creative-canvas"
import { repairHeadlineCopy } from "@/lib/campaign-creator/headline-repair"
import type { GeneratedAsset } from "@/lib/campaign-creator/image-generation"
import { medicareDisclaimerFor } from "@/lib/campaign-creator/medicare-compliance"
import { resolveCreativeImage } from "@/lib/campaign-creator/resolve-creative-image"
import {
  resolveStudioContact,
  type PostcardIdentity,
} from "@/lib/campaign-creator/studio-contact"
import {
  normalizeLayoutVariant,
  type CampaignBrief,
  type CreativeSpec,
} from "@/lib/campaign-creator/types"
import { useReducedMotion } from "@/hooks/use-reduced-motion"

import { ShimmerOverlay, SpecDiffHighlight } from "./SpecDiffHighlight"
import { PostcardBackFace, PostcardFrontFace } from "./PostcardComposition"
import { PremiumBackMessage, PremiumPostcardFront } from "./PremiumPostcard"
import { composeGridCard } from "@/lib/design-intelligence/grid-composer"
import { isDesignRationale } from "@/lib/design-intelligence/rationale"
import { attorneyAdMark } from "@/lib/design-intelligence/attorney-compliance"
import { isPostcardTemplate, isVerticalPalette } from "@/lib/postcard-layouts/ids"
import { slotPhotoSources } from "@/lib/postcard-layouts/photos"
import { TEMPLATE_META } from "@/lib/postcard-layouts/templates"

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
  /** Second photograph for a before/after card. */
  alternateGeneratedAsset?: GeneratedAsset | null
  /**
   * The beta shelf is a labeled stand-in. Leave this false while a
   * campaign photograph should still succeed.
   */
  allowLibraryFallback?: boolean
  /** Brief contact. Used when the spec is empty or still has toy placeholder chrome. */
  identity?: PostcardIdentity
  /** Campaign brief. Selects a relevant stand-in and the Medicare disclaimer. */
  brief?: CampaignBrief
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
  alternateGeneratedAsset,
  identity,
  brief,
  allowLibraryFallback = false,
}: PostcardPreviewProps) {
  const reducedMotion = useReducedMotion()
  const [primary, secondary, accent] = spec.palette ?? DEFAULT_PALETTE
  const layout = normalizeLayoutVariant(spec.layoutVariant) ?? "peer_split"
  const isAddressSide = side === canvas.addressFace
  const imagery = resolveCreativeImage(
    spec.imagery,
    spec.imageryRole,
    generatedAsset,
    { libraryFallback: allowLibraryFallback, campaign: brief }
  )
  const contact = resolveStudioContact(spec, identity)
  const compact = size === "thumbnail"
  const templateId = spec.layoutHints?.templateId
  const template = isPostcardTemplate(templateId) ? templateId : undefined
  const slotCount = template ? TEMPLATE_META[template].photoSlots : 1
  const sources = slotPhotoSources({
    slotCount,
    generatedSrc: imagery.src,
    generatedAlternateSrc: alternateGeneratedAsset?.src ?? null,
    assets: brief?.brandAssets,
  })
  const disclaimer = medicareDisclaimerFor(brief)
  const complianceMark = attorneyAdMark(
    [
      brief?.goal,
      brief?.offer,
      brief?.audience?.description,
      brief?.businessInfo?.name,
      brief?.otherRequirements,
      spec.headline,
      spec.body,
      spec.offer,
    ].filter(Boolean).join(" ")
  )

  const studioCard = isDesignRationale(spec.designRationale)
    ? composeGridCard({
        rationale: spec.designRationale,
        spec: {
          ...spec,
          phone: contact.phone ?? spec.phone,
          website: contact.website ?? spec.website,
        },
        businessName: contact.businessName,
        disclaimer,
        complianceMark,
      })
    : null

  const content = isAddressSide ? (
    studioCard ? (
      <PremiumPostcardFront
        plan={studioCard.back}
        templateId={studioCard.back.templateId}
        spec={spec}
        contact={contact}
        photoSrc={null}
        compact={compact}
      />
    ) : (
      <PostcardBackFace
        primary={primary}
        secondary={secondary}
        accent={accent}
        reservedRoles={canvas.reservedRegionRoles}
        compact={compact}
        disclaimer={disclaimer}
      >
        {template ? (
          <PremiumBackMessage
            templateId={template}
            spec={spec}
            businessName={contact.businessName}
            paletteId={isVerticalPalette(spec.layoutHints?.verticalPalette) ? spec.layoutHints.verticalPalette : undefined}
            disclaimer={Boolean(disclaimer)}
            complianceMark={complianceMark}
          />
        ) : null}
      </PostcardBackFace>
    )
  ) : (
    <PostcardFrontFace
      spec={spec}
      layout={layout}
      compact={compact}
      photoSrc={sources[0] ?? imagery.src}
      alternatePhotoSrc={sources[1] ?? null}
      cutoutSrc={generatedAsset?.src ?? null}
      thumbnailSrc={imagery.src && imagery.src !== generatedAsset?.src ? imagery.src : null}
      showMonogram={imagery.showMonogram}
      contact={contact}
      photoAlt={spec.visualDirection?.trim() || "Campaign photography"}
      photoSeat={generatedAsset?.typeSeat}
      preparedFront={studioCard?.front}
    />
  )

  const face = canvas.fullBleedExpected ? (
    content
  ) : (
    <div className="h-full p-[2%]" style={{ backgroundColor: accent }}>
      <div className="h-full overflow-hidden">{content}</div>
    </div>
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
    <div className="flex w-full flex-col items-center">
      <motion.div
        className={cn(
          "@container relative overflow-hidden rounded-lg shadow-lg sm:shadow-lg",
          STUDIO_VIEWING_ASPECT_CLASS,
          SIZE_CLASSES[size],
          size === "thumbnail" && "shadow-md",
          className
        )}
        role="img"
        aria-label={
          ariaLabel ??
          `Postcard preview: ${repairHeadlineCopy(spec).headline || "Creative design"}`
        }
        {...hoverProps}
      >
        {face}
        {!isAddressSide && (
          <>
            <ShimmerOverlay active={isShimmering} />
            <SpecDiffHighlight regions={highlightRegions} active={highlightRegions.length > 0} />
          </>
        )}
      </motion.div>
    </div>
  )
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

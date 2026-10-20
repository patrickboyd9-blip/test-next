"use client"

import { motion } from "framer-motion"

import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import type { CreativeCanvas } from "@/lib/campaign-creator/creative-canvas"
import type { GeneratedAsset } from "@/lib/campaign-creator/image-generation"
import type { PostcardIdentity } from "@/lib/campaign-creator/studio-contact"
import type { CampaignBrief, CreativeDirection } from "@/lib/campaign-creator/types"
import { useReducedMotion } from "@/hooks/use-reduced-motion"

import type { ConceptFeedbackView } from "@/lib/campaign-creator/actions"
import { blueprintMatchLine } from "@/lib/design-intelligence/blueprint-tags"

import { ConceptFeedback } from "./ConceptFeedback"
import { PostcardPreview, type PostcardPreviewSize } from "./PostcardPreview"
import { persuasionAngles, persuasionRecordLine, persuasionUsesLine, persuasionWarnings } from "@/lib/design-intelligence/persuasion"

import { ResearchBasis } from "./ResearchBasis"
import { StudioPhotoNote } from "./StudioPhotoNote"

export type ConceptCardVariant = "hero" | "compact" | "strip"

interface ConceptCardProps {
  canvas: CreativeCanvas
  direction: CreativeDirection
  variant?: ConceptCardVariant
  isRecommended?: boolean
  isSelected?: boolean
  identity?: PostcardIdentity
  brief?: CampaignBrief
  generatedAsset?: GeneratedAsset | null
  alternateGeneratedAsset?: GeneratedAsset | null
  allowLibraryFallback?: boolean
  photoNote?: string | null
  onSelect?: () => void
  index?: number
  campaignId?: string
  feedback?: ConceptFeedbackView
}

export function ConceptCard({
  canvas,
  direction,
  variant = "compact",
  isRecommended,
  isSelected,
  identity,
  brief,
  generatedAsset,
  alternateGeneratedAsset,
  allowLibraryFallback = false,
  photoNote,
  onSelect,
  index = 0,
  campaignId,
  feedback,
}: ConceptCardProps) {
  const reducedMotion = useReducedMotion()
  const isInteractive = Boolean(onSelect)
  const angles = persuasionAngles(direction.spec.designRationale)
  const complianceWarnings = persuasionWarnings(direction.spec.designRationale)

  const size: PostcardPreviewSize =
    variant === "strip" ? "thumbnail" : variant === "hero" ? "hero" : "thumbnail"

  const motionProps = reducedMotion
    ? {}
    : {
        initial: { opacity: 0, x: variant === "compact" ? 24 : 0 },
        animate: { opacity: 1, x: 0 },
        transition: { duration: 0.2, delay: index * 0.1, ease: "easeOut" as const },
      }

  return (
    <motion.div
      className={cn(
        "group relative flex flex-col gap-3 rounded-xl border border-border bg-card p-4 text-left transition-shadow",
        isInteractive && "hover:ring-2 hover:ring-primary/30",
        isSelected && "ring-2 ring-primary",
        variant === "strip" && "w-[64px] shrink-0 p-1.5 gap-1"
      )}
      {...motionProps}
    >
      {isRecommended && variant !== "strip" && (
        <Badge className="absolute left-3 top-3 z-10 text-[10px]" variant="default">
          Recommended
        </Badge>
      )}
      <button
        type="button"
        onClick={onSelect}
        disabled={!isInteractive}
        className={cn(
          "flex flex-col gap-3 text-left",
          isInteractive &&
            "cursor-pointer rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
          !isInteractive && "cursor-default"
        )}
      >
        <div className={cn(variant === "strip" && "opacity-60 saturate-[0.6] group-hover:saturate-100 group-hover:opacity-100 transition-all")}>
          <PostcardPreview
            canvas={canvas}
            spec={direction.spec}
            size={size}
            identity={identity}
            brief={brief}
            generatedAsset={generatedAsset}
            alternateGeneratedAsset={alternateGeneratedAsset}
            allowLibraryFallback={allowLibraryFallback}
            enableHoverTilt={variant !== "strip"}
          />
        </div>
        {variant !== "strip" && (
          <>
            <StudioPhotoNote note={photoNote} />
            <p className="text-sm font-semibold">{direction.name}</p>
            {direction.spec.blueprint ? (
              <p className="text-xs font-medium">
                Blueprint: {blueprintMatchLine(direction.spec.blueprint)}
              </p>
            ) : null}
            <p className="line-clamp-2 text-xs text-muted-foreground">
              {direction.oneLineDifference ?? direction.rationale}
            </p>
            {persuasionUsesLine(direction.spec.designRationale) ? (
              <p className="text-xs text-foreground/80">{persuasionUsesLine(direction.spec.designRationale)}</p>
            ) : null}
            {persuasionRecordLine(direction.spec.designRationale) ? (
              <p className="text-xs text-foreground/80">{persuasionRecordLine(direction.spec.designRationale)}</p>
            ) : null}
            {angles ? (
              <div className="flex flex-col gap-0.5">
                <p className="text-xs font-medium">A/B test options</p>
                {angles.map((angle) => (
                  <p key={angle.id} className="text-xs text-foreground/80">
                    {angle.id} · {angle.label}: {angle.line}
                  </p>
                ))}
              </div>
            ) : null}
            {complianceWarnings.map((warning) => (
              <p key={warning} className="text-xs text-foreground/80">{warning}</p>
            ))}
          </>
        )}
      </button>
      {variant !== "strip" ? <ResearchBasis research={direction.research} /> : null}
      {variant !== "strip" && campaignId ? (
        <ConceptFeedback campaignId={campaignId} directionId={direction.id} initial={feedback} />
      ) : null}
    </motion.div>
  )
}

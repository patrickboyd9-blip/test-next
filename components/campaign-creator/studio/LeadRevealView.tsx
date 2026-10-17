"use client"

import { useState } from "react"
import { motion } from "framer-motion"

import { Button } from "@/components/ui/button"
import type { CreativeCanvas } from "@/lib/campaign-creator/creative-canvas"
import type { GeneratedAsset } from "@/lib/campaign-creator/image-generation"
import type { PostcardIdentity } from "@/lib/campaign-creator/studio-contact"
import type { ConceptFeedbackView } from "@/lib/campaign-creator/actions"
import type { CampaignBrief, CreativeDirection } from "@/lib/campaign-creator/types"
import { useReducedMotion } from "@/hooks/use-reduced-motion"

import { ConceptFeedback } from "./ConceptFeedback"
import { PostcardPreview, PostcardSideToggle } from "./PostcardPreview"
import { ResearchBasis } from "./ResearchBasis"
import { StrategyTags } from "./StrategyTags"
import { StudioPhotoNote } from "./StudioPhotoNote"

interface LeadRevealViewProps {
  canvas: CreativeCanvas
  direction: CreativeDirection
  onContinue: () => void
  onCompare: () => void
  generatedAsset?: GeneratedAsset | null
  alternateGeneratedAsset?: GeneratedAsset | null
  allowLibraryFallback?: boolean
  photoNote?: string | null
  identity?: PostcardIdentity
  brief?: CampaignBrief
  campaignId?: string
  feedback?: ConceptFeedbackView
}

export function LeadRevealView({
  canvas,
  direction,
  onContinue,
  onCompare,
  generatedAsset,
  alternateGeneratedAsset,
  allowLibraryFallback = false,
  photoNote,
  identity,
  brief,
  campaignId,
  feedback,
}: LeadRevealViewProps) {
  const reducedMotion = useReducedMotion()
  const [side, setSide] = useState<"front" | "back">("front")

  const fadeUp = (delay: number) =>
    reducedMotion
      ? {}
      : {
          initial: { opacity: 0, y: 8 },
          animate: { opacity: 1, y: 0 },
          transition: { duration: 0.2, delay, ease: "easeOut" as const },
        }

  const postcardSpring = reducedMotion
    ? { initial: { opacity: 0 }, animate: { opacity: 1 }, transition: { duration: 0.15 } }
    : {
        initial: { opacity: 0, scale: 0.92 },
        animate: { opacity: 1, scale: 1 },
        transition: { type: "spring" as const, damping: 20, stiffness: 300 },
      }

  return (
    <div className="flex flex-col gap-8">
      <motion.h2 className="text-lg font-semibold" {...fadeUp(0)}>
        Your concepts are ready
      </motion.h2>

      <div className="flex flex-col items-center gap-2">
        <motion.div className="flex w-full justify-center" {...postcardSpring}>
          <PostcardPreview
            canvas={canvas}
            spec={direction.spec}
            side={side}
            size="hero"
            generatedAsset={generatedAsset}
            alternateGeneratedAsset={alternateGeneratedAsset}
            allowLibraryFallback={allowLibraryFallback}
            identity={identity}
            brief={brief}
          />
        </motion.div>
        <StudioPhotoNote note={photoNote} />
        <PostcardSideToggle side={side} onSideChange={setSide} />
      </div>

      <motion.div className="flex max-w-lg flex-col gap-4" {...fadeUp(0.15)}>
        <p className="text-xs font-semibold uppercase tracking-wide text-primary">
          ★ Our recommendation
        </p>
        <h3 className="text-xl font-semibold">{direction.name}</h3>
        <p className="text-sm text-muted-foreground">{direction.rationale}</p>
        <ResearchBasis research={direction.research} />
        {campaignId ? (
          <ConceptFeedback campaignId={campaignId} directionId={direction.id} initial={feedback} />
        ) : null}
        <p className="text-sm">
          <span className="text-muted-foreground">Designed to drive: </span>
          <span className="font-medium">{direction.designedToDrive}</span>
        </p>
        <StrategyTags tags={direction.tags} />
      </motion.div>

      <motion.div
        className="flex flex-col gap-3 sm:flex-row sm:items-center"
        {...fadeUp(0.45)}
      >
        <Button size="lg" onClick={onContinue} className="sm:w-auto w-full">
          Continue with this →
        </Button>
        <Button size="lg" variant="outline" onClick={onCompare} className="sm:w-auto w-full">
          See 2 other directions
        </Button>
      </motion.div>

      <motion.p className="text-center" {...fadeUp(0.5)}>
        <button
          type="button"
          className="text-sm text-muted-foreground underline-offset-4 hover:underline"
          onClick={() => {}}
          aria-disabled
          tabIndex={-1}
        >
          None of these feel right
        </button>
      </motion.p>
    </div>
  )
}

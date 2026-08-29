"use client"

import { useState } from "react"
import { AnimatePresence, motion } from "framer-motion"

import { Button } from "@/components/ui/button"
import type { CreativeDirection, CreativeSpec } from "@/lib/campaign-creator/types"
import { useReducedMotion } from "@/hooks/use-reduced-motion"

import { ConceptCard } from "./ConceptCard"
import { PostcardPreview, PostcardSideToggle } from "./PostcardPreview"
import { StrategyTags } from "./StrategyTags"

interface FocusViewProps {
  direction: CreativeDirection
  spec: CreativeSpec
  otherDirections: CreativeDirection[]
  onCompare: () => void
  onSwitch: (directionId: string) => void
  onStartRefining: () => void
  onApproveAsIs: () => void
}

function buildFocusCaption(direction: CreativeDirection): string {
  if (direction.recommended) {
    return `This direction leads with trust before the offer — a strong choice for homeowners who need confidence before booking.`
  }
  const tone = direction.spec.tone?.split(",")[0]?.toLowerCase() ?? "distinct"
  return `${direction.name} takes a ${tone} approach — ${direction.oneLineDifference ?? direction.rationale}`
}

export function FocusView({
  direction,
  spec,
  otherDirections,
  onCompare,
  onSwitch,
  onStartRefining,
  onApproveAsIs,
}: FocusViewProps) {
  const reducedMotion = useReducedMotion()
  const [side, setSide] = useState<"front" | "back">("front")
  const caption = buildFocusCaption(direction)

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-lg font-semibold">{direction.name}</h2>
        <Button variant="link" className="h-auto p-0 text-sm" onClick={onCompare}>
          Compare
        </Button>
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={direction.id}
          initial={reducedMotion ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={reducedMotion ? undefined : { opacity: 0 }}
          transition={{ duration: reducedMotion ? 0 : 0.15 }}
          className="flex flex-col items-center gap-2"
        >
          <PostcardPreview
            spec={spec}
            side={side}
            size="hero"
            ariaLabel={`Postcard: ${spec.headline ?? direction.name}`}
          />
          <PostcardSideToggle side={side} onSideChange={setSide} />
        </motion.div>
      </AnimatePresence>

      <div className="flex max-w-lg flex-col gap-3">
        <p className="text-sm text-muted-foreground">{direction.rationale}</p>
        <p className="text-sm">
          <span className="text-muted-foreground">Designed to drive: </span>
          <span className="font-medium">{direction.designedToDrive}</span>
        </p>
        <StrategyTags tags={direction.tags} />
      </div>

      <motion.p
        key={direction.id}
        initial={reducedMotion ? false : { opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-lg text-sm text-muted-foreground"
      >
        {caption}
      </motion.p>

      <div className="flex max-w-lg flex-col gap-3 sm:flex-row sm:items-center">
        <Button onClick={onStartRefining}>Start refining →</Button>
        <Button variant="outline" onClick={onApproveAsIs}>
          Approve as-is
        </Button>
      </div>

      <div className="flex flex-col gap-3">
        <p className="text-xs text-muted-foreground">or switch</p>
        <div className="flex gap-2">
          {otherDirections.map((other) => (
            <ConceptCard
              key={other.id}
              direction={other}
              variant="strip"
              onSelect={() => onSwitch(other.id)}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

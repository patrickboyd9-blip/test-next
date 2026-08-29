"use client"

import { motion } from "framer-motion"

import type { CreativeDirection } from "@/lib/campaign-creator/types"
import { useReducedMotion } from "@/hooks/use-reduced-motion"

import { ConceptCard } from "./ConceptCard"

interface CompareViewProps {
  directions: CreativeDirection[]
  recommendedId: string
  onSelect: (directionId: string) => void
  onBack: () => void
}

export function CompareView({
  directions,
  recommendedId,
  onSelect,
  onBack,
}: CompareViewProps) {
  const reducedMotion = useReducedMotion()

  const leadScale = reducedMotion
    ? {}
    : {
        animate: { scale: 0.96 },
        transition: { duration: 0.2, ease: "easeOut" as const },
      }

  return (
    <div className="flex flex-col gap-6">
      <button
        type="button"
        onClick={onBack}
        className="self-start text-sm text-muted-foreground hover:text-foreground"
      >
        ← Back to recommendation
      </button>

      <h2 className="text-lg font-semibold">Three directions for your campaign</h2>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {directions.map((direction, index) => (
          <motion.div
            key={direction.id}
            {...(direction.id === recommendedId ? leadScale : {})}
          >
            <ConceptCard
              direction={direction}
              variant="compact"
              isRecommended={direction.id === recommendedId}
              onSelect={() => onSelect(direction.id)}
              index={direction.id === recommendedId ? 0 : index}
            />
          </motion.div>
        ))}
      </div>

      <p className="text-center text-xs text-muted-foreground">
        Tap a direction to explore it
      </p>
    </div>
  )
}

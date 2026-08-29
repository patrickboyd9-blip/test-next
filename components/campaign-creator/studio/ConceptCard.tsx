"use client"

import { motion } from "framer-motion"

import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import type { CreativeDirection } from "@/lib/campaign-creator/types"
import { useReducedMotion } from "@/hooks/use-reduced-motion"

import { PostcardPreview, type PostcardPreviewSize } from "./PostcardPreview"

export type ConceptCardVariant = "hero" | "compact" | "strip"

interface ConceptCardProps {
  direction: CreativeDirection
  variant?: ConceptCardVariant
  isRecommended?: boolean
  isSelected?: boolean
  onSelect?: () => void
  index?: number
}

export function ConceptCard({
  direction,
  variant = "compact",
  isRecommended,
  isSelected,
  onSelect,
  index = 0,
}: ConceptCardProps) {
  const reducedMotion = useReducedMotion()
  const isInteractive = Boolean(onSelect)

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
    <motion.button
      type="button"
      onClick={onSelect}
      disabled={!isInteractive}
      className={cn(
        "group relative flex flex-col gap-3 rounded-xl border border-border bg-card p-4 text-left transition-shadow",
        isInteractive && "cursor-pointer hover:ring-2 hover:ring-primary/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
        isSelected && "ring-2 ring-primary",
        variant === "strip" && "w-[64px] shrink-0 p-1.5 gap-1",
        !isInteractive && "cursor-default"
      )}
      {...motionProps}
    >
      {isRecommended && variant !== "strip" && (
        <Badge className="absolute left-3 top-3 z-10 text-[10px]" variant="default">
          Recommended
        </Badge>
      )}
      <div className={cn(variant === "strip" && "opacity-60 saturate-[0.6] group-hover:saturate-100 group-hover:opacity-100 transition-all")}>
        <PostcardPreview
          spec={direction.spec}
          size={size}
          enableHoverTilt={variant !== "strip"}
        />
      </div>
      {variant !== "strip" && (
        <>
          <p className="text-sm font-semibold">{direction.name}</p>
          <p className="line-clamp-2 text-xs text-muted-foreground">
            {direction.oneLineDifference ?? direction.rationale}
          </p>
        </>
      )}
    </motion.button>
  )
}

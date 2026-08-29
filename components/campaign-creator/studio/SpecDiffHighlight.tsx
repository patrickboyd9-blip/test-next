"use client"

import { motion } from "framer-motion"

import { cn } from "@/lib/utils"
import { useReducedMotion } from "@/hooks/use-reduced-motion"

interface SpecDiffHighlightProps {
  regions: string[]
  active?: boolean
}

const REGION_STYLES: Record<string, string> = {
  headline: "top-0 left-0 right-0 h-1/3",
  body: "top-1/3 left-0 right-0 h-1/3",
  callToAction: "bottom-[28%] left-[8%] right-[8%] h-[14%]",
  offer: "top-[38%] left-[8%] right-[8%] h-[16%]",
  phone: "bottom-0 left-0 right-0 h-[18%]",
  palette: "inset-0",
  layoutHints: "bottom-0 right-0 h-[22%] w-[35%]",
}

export function SpecDiffHighlight({ regions, active = false }: SpecDiffHighlightProps) {
  const reducedMotion = useReducedMotion()

  if (!active || regions.length === 0) return null

  const uniqueRegions = [...new Set(regions)]

  return (
    <>
      {uniqueRegions.map((region) => {
        const position = REGION_STYLES[region] ?? REGION_STYLES.layoutHints
        const isPalette = region === "palette"

        return (
          <motion.div
            key={region}
            className={cn(
              "pointer-events-none absolute rounded-sm",
              position,
              isPalette
                ? "bg-primary/10"
                : "border-2 border-primary/40"
            )}
            initial={reducedMotion ? { opacity: 0.7 } : { opacity: 0 }}
            animate={
              reducedMotion
                ? { opacity: 1 }
                : {
                    opacity: [0, 1, 0.6, 1, 0],
                    scale: isPalette ? 1 : [1, 1.01, 1],
                  }
            }
            transition={
              reducedMotion
                ? { duration: 0.3 }
                : { duration: 1.5, ease: "easeInOut" }
            }
            aria-hidden
          />
        )
      })}
    </>
  )
}

interface ShimmerOverlayProps {
  active?: boolean
}

export function ShimmerOverlay({ active = false }: ShimmerOverlayProps) {
  const reducedMotion = useReducedMotion()

  if (!active) return null

  if (reducedMotion) {
    return (
      <motion.div
        className="pointer-events-none absolute inset-0 bg-background/20"
        initial={{ opacity: 0.7 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3 }}
        aria-hidden
      />
    )
  }

  return (
    <motion.div
      className="pointer-events-none absolute inset-0 overflow-hidden"
      aria-hidden
    >
      <motion.div
        className="absolute inset-y-0 w-1/2 bg-gradient-to-r from-transparent via-white/40 to-transparent"
        initial={{ x: "-100%" }}
        animate={{ x: "200%" }}
        transition={{ duration: 0.6, ease: "linear" }}
      />
    </motion.div>
  )
}

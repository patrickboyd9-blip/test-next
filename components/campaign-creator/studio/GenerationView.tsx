"use client"

import { useEffect, useState } from "react"
import { AnimatePresence, motion } from "framer-motion"

import type { CampaignBrief } from "@/lib/campaign-creator/types"
import { STUDIO_GENERATION } from "@/lib/campaign-creator/studio-config"
import { buildGenerationNarrativeLines } from "@/lib/campaign-creator/studio-narrative"
import { useReducedMotion } from "@/hooks/use-reduced-motion"

import { StudioComposerShell } from "./StudioComposerShell"

interface GenerationViewProps {
  brief: CampaignBrief
}

export function GenerationView({ brief }: GenerationViewProps) {
  const reducedMotion = useReducedMotion()
  const lines = buildGenerationNarrativeLines(brief)
  const [lineIndex, setLineIndex] = useState(0)

  useEffect(() => {
    const interval = setInterval(() => {
      setLineIndex((current) => (current + 1) % lines.length)
    }, STUDIO_GENERATION.narrativeIntervalMs)
    return () => clearInterval(interval)
  }, [lines.length])

  const breathingAnimation = reducedMotion
    ? {}
    : {
        animate: { opacity: [0.6, 1, 0.6] },
        transition: { duration: 3, repeat: Infinity, ease: "easeInOut" as const },
      }

  return (
    <div className="flex flex-col gap-8">
      <div
        className="relative flex min-h-[280px] flex-1 items-center justify-center md:min-h-[360px]"
        aria-live="polite"
        aria-busy="true"
      >
        <motion.div
          className="absolute inset-0 flex items-center justify-center"
          {...breathingAnimation}
        >
          <div
            className="size-48 rounded-full md:size-64"
            style={{
              background:
                "radial-gradient(circle, color-mix(in oklch, var(--primary), transparent 92%) 0%, transparent 70%)",
            }}
          />
        </motion.div>

        <svg
          className="relative z-10 w-[180px] opacity-[0.12] md:w-[240px]"
          viewBox="0 0 240 160"
          fill="none"
          aria-hidden
        >
          <rect
            x="4"
            y="4"
            width="232"
            height="152"
            rx="8"
            stroke="currentColor"
            strokeWidth="2"
          />
          <line x1="4" y1="80" x2="236" y2="80" stroke="currentColor" strokeWidth="1" opacity="0.5" />
        </svg>
      </div>

      <div className="mx-auto min-h-[1.5rem] w-full max-w-[480px] text-center">
        <AnimatePresence mode="wait">
          <motion.p
            key={lineIndex}
            initial={reducedMotion ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={reducedMotion ? undefined : { opacity: 0 }}
            transition={{ duration: reducedMotion ? 0 : 0.2 }}
            className="text-sm text-muted-foreground"
          >
            {lines[lineIndex]}
          </motion.p>
        </AnimatePresence>
      </div>

      <StudioComposerShell />
    </div>
  )
}

"use client"

import { useEffect, useState } from "react"
import { AnimatePresence, motion } from "framer-motion"

import { Button } from "@/components/ui/button"
import type { CampaignBrief } from "@/lib/campaign-creator/types"
import { STUDIO_GENERATION } from "@/lib/campaign-creator/studio-config"
import {
  GENERATION_FAILED_LINE,
  GENERATION_RETRY_LABEL,
  GENERATION_SECOND_SLOW_LINE,
  GENERATION_SLOW_LINE,
  buildGenerationNarrativeLines,
} from "@/lib/campaign-creator/studio-narrative"
import { useReducedMotion } from "@/hooks/use-reduced-motion"

import { StudioComposerShell } from "./StudioComposerShell"

interface GenerationViewProps {
  brief: CampaignBrief
  failed?: boolean
  onRetry?: () => void
}

export function GenerationView({ brief, failed = false, onRetry }: GenerationViewProps) {
  const reducedMotion = useReducedMotion()
  const lines = buildGenerationNarrativeLines(brief)
  const [lineIndex, setLineIndex] = useState(0)
  const [elapsedMs, setElapsedMs] = useState(0)

  useEffect(() => {
    if (failed) return
    const interval = window.setInterval(() => {
      setLineIndex((current) => (current + 1) % lines.length)
    }, STUDIO_GENERATION.narrativeIntervalMs)
    return () => window.clearInterval(interval)
  }, [failed, lines.length])

  useEffect(() => {
    if (failed) return
    const startedAt = Date.now()
    const interval = window.setInterval(() => {
      setElapsedMs(Date.now() - startedAt)
    }, 250)
    return () => window.clearInterval(interval)
  }, [failed])

  const displayedLine = failed
    ? GENERATION_FAILED_LINE
    : elapsedMs >= STUDIO_GENERATION.secondSlowThresholdMs
      ? GENERATION_SECOND_SLOW_LINE
      : elapsedMs >= STUDIO_GENERATION.slowThresholdMs
        ? GENERATION_SLOW_LINE
        : lines[lineIndex]

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
        aria-live={failed ? "assertive" : "polite"}
        aria-busy={!failed}
      >
        <motion.div
          className="absolute inset-0 flex items-center justify-center"
          {...(failed ? {} : breathingAnimation)}
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

      <div className="mx-auto flex min-h-[1.5rem] w-full max-w-[480px] flex-col items-center gap-4 text-center">
        <AnimatePresence mode="wait">
          <motion.p
            key={displayedLine}
            initial={reducedMotion ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={reducedMotion ? undefined : { opacity: 0 }}
            transition={{ duration: reducedMotion ? 0 : 0.2 }}
            className="text-sm text-muted-foreground"
            role="status"
          >
            {displayedLine}
          </motion.p>
        </AnimatePresence>
        {failed && onRetry && (
          <Button autoFocus onClick={onRetry}>
            {GENERATION_RETRY_LABEL}
          </Button>
        )}
      </div>

      <StudioComposerShell />
    </div>
  )
}

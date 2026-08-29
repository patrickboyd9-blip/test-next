"use client"

import { useCallback, useRef, useState } from "react"
import { AnimatePresence, motion } from "framer-motion"

import { Button } from "@/components/ui/button"
import { getActiveVersion } from "@/lib/campaign-creator/creative-state"
import type { Campaign, CreativeDirection, CreativeSpec } from "@/lib/campaign-creator/types"
import { useReducedMotion } from "@/hooks/use-reduced-motion"

import { PostcardPreview, PostcardSideToggle } from "./PostcardPreview"
import { RevisionHistoryPanel } from "./RevisionHistoryPanel"
import { StudioComposer } from "./StudioComposer"

interface RefinementViewProps {
  campaign: Campaign
  direction: CreativeDirection
  activeSpec: CreativeSpec
  onCompare: () => void
  onApprove: () => void
  onApplyRefinement: (prompt: string) => Promise<CampaignUpdateResult>
  onRestoreRevision: (revisionId: string) => Promise<CampaignUpdateResult>
}

export interface CampaignUpdateResult {
  studioResponse?: string
  responseAssertive?: boolean
  changedRegions?: string[]
  isConflict?: boolean
}

export function RefinementView({
  campaign,
  direction,
  activeSpec,
  onCompare,
  onApprove,
  onApplyRefinement,
  onRestoreRevision,
}: RefinementViewProps) {
  const reducedMotion = useReducedMotion()
  const [side, setSide] = useState<"front" | "back">("front")
  const [composerValue, setComposerValue] = useState("")
  const [isApplying, setIsApplying] = useState(false)
  const [isRestoring, setIsRestoring] = useState(false)
  const [studioResponse, setStudioResponse] = useState<string | null>(null)
  const [responseAssertive, setResponseAssertive] = useState(false)
  const [highlightRegions, setHighlightRegions] = useState<string[]>([])
  const [isShimmering, setIsShimmering] = useState(false)
  const applyLockRef = useRef(false)
  const lastAppliedRef = useRef(0)

  const version = getActiveVersion(campaign.creative, direction.id)

  const clearHighlight = useCallback(() => {
    window.setTimeout(() => setHighlightRegions([]), reducedMotion ? 1000 : 1500)
  }, [reducedMotion])

  const runSuccessMotion = useCallback(
    (regions: string[]) => {
      setIsShimmering(true)
      window.setTimeout(
        () => {
          setIsShimmering(false)
          setHighlightRegions(regions)
          clearHighlight()
        },
        reducedMotion ? 300 : 600
      )
    },
    [clearHighlight, reducedMotion]
  )

  async function handleApply() {
    const prompt = composerValue.trim()
    if (!prompt || isApplying || applyLockRef.current) return

    const now = Date.now()
    if (now - lastAppliedRef.current < 300) return

    applyLockRef.current = true
    setIsApplying(true)
    setStudioResponse(null)

    const previousPrompt = composerValue

    try {
      const result = await onApplyRefinement(prompt)

      if (result.studioResponse) {
        setStudioResponse(result.studioResponse)
        setResponseAssertive(result.responseAssertive ?? false)
      }

      if (result.isConflict) {
        setComposerValue(previousPrompt)
      } else {
        setComposerValue("")
        if (result.changedRegions?.length) {
          runSuccessMotion(result.changedRegions)
        }
      }

      lastAppliedRef.current = Date.now()
    } catch {
      setStudioResponse("Something went wrong applying that change. Please try again.")
      setResponseAssertive(true)
      setComposerValue(previousPrompt)
    } finally {
      setIsApplying(false)
      window.setTimeout(() => {
        applyLockRef.current = false
      }, 300)
    }
  }

  async function handleRestore(revisionId: string) {
    if (isRestoring) return
    setIsRestoring(true)
    setStudioResponse(null)

    try {
      const result = await onRestoreRevision(revisionId)
      setStudioResponse(result.studioResponse ?? "Restored — your design has been updated.")
      setResponseAssertive(false)
      setComposerValue("")
      if (result.changedRegions?.length) {
        runSuccessMotion(result.changedRegions)
      }
    } catch {
      setStudioResponse("Could not restore that version. Please try again.")
      setResponseAssertive(true)
    } finally {
      setIsRestoring(false)
    }
  }

  return (
    <div className="flex flex-col gap-6 pb-24 md:pb-20">
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-lg font-semibold">Refining: {direction.name}</h2>
        <span className="rounded bg-muted px-2 py-0.5 text-xs font-medium">v{version} current</span>
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={`refine-${direction.id}`}
          initial={reducedMotion ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={reducedMotion ? undefined : { opacity: 0 }}
          transition={{ duration: reducedMotion ? 0.15 : 0.2 }}
          className="grid gap-6 md:grid-cols-[1fr_280px]"
        >
          <div className="flex flex-col items-center gap-2">
            <PostcardPreview
              spec={activeSpec}
              side={side}
              size="hero"
              highlightRegions={highlightRegions}
              isShimmering={isShimmering}
              ariaLabel={`Postcard front: ${activeSpec.headline ?? direction.name}`}
            />
            <PostcardSideToggle side={side} onSideChange={setSide} />
          </div>

          <RevisionHistoryPanel
            creative={campaign.creative}
            directionId={direction.id}
            onRestore={handleRestore}
            isRestoring={isRestoring}
            className="order-2 md:order-none"
          />
        </motion.div>
      </AnimatePresence>

      <motion.div
        initial={reducedMotion ? false : { opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: reducedMotion ? 0.15 : 0.2, delay: reducedMotion ? 0 : 0.15 }}
      >
        <StudioComposer
          brief={campaign.brief}
          value={composerValue}
          onValueChange={setComposerValue}
          onSubmit={handleApply}
          disabled={isRestoring}
          isApplying={isApplying}
          studioResponse={studioResponse}
          responseAssertive={responseAssertive}
          autoFocus
        />
      </motion.div>

      <div className="fixed bottom-0 left-0 right-0 z-10 border-t border-border bg-background/95 px-4 py-3 backdrop-blur md:static md:border-0 md:bg-transparent md:p-0 md:backdrop-blur-none">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-4">
          <Button variant="link" className="h-auto p-0 text-sm" onClick={onCompare}>
            Compare directions
          </Button>
          <Button onClick={onApprove}>Approve creative →</Button>
        </div>
      </div>
    </div>
  )
}

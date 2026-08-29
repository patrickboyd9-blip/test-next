"use client"

import { useEffect, useMemo, useState, type ReactNode } from "react"

import {
  applyRefinement,
  approveCreative,
  initializeStudioCreative,
  restoreRevision,
  selectCreativeDirection,
} from "@/lib/campaign-creator/actions"
import { getActiveSpec } from "@/lib/campaign-creator/creative-state"
import {
  getLeadDirection,
  getMockCreativeDirections,
} from "@/lib/campaign-creator/mock-creative-data"
import { STUDIO_GENERATION } from "@/lib/campaign-creator/studio-config"
import type { Campaign, CampaignStatus } from "@/lib/campaign-creator/types"

import { ApprovalModal } from "./ApprovalModal"
import { CompareView } from "./CompareView"
import { FocusView } from "./FocusView"
import { GenerationView } from "./GenerationView"
import { LeadRevealView } from "./LeadRevealView"
import { RefinementView, type CampaignUpdateResult } from "./RefinementView"

export type StudioSubPhase =
  | "generating"
  | "lead"
  | "compare"
  | "focus"
  | "refine"
  | "approval"

interface CreativeStudioProps {
  campaign: Campaign
  onCampaignUpdate: (campaign: Campaign) => void
  onProgressStatusChange?: (status: CampaignStatus) => void
  initialSubPhase?: StudioSubPhase
}

export function CreativeStudio({
  campaign,
  onCampaignUpdate,
  onProgressStatusChange,
  initialSubPhase,
}: CreativeStudioProps) {
  const hasPersistedDirections = campaign.creative.directions.length > 0
  const leadDirection = useMemo(() => {
    if (hasPersistedDirections) {
      return getLeadDirection(campaign.creative.directions)
    }
    return getLeadDirection(getMockCreativeDirections(campaign.brief))
  }, [campaign.brief, campaign.creative.directions, hasPersistedDirections])

  const [subPhase, setSubPhase] = useState<StudioSubPhase>(() => {
    if (initialSubPhase) return initialSubPhase
    if (hasPersistedDirections) return "focus"
    return "generating"
  })
  const [approvalReturnPhase, setApprovalReturnPhase] = useState<"focus" | "refine">("focus")
  const [localSelectedId, setLocalSelectedId] = useState<string>(
    campaign.creative.selectedDirectionId ?? leadDirection.id
  )
  const selectedId = campaign.creative.selectedDirectionId ?? localSelectedId
  const [isInitializing, setIsInitializing] = useState(false)
  const [isApproving, setIsApproving] = useState(false)
  const [approvalSettled, setApprovalSettled] = useState(false)

  const directions = hasPersistedDirections
    ? campaign.creative.directions
    : getMockCreativeDirections(campaign.brief)

  const selectedDirection =
    directions.find((d) => d.id === selectedId) ?? leadDirection

  const otherDirections = directions.filter((d) => d.id !== selectedId)

  const activeSpec =
    campaign.creative.activeSpec ??
    getActiveSpec(campaign.creative, selectedId) ??
    selectedDirection.spec

  useEffect(() => {
    if (hasPersistedDirections || isInitializing) return

    onProgressStatusChange?.("generating_creative")

    const timer = window.setTimeout(async () => {
      setIsInitializing(true)
      try {
        const updated = await initializeStudioCreative(campaign.id)
        onCampaignUpdate(updated)
        onProgressStatusChange?.("creative_ready")
        setSubPhase("lead")
      } finally {
        setIsInitializing(false)
      }
    }, STUDIO_GENERATION.totalDurationMs)

    return () => window.clearTimeout(timer)
  }, [
    campaign.id,
    hasPersistedDirections,
    isInitializing,
    onCampaignUpdate,
    onProgressStatusChange,
  ])

  async function handleSelectDirection(directionId: string) {
    setLocalSelectedId(directionId)
    const updated = await selectCreativeDirection(campaign.id, directionId)
    onCampaignUpdate(updated)
  }

  async function handleApplyRefinement(prompt: string): Promise<CampaignUpdateResult> {
    const updated = await applyRefinement(campaign.id, prompt)
    onCampaignUpdate(updated)

    const latest = updated.creative.revisions
      .filter((r) => r.directionId === selectedId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0]

    return {
      studioResponse: latest?.studioResponse,
      responseAssertive: latest?.type === "conflict",
      changedRegions: latest?.specDiff?.changedRegions,
      isConflict: latest?.type === "conflict",
    }
  }

  async function handleRestoreRevision(revisionId: string): Promise<CampaignUpdateResult> {
    const updated = await restoreRevision(campaign.id, revisionId)
    onCampaignUpdate(updated)

    const latest = updated.creative.revisions
      .filter((r) => r.directionId === selectedId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0]

    return {
      studioResponse: latest?.studioResponse,
      changedRegions: latest?.specDiff?.changedRegions,
    }
  }

  function openApproval(from: "focus" | "refine") {
    setApprovalReturnPhase(from)
    setSubPhase("approval")
  }

  async function handleApprove() {
    setIsApproving(true)
    try {
      const updated = await approveCreative(campaign.id)
      setApprovalSettled(true)
      const delay =
        typeof window !== "undefined" &&
        window.matchMedia("(prefers-reduced-motion: reduce)").matches
          ? 150
          : 400
      window.setTimeout(() => {
        onCampaignUpdate(updated)
        onProgressStatusChange?.("creative_approved")
        setApprovalSettled(false)
      }, delay)
    } finally {
      setIsApproving(false)
    }
  }

  if (campaign.status === "creative_approved") {
    return null
  }

  if (!hasPersistedDirections && (subPhase === "generating" || isInitializing)) {
    return <GenerationView brief={campaign.brief} />
  }

  let body: ReactNode = null

  if (subPhase === "lead") {
    body = (
      <LeadRevealView
        direction={leadDirection}
        onContinue={async () => {
          await handleSelectDirection(leadDirection.id)
          setSubPhase("focus")
        }}
        onCompare={() => setSubPhase("compare")}
      />
    )
  } else if (subPhase === "compare") {
    body = (
      <CompareView
        directions={directions}
        recommendedId={leadDirection.id}
        onSelect={async (id) => {
          await handleSelectDirection(id)
          setSubPhase("focus")
        }}
        onBack={() => setSubPhase(hasPersistedDirections ? "focus" : "lead")}
      />
    )
  } else if (subPhase === "refine") {
    body = (
      <RefinementView
        key={selectedId}
        campaign={campaign}
        direction={selectedDirection}
        activeSpec={activeSpec}
        onCompare={() => setSubPhase("compare")}
        onApprove={() => openApproval("refine")}
        onApplyRefinement={handleApplyRefinement}
        onRestoreRevision={handleRestoreRevision}
      />
    )
  } else {
    body = (
      <FocusView
        direction={selectedDirection}
        spec={activeSpec}
        otherDirections={otherDirections}
        onCompare={() => setSubPhase("compare")}
        onSwitch={async (id) => {
          await handleSelectDirection(id)
        }}
        onStartRefining={() => setSubPhase("refine")}
        onApproveAsIs={() => openApproval("focus")}
      />
    )
  }

  return (
    <>
      {body}
      {subPhase === "approval" && (
        <ApprovalModal
          open
          spec={activeSpec}
          brief={campaign.brief}
          directionName={selectedDirection.name}
          onApprove={handleApprove}
          onKeepRefining={() => setSubPhase(approvalReturnPhase)}
          isApproving={isApproving}
          approved={approvalSettled}
        />
      )}
    </>
  )
}

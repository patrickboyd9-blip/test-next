"use client"

import { useState } from "react"

import { isAtOrPastStatus } from "@/lib/campaign-creator/campaign-status"
import { getApprovedSpec } from "@/lib/campaign-creator/creative-state"
import {
  confirmCampaignStrategy,
  confirmCampaignAudience,
  confirmCampaignQuantity,
  sendCampaignMessage,
  updateCampaignBrief,
  unapproveCreative,
} from "@/lib/campaign-creator/actions"
import type { Campaign, CampaignBrief, CampaignStatus, ConversationMessage } from "@/lib/campaign-creator/types"

import { AudienceStage } from "./AudienceStage"
import { BriefSummaryCard } from "./BriefSummaryCard"
import { CampaignCreatorLayout } from "./CampaignCreatorLayout"
import { CollapsedConversation } from "./CollapsedConversation"
import { Composer } from "./Composer"
import { ConversationThread } from "./ConversationThread"
import { OpeningPrompt } from "./OpeningPrompt"
import { QuantityTrackingStage } from "./QuantityTrackingStage"
import { CreativeStudio } from "./studio/CreativeStudio"
import { PersistentCreativeHeader } from "./studio/PersistentCreativeHeader"

interface CampaignCreatorViewProps {
  initialCampaign: Campaign
}

export function CampaignCreatorView({ initialCampaign }: CampaignCreatorViewProps) {
  const [campaign, setCampaign] = useState<Campaign>(initialCampaign)
  const [composerValue, setComposerValue] = useState("")
  const [pendingMessage, setPendingMessage] = useState<string | null>(null)
  const [isSending, setIsSending] = useState(false)
  const [isConfirmingStrategy, setIsConfirmingStrategy] = useState(false)
  const [isConfirmingAudience, setIsConfirmingAudience] = useState(false)
  const [isConfirmingQuantity, setIsConfirmingQuantity] = useState(false)
  const [isUnapproving, setIsUnapproving] = useState(false)
  const [studioProgressStatus, setStudioProgressStatus] = useState<CampaignStatus | undefined>()
  const [showApprovedHandoff, setShowApprovedHandoff] = useState(false)
  const [resumeInRefinement, setResumeInRefinement] = useState(false)

  async function handleSend() {
    const text = composerValue.trim()
    if (!text) return

    setPendingMessage(text)
    setComposerValue("")
    setIsSending(true)
    try {
      const updated = await sendCampaignMessage(campaign.id, text)
      setCampaign(updated)
    } finally {
      setPendingMessage(null)
      setIsSending(false)
    }
  }

  async function handleFieldChange(patch: Partial<CampaignBrief>) {
    setCampaign((prev) => ({ ...prev, brief: { ...prev.brief, ...patch } }))
    const updated = await updateCampaignBrief(campaign.id, patch)
    setCampaign(updated)
  }

  async function handleConfirmStrategy() {
    setIsConfirmingStrategy(true)
    try {
      const updated = await confirmCampaignStrategy(campaign.id)
      setCampaign(updated)
      setStudioProgressStatus("generating_creative")
    } finally {
      setIsConfirmingStrategy(false)
    }
  }

  async function handleConfirmAudience() {
    setIsConfirmingAudience(true)
    try {
      const updated = await confirmCampaignAudience(campaign.id)
      setCampaign(updated)
    } finally {
      setIsConfirmingAudience(false)
    }
  }

  async function handleConfirmQuantity() {
    setIsConfirmingQuantity(true)
    try {
      const updated = await confirmCampaignQuantity(campaign.id)
      setCampaign(updated)
    } finally {
      setIsConfirmingQuantity(false)
    }
  }

  async function handleEditCreative() {
    setIsUnapproving(true)
    try {
      const updated = await unapproveCreative(campaign.id)
      setCampaign(updated)
      setStudioProgressStatus("creative_ready")
      setShowApprovedHandoff(false)
      setResumeInRefinement(true)
    } finally {
      setIsUnapproving(false)
    }
  }

  function handleCampaignUpdate(updated: Campaign) {
    setCampaign(updated)
    if (updated.status === "creative_approved") {
      setShowApprovedHandoff(true)
    }
  }

  const displayMessages: ConversationMessage[] = pendingMessage
    ? [
        ...campaign.transcript,
        {
          id: "pending",
          role: "customer",
          content: pendingMessage,
          createdAt: new Date().toISOString(),
        },
      ]
    : campaign.transcript

  const showStrategySummary =
    campaign.status === "draft" && campaign.readyForBriefReview
  const showComposer = campaign.status === "draft"
  const showCreativeStudio = isAtOrPastStatus(campaign.status, "strategy_confirmed")
  const isCreativeApproved = campaign.status === "creative_approved"
  const showAudience = isAtOrPastStatus(campaign.status, "creative_approved")
  const showQuantityTracking = isAtOrPastStatus(campaign.status, "audience_confirmed")

  const progressStatus = studioProgressStatus ?? campaign.status

  const selectedDirectionId = campaign.creative.selectedDirectionId
  const approvedDirection = campaign.creative.directions.find(
    (d) => d.id === selectedDirectionId
  )
  const approvedSpec = getApprovedSpec(campaign.creative)

  const interviewContent = (
    <>
      {campaign.transcript.length === 0 && !pendingMessage ? (
        <OpeningPrompt onSelectExample={setComposerValue} />
      ) : (
        <ConversationThread messages={displayMessages} isThinking={isSending} />
      )}

      {showComposer && (
        <Composer
          value={composerValue}
          onValueChange={setComposerValue}
          onSend={handleSend}
          disabled={isSending}
        />
      )}

      {showStrategySummary && (
        <BriefSummaryCard
          brief={campaign.brief}
          status={campaign.status}
          onFieldChange={handleFieldChange}
          onConfirm={handleConfirmStrategy}
          isConfirming={isConfirmingStrategy}
        />
      )}
    </>
  )

  const studioContent = (
    <>
      <CollapsedConversation messages={campaign.transcript} />

      {isCreativeApproved && approvedDirection && approvedSpec && (
        <PersistentCreativeHeader
          direction={approvedDirection}
          spec={approvedSpec}
          onEditCreative={handleEditCreative}
          isEditing={isUnapproving}
        />
      )}

      {showApprovedHandoff && isCreativeApproved && (
        <p className="mb-6 text-sm text-muted-foreground" role="status" aria-live="polite">
          Creative approved — audience confirmation comes next.
        </p>
      )}

      {showCreativeStudio && !isCreativeApproved && (
        <CreativeStudio
          key={resumeInRefinement ? "refine-resume" : "studio"}
          campaign={campaign}
          onCampaignUpdate={handleCampaignUpdate}
          onProgressStatusChange={setStudioProgressStatus}
          initialSubPhase={resumeInRefinement ? "refine" : undefined}
        />
      )}

      {showAudience && (
        <AudienceStage
          audience={campaign.brief.audience}
          status={campaign.status}
          onFieldChange={handleFieldChange}
          onConfirm={handleConfirmAudience}
          isConfirming={isConfirmingAudience}
        />
      )}

      {showQuantityTracking && (
        <QuantityTrackingStage
          brief={campaign.brief}
          status={campaign.status}
          onFieldChange={handleFieldChange}
          onConfirm={handleConfirmQuantity}
          isConfirming={isConfirmingQuantity}
        />
      )}
    </>
  )

  return (
    <CampaignCreatorLayout
      status={campaign.status}
      progressStatus={progressStatus}
      interview={interviewContent}
      studio={studioContent}
    />
  )
}

"use client"

import { useEffect, useMemo, useState, type SetStateAction } from "react"

import { beginUploadedDesignPath } from "@/lib/bring-your-own-design/actions"
import type { UploadPathBasics } from "@/lib/bring-your-own-design/upload-path"
import { isAtOrPastStatus } from "@/lib/campaign-creator/campaign-status"
import { toCreativeCanvas } from "@/lib/campaign-creator/creative-canvas"
import { getApprovedSpec } from "@/lib/campaign-creator/creative-state"
import { postcardIdentityFromBrief } from "@/lib/campaign-creator/studio-contact"
import { campaignForCustomer } from "@/lib/campaign-creator/customer-campaign"
import { creativeSurfaceForCampaign } from "@/lib/campaign-creator/start-path"
import { presentStudioPhoto } from "@/lib/campaign-creator/studio-photo"
import {
  beginFromTemplate,
  confirmCampaignStrategy,
  confirmCampaignAudience,
  confirmCampaignQuantity,
  getMailPieceFormatRecommendation,
  recoverMissingMailPiece,
  sendCampaignMessage,
  updateCampaignBrief,
  unapproveCreative,
  type MailPieceFormatRecommendationView,
} from "@/lib/campaign-creator/actions"
import type { PrintMailMode } from "@/lib/click2mail/mode"
import type { Campaign, CampaignBrief, CampaignStatus, ConversationMessage } from "@/lib/campaign-creator/types"
import { getMailPiece } from "@/lib/mail-catalog/catalog"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

import { AudienceStage } from "./AudienceStage"
import { BriefSummaryCard } from "./BriefSummaryCard"
import { CampaignCreatorLayout } from "./CampaignCreatorLayout"
import { CampaignOpening } from "./CampaignOpening"
import { CollapsedConversation } from "./CollapsedConversation"
import { Composer } from "./Composer"
import { ConversationThread } from "./ConversationThread"
import { PrintMailTestStage } from "./PrintMailTestStage"
import { QuantityTrackingStage } from "./QuantityTrackingStage"
import { AiPrintProof } from "./AiPrintProof"
import { UploadDesign } from "./upload/UploadDesign"
import { CreativeStudio } from "./studio/CreativeStudio"
import { PersistentCreativeHeader } from "./studio/PersistentCreativeHeader"
import { useStudioDirectionImages } from "./studio/use-studio-direction-images"

function resolveStudioCanvas(campaign: Campaign) {
  const mailPieceSpec = campaign.mailPieceSpec
  if (!mailPieceSpec) return null
  return toCreativeCanvas(
    getMailPiece(mailPieceSpec.selectedCatalogId, mailPieceSpec.selectedCatalogVersion)
  )
}

function isMissingCurrentMailPieceError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : ""
  return /missing a current mail piece/i.test(message)
}

interface CampaignCreatorViewProps {
  initialCampaign: Campaign
  printMailMode: PrintMailMode
  designReviewAvailable?: boolean
}

export function CampaignCreatorView({
  initialCampaign,
  printMailMode,
  designReviewAvailable = false,
}: CampaignCreatorViewProps) {
  const [campaign, setCampaignState] = useState<Campaign>(() => campaignForCustomer(initialCampaign))
  const setCampaign = (value: SetStateAction<Campaign>) => {
    setCampaignState((prev) => {
      const next = typeof value === "function" ? value(prev) : value
      return campaignForCustomer(next)
    })
  }
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
  const [isRecoveringMailPiece, setIsRecoveringMailPiece] = useState(false)
  const [recoveryFromFailedConfirm, setRecoveryFromFailedConfirm] = useState(false)
  const [formatRecommendation, setFormatRecommendation] =
    useState<MailPieceFormatRecommendationView | null>(null)

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
    if (!campaign.mailPiece && campaign.creative.directions.length > 0) {
      return
    }

    setIsConfirmingAudience(true)
    try {
      const updated = await confirmCampaignAudience(campaign.id)
      setCampaign(updated)
    } catch (error) {
      if (
        isMissingCurrentMailPieceError(error) &&
        campaign.creative.directions.length > 0
      ) {
        setRecoveryFromFailedConfirm(true)
        return
      }
      throw error
    } finally {
      setIsConfirmingAudience(false)
    }
  }

  async function handleConfirmQuantity() {
    if (!campaign.mailPiece && campaign.creative.directions.length > 0) {
      return
    }

    setIsConfirmingQuantity(true)
    try {
      const updated = await confirmCampaignQuantity(campaign.id)
      setCampaign(updated)
    } catch (error) {
      if (
        isMissingCurrentMailPieceError(error) &&
        campaign.creative.directions.length > 0
      ) {
        setRecoveryFromFailedConfirm(true)
        return
      }
      throw error
    } finally {
      setIsConfirmingQuantity(false)
    }
  }

  async function handleRecoverMissingMailPiece() {
    setIsRecoveringMailPiece(true)
    try {
      const updated = await recoverMissingMailPiece(campaign.id)
      setCampaign(updated)
      setShowApprovedHandoff(false)
      setRecoveryFromFailedConfirm(false)
    } finally {
      setIsRecoveringMailPiece(false)
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
  const awaitingFirstMessage = campaign.transcript.length === 0 && !pendingMessage
  const showComposer = campaign.status === "draft" && !awaitingFirstMessage
  const showCreativeStudio = isAtOrPastStatus(campaign.status, "strategy_confirmed")
  const isCreativeApproved = campaign.status === "creative_approved"
  const surface = creativeSurfaceForCampaign(campaign)
  const uploadPath = surface === "upload"
  const showStudio = showCreativeStudio && !isCreativeApproved && surface !== "upload"
  const showAudience = isAtOrPastStatus(campaign.status, "creative_approved")
  const showQuantityTracking = isAtOrPastStatus(campaign.status, "audience_confirmed")
  const hasPersistedCreative = campaign.creative.directions.length > 0
  const atAudienceOrQuantityConfirm =
    campaign.status === "creative_approved" || campaign.status === "audience_confirmed"
  const showMailPieceRecovery =
    hasPersistedCreative &&
    ((atAudienceOrQuantityConfirm && !campaign.mailPiece) || recoveryFromFailedConfirm)

  useEffect(() => {
    if (!showStrategySummary) return

    let cancelled = false
    void getMailPieceFormatRecommendation(campaign.brief)
      .then((recommendation) => {
        if (!cancelled) setFormatRecommendation(recommendation)
      })
      .catch((error) => {
        console.error("Failed to load mail-piece format recommendation:", error)
      })

    return () => {
      cancelled = true
    }
  }, [showStrategySummary, campaign.brief])

  const progressStatus = studioProgressStatus ?? campaign.status

  const canvas = useMemo(() => resolveStudioCanvas(campaign), [campaign])
  const studioPhotos = useStudioDirectionImages(campaign)
  const identity = postcardIdentityFromBrief(campaign.brief)

  const selectedDirectionId = campaign.creative.selectedDirectionId
  const approvedDirection = campaign.creative.directions.find(
    (d) => d.id === selectedDirectionId
  )
  const approvedSpec = getApprovedSpec(campaign.creative)
  const approvedPhoto =
    approvedDirection && approvedSpec
      ? presentStudioPhoto(
          studioPhotos,
          approvedDirection.id,
          approvedSpec,
          campaign.brief
        )
      : null

  const interviewContent = (
    <>
      {awaitingFirstMessage ? (
        <CampaignOpening
          composerValue={composerValue}
          onComposerChange={setComposerValue}
          onSend={handleSend}
          sending={isSending}
          onSelectExample={setComposerValue}
          onSubmitUpload={async (basics: UploadPathBasics) => {
            const updated = await beginUploadedDesignPath(campaign.id, basics)
            setCampaign(updated)
          }}
          onSelectTemplate={async (templateId: string) => {
            const updated = await beginFromTemplate(campaign.id, templateId)
            setCampaign(updated)
          }}
        />
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
          formatRecommendation={
            showStrategySummary ? formatRecommendation ?? undefined : undefined
          }
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

      {isCreativeApproved && Boolean(campaign.mailPiece) && approvedDirection && approvedSpec && (
        <PersistentCreativeHeader
          canvas={canvas}
          direction={approvedDirection}
          spec={approvedSpec}
          identity={identity}
          brief={campaign.brief}
          generatedAsset={approvedPhoto?.generatedAsset}
          alternateGeneratedAsset={approvedPhoto?.alternateAsset}
          allowLibraryFallback={approvedPhoto?.allowLibraryFallback ?? false}
          photoNote={approvedPhoto?.note}
          onEditCreative={handleEditCreative}
          isEditing={isUnapproving}
        />
      )}

      {showApprovedHandoff && isCreativeApproved && Boolean(campaign.mailPiece) && (
        <p className="mb-6 text-sm text-muted-foreground" role="status" aria-live="polite">
          Creative approved. Confirm the audience when you are ready. A staging print test is below.
        </p>
      )}

      {isCreativeApproved && !uploadPath && campaign.entry !== "upload" && Boolean(campaign.mailPiece) && (
        <AiPrintProof campaign={campaign} />
      )}

      {isAtOrPastStatus(campaign.status, "creative_approved") && Boolean(campaign.mailPiece) && (
        <div className="mb-6">
          <PrintMailTestStage
            campaign={campaign}
            mode={printMailMode}
            onCampaign={setCampaign}
          />
        </div>
      )}

      {uploadPath && (
        <UploadDesign
          campaign={campaign}
          onCampaign={handleCampaignUpdate}
          reviewAvailable={designReviewAvailable}
          readOnly={isCreativeApproved}
          onEdit={isCreativeApproved ? () => void handleEditCreative() : undefined}
          isEditing={isUnapproving}
        />
      )}

      {showStudio && (
        <CreativeStudio
          key={resumeInRefinement ? "refine-resume" : "studio"}
          campaign={campaign}
          canvas={canvas}
          studioPhotos={studioPhotos}
          onCampaignUpdate={handleCampaignUpdate}
          onProgressStatusChange={setStudioProgressStatus}
          initialSubPhase={
            resumeInRefinement || campaign.entry === "template" ? "refine" : undefined
          }
        />
      )}

      {showMailPieceRecovery && (
        <Card role="status" aria-live="polite">
          <CardHeader>
            <CardTitle>Your mailer needs one more review</CardTitle>
            <CardDescription>
              Review and approve your creative before continuing. Audience and quantity
              stay as you left them.
            </CardDescription>
          </CardHeader>
          <CardFooter className="justify-end">
            <Button
              onClick={() => void handleRecoverMissingMailPiece()}
              disabled={isRecoveringMailPiece}
            >
              {isRecoveringMailPiece ? "Opening studio…" : "Review & Approve"}
            </Button>
          </CardFooter>
        </Card>
      )}

      {showAudience && (
        <AudienceStage
          audience={campaign.brief.audience}
          status={campaign.status}
          fromConversation={campaign.entry !== "upload" && campaign.entry !== "template"}
          onFieldChange={handleFieldChange}
          onConfirm={handleConfirmAudience}
          isConfirming={isConfirmingAudience}
          hideConfirm={showMailPieceRecovery}
        />
      )}

      {showQuantityTracking && (
        <QuantityTrackingStage
          brief={campaign.brief}
          status={campaign.status}
          onFieldChange={handleFieldChange}
          onConfirm={handleConfirmQuantity}
          isConfirming={isConfirmingQuantity}
          hideConfirm={showMailPieceRecovery}
        />
      )}
    </>
  )

  return (
    <CampaignCreatorLayout
      status={campaign.status}
      entry={campaign.entry}
      progressStatus={progressStatus}
      interview={interviewContent}
      studio={studioContent}
    />
  )
}

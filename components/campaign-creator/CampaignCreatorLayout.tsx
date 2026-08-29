"use client"

import { cn } from "@/lib/utils"
import { isInterviewMode, isStudioMode } from "@/lib/campaign-creator/campaign-status"
import type { CampaignStatus } from "@/lib/campaign-creator/types"

import { CampaignProgress } from "./CampaignProgress"

interface CampaignCreatorLayoutProps {
  status: CampaignStatus
  /** Client-side studio phase override for progress (e.g. generating_creative). */
  progressStatus?: CampaignStatus
  interview: React.ReactNode
  studio: React.ReactNode
  className?: string
}

export function CampaignCreatorLayout({
  status,
  progressStatus,
  interview,
  studio,
  className,
}: CampaignCreatorLayoutProps) {
  const interviewMode = isInterviewMode(status)
  const studioMode = isStudioMode(status)
  const progress = progressStatus ?? status

  return (
    <div className={cn("mx-auto flex w-full flex-1 flex-col gap-8", className)}>
      <CampaignProgress status={progress} />

      {interviewMode && (
        <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 animate-in fade-in duration-300">
          {interview}
        </div>
      )}

      {studioMode && (
        <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-8 animate-in fade-in duration-300 delay-100">
          {studio}
        </div>
      )}
    </div>
  )
}

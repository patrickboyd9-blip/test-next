"use client"

import { useState } from "react"

import { Button } from "@/components/ui/button"
import { removeCampaignLogo, saveCampaignLogo } from "@/lib/campaign-creator/logo-actions"
import { mentionsLogo, uploadedLogo } from "@/lib/campaign-creator/customer-logo"
import type { Campaign, CampaignBrief } from "@/lib/campaign-creator/types"

interface LogoUploadProps {
  campaignId: string
  brief: CampaignBrief
  /** Words the customer has typed, so a mentioned logo is not treated as a file. */
  promptText?: string
  onCampaign: (campaign: Campaign) => void
}

export function LogoUpload({ campaignId, brief, promptText, onCampaign }: LogoUploadProps) {
  const logo = uploadedLogo(brief)
  const [pending, setPending] = useState<"upload" | "remove" | null>(null)
  const [error, setError] = useState<string | null>(null)
  const mentioned = mentionsLogo(promptText) || mentionsLogo(brief.otherRequirements) || mentionsLogo(brief.brandAssets?.map((asset) => asset.description).join(" "))
  const missing = mentioned && !logo

  async function onFile(file: File | undefined) {
    if (!file) return
    setError(null)
    setPending("upload")
    try {
      const data = new FormData()
      data.set("logo", file)
      const result = await saveCampaignLogo(campaignId, data)
      if (!result.ok) {
        setError(result.error)
        return
      }
      onCampaign(result.campaign)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The logo could not be saved.")
    } finally {
      setPending(null)
    }
  }

  async function onRemove() {
    setError(null)
    setPending("remove")
    try {
      const result = await removeCampaignLogo(campaignId)
      if (!result.ok) {
        setError(result.error)
        return
      }
      onCampaign(result.campaign)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The logo could not be removed.")
    } finally {
      setPending(null)
    }
  }

  return (
    <div className="flex flex-col gap-2 rounded-xl border border-dashed border-input bg-card p-3" data-slot="logo-upload">
      <div className="flex flex-wrap items-center gap-3">
        {logo?.fileUrl ? (
          // The file is the customer's mark. object-contain keeps its proportions.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={logo.fileUrl}
            alt="Your logo"
            className="h-14 w-24 rounded-md bg-[repeating-conic-gradient(#e7e5e4_0%_25%,#fafaf9_0%_50%)] bg-[length:12px_12px] object-contain p-1"
            data-logo-preview="true"
          />
        ) : (
          <div className="flex h-14 w-24 items-center justify-center rounded-md bg-muted text-center text-[10px] leading-tight text-muted-foreground">
            No logo yet
          </div>
        )}
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium">Logo</p>
          <p className="text-xs leading-5 text-muted-foreground">
            Optional. This file is placed on the card as-is. The photograph is not redrawn to include it.
          </p>
        </div>
        <label className="inline-flex">
          <input
            type="file"
            accept="image/png,image/jpeg"
            className="sr-only"
            aria-label={logo ? "Replace logo" : "Upload logo"}
            disabled={pending !== null}
            onChange={(event) => {
              const file = event.target.files?.[0]
              event.target.value = ""
              void onFile(file)
            }}
          />
          <span className="inline-flex h-8 cursor-pointer items-center rounded-md border border-input bg-background px-3 text-xs font-medium">
            {pending === "upload" ? "Uploading…" : logo ? "Replace" : "Upload"}
          </span>
        </label>
        {logo ? (
          <Button type="button" variant="outline" size="sm" disabled={pending !== null} onClick={() => void onRemove()}>
            {pending === "remove" ? "Removing…" : "Remove"}
          </Button>
        ) : null}
      </div>
      {missing ? (
        <p className="text-sm text-amber-800" role="status">
          You mentioned a logo. Upload the file here. A logo is not invented in its place.
        </p>
      ) : null}
      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  )
}

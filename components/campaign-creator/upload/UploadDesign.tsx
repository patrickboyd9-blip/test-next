"use client"

import { useState } from "react"

import { approveUploadedDesign, chooseDesignPath } from "@/lib/bring-your-own-design/actions"
import type { Campaign, DesignFaceName, UploadedDesignIssue } from "@/lib/campaign-creator/types"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

import { ProofFrame } from "./ProofFrame"

interface UploadDesignProps {
  campaign: Campaign
  onCampaign: (campaign: Campaign) => void
  readOnly?: boolean
  onEdit?: () => void
  isEditing?: boolean
}

export function UploadDesign({ campaign, onCampaign, readOnly, onEdit, isEditing }: UploadDesignProps) {
  const design = campaign.uploadedDesign
  const issues = design?.issues ?? []
  const errors = issues.filter((item) => item.severity === "error")
  const warnings = issues.filter((item) => item.severity === "warning")
  const bothSides = Boolean(design?.front && design?.back)
  const canApprove = bothSides && errors.length === 0 && !readOnly
  const [uploading, setUploading] = useState<DesignFaceName | null>(null)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [approving, setApproving] = useState(false)
  const [confirmed, setConfirmed] = useState(false)
  const [switching, setSwitching] = useState(false)

  async function onFile(face: DesignFaceName, file: File | undefined) {
    if (!file) return
    setUploadError(null)
    setConfirmed(false)
    setUploading(face)
    try {
      const body = new FormData()
      body.set("face", face)
      body.set("file", file)
      const response = await fetch(`/api/campaigns/${campaign.id}/design`, { method: "POST", body })
      const payload = (await response.json()) as { campaign?: Campaign; error?: string }
      if (!response.ok || !payload.campaign) {
        setUploadError(payload.error ?? "The file could not be uploaded.")
        return
      }
      onCampaign(payload.campaign)
    } catch {
      setUploadError("The file could not be uploaded. Try again.")
    } finally {
      setUploading(null)
    }
  }

  async function approve() {
    setApproving(true)
    setUploadError(null)
    try {
      const updated = await approveUploadedDesign(campaign.id)
      onCampaign(updated)
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : "The proof could not be approved.")
    } finally {
      setApproving(false)
    }
  }

  async function switchToStudio() {
    setSwitching(true)
    try {
      const updated = await chooseDesignPath(campaign.id, "studio")
      onCampaign(updated)
    } finally {
      setSwitching(false)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h2 className="text-lg font-medium">{readOnly ? "Approved design" : "Upload your design"}</h2>
        <p className="text-sm leading-6 text-muted-foreground">
          This campaign prints a 5×8 postcard. Each file should be one page, 8.5 × 5.5 inches,
          which includes a quarter inch of bleed.{" "}
          <a href="/app/templates" className="underline-offset-4 hover:underline">
            Download the template and the short instructions.
          </a>
        </p>
      </div>

      {!readOnly && (
        <div className="grid gap-4 sm:grid-cols-2">
          <FacePicker
            label="Front"
            fileName={design?.front?.fileName}
            busy={uploading === "front"}
            onFile={(file) => void onFile("front", file)}
          />
          <FacePicker
            label="Back"
            fileName={design?.back?.fileName}
            busy={uploading === "back"}
            onFile={(file) => void onFile("back", file)}
          />
        </div>
      )}

      {uploadError && (
        <p className="text-sm text-destructive" role="alert">
          {uploadError}
        </p>
      )}

      {issues.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>{errors.length > 0 ? "This file needs a change" : "Look at this before you approve"}</CardTitle>
            <CardDescription>
              {errors.length > 0
                ? "Fix the items below. Then upload the file again."
                : "You can still approve the proof. Read these first."}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {issues.map((item) => (
              <IssueLine key={`${item.face}-${item.code}-${item.message}`} issue={item} />
            ))}
          </CardContent>
        </Card>
      )}

      {bothSides && design?.front && design.back && (
        <div className="flex flex-col gap-4">
          <h3 className="text-base font-medium">Proof</h3>
          <p className="text-sm leading-6 text-muted-foreground">
            The black line is where the card is cut. On the back, the shaded box is the address,
            postage, and barcode. Anything in that box will not show.
          </p>
          <div className="grid gap-6">
            <ProofFrame
              label="Front"
              face="front"
              mediaType={design.front.mediaType}
              src={`/api/uploaded-design/${campaign.id}/${design.front.key}`}
            />
            <ProofFrame
              label="Back"
              face="back"
              mediaType={design.back.mediaType}
              src={`/api/uploaded-design/${campaign.id}/${design.back.key}`}
            />
          </div>
        </div>
      )}

      {!readOnly && canApprove && (
        <div className="flex flex-col gap-3">
          {warnings.length > 0 && (
            <p className="text-sm text-muted-foreground">
              There is a warning above. Approve only if the proof looks right.
            </p>
          )}
          <label className="flex items-start gap-2 text-sm leading-6">
            <input
              type="checkbox"
              className="mt-1"
              checked={confirmed}
              onChange={(event) => setConfirmed(event.target.checked)}
            />
            <span>I have looked at both sides, including the address area, and I approve this proof.</span>
          </label>
          <Button onClick={() => void approve()} disabled={!confirmed || approving}>
            {approving ? "Approving…" : "Approve this proof"}
          </Button>
        </div>
      )}

      {!readOnly && bothSides && errors.length > 0 && (
        <p className="text-sm text-muted-foreground">Fix the files above before you can approve the proof.</p>
      )}

      {readOnly && onEdit && (
        <Button variant="outline" onClick={onEdit} disabled={isEditing}>
          {isEditing ? "Opening…" : "Change the design"}
        </Button>
      )}

      {!readOnly && (
        <button
          type="button"
          className="self-start text-sm text-muted-foreground underline-offset-4 hover:underline"
          onClick={() => void switchToStudio()}
          disabled={switching}
        >
          {switching ? "Opening studio…" : "Design it here instead"}
        </button>
      )}
    </div>
  )
}

function FacePicker({
  label,
  fileName,
  busy,
  onFile,
}: {
  label: string
  fileName?: string
  busy: boolean
  onFile: (file: File | undefined) => void
}) {
  return (
    <label className="flex cursor-pointer flex-col gap-2 rounded-xl border border-dashed p-4 text-sm hover:bg-muted/40">
      <span className="font-medium">{label}</span>
      <span className="text-muted-foreground">{busy ? "Checking the file…" : fileName ?? "PDF, PNG, or JPG"}</span>
      <input
        type="file"
        accept=".pdf,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg"
        className="sr-only"
        disabled={busy}
        onChange={(event) => onFile(event.target.files?.[0])}
      />
    </label>
  )
}

function IssueLine({ issue }: { issue: UploadedDesignIssue }) {
  const side = issue.face === "front" ? "Front" : "Back"
  return (
    <p className={issue.severity === "error" ? "text-sm leading-6 text-destructive" : "text-sm leading-6"}>
      <span className="font-medium">{side}. </span>
      {issue.message}
    </p>
  )
}

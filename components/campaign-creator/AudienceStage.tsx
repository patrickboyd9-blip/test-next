"use client"

import { useState } from "react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import type { AudienceDefinition, CampaignBrief, CampaignStatus } from "@/lib/campaign-creator/types"
import { isAtOrPastStatus } from "@/lib/campaign-creator/campaign-status"

import { AudienceCard } from "./AudienceCard"
import { ResponseEstimate } from "./ResponseEstimate"

interface AudienceStageProps {
  brief: CampaignBrief
  status: CampaignStatus
  fromConversation?: boolean
  onAudienceChange: (draft: AudienceDefinition) => void
  onOpenRoutes: () => void
  routesBusy?: boolean
  onUploadList: (csvText: string) => void
  uploadErrors?: string[]
  onConfirm: () => void
  isConfirming?: boolean
  hideConfirm?: boolean
}

export function AudienceStage({
  brief,
  status,
  fromConversation = true,
  onAudienceChange,
  onOpenRoutes,
  routesBusy,
  onUploadList,
  uploadErrors = [],
  onConfirm,
  isConfirming,
  hideConfirm,
}: AudienceStageProps) {
  const readOnly = status !== "creative_approved"
  const isConfirmed = isAtOrPastStatus(status, "audience_confirmed")
  const audience = brief.audience ?? { description: "" }
  const showUpload = audience.provider?.id === "upload" || audience.listType === "house"
  const [csvText, setCsvText] = useState("")

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-2">
          <CardTitle>Who should receive this?</CardTitle>
          {isConfirmed && <Badge variant="secondary">Confirmed</Badge>}
        </div>
        <CardDescription>
          {isConfirmed
            ? "This audience is confirmed and will carry forward into the rest of your campaign."
            : fromConversation
              ? "This is the audience from the chat. Change it here if something is off."
              : "Describe who should receive this, then confirm it."}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <AudienceCard
          audience={audience}
          editable={!readOnly}
          onChange={onAudienceChange}
          onOpenRoutes={onOpenRoutes}
          routesBusy={routesBusy}
        />
        {showUpload && !readOnly ? (
          <div className="flex flex-col gap-2">
            <label className="text-xs text-muted-foreground" htmlFor="audience-list-csv">
              Your list
            </label>
            <Textarea
              id="audience-list-csv"
              value={csvText}
              placeholder="Paste a CSV with first, last, address1, address2, city, state, and zip."
              onChange={(event) => setCsvText(event.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              The count will be the number of names in the file. We don&apos;t estimate a neighborhood from it.
            </p>
            <Button
              type="button"
              variant="outline"
              className="self-start"
              onClick={() => onUploadList(csvText)}
              disabled={!csvText.trim()}
            >
              Count names in this file
            </Button>
            {uploadErrors.map((error) => (
              <p key={error} className="text-sm text-muted-foreground" role="status">
                {error}
              </p>
            ))}
          </div>
        ) : null}
        <ResponseEstimate brief={{ ...brief, audience }} />
      </CardContent>
      {!readOnly && !hideConfirm && (
        <CardFooter className="justify-end">
          <Button onClick={onConfirm} disabled={isConfirming}>
            {isConfirming ? "Confirming…" : "Confirm audience"}
          </Button>
        </CardFooter>
      )}
    </Card>
  )
}

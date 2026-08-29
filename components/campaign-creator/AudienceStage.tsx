"use client"

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
import type { AudienceDefinition, CampaignBrief, CampaignStatus } from "@/lib/campaign-creator/types"
import { isAtOrPastStatus } from "@/lib/campaign-creator/campaign-status"

import { Field } from "./BriefSummaryCard"

interface AudienceStageProps {
  audience: AudienceDefinition | undefined
  status: CampaignStatus
  onFieldChange: (patch: Partial<CampaignBrief>) => void
  onConfirm: () => void
  isConfirming?: boolean
}

export function AudienceStage({
  audience,
  status,
  onFieldChange,
  onConfirm,
  isConfirming,
}: AudienceStageProps) {
  const readOnly = status !== "creative_approved"
  const isConfirmed = isAtOrPastStatus(status, "audience_confirmed")

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
            : "Here's the audience from our conversation — confirm or adjust it before we build your mailing list."}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <Field
          key={`audienceDescription:${audience?.description ?? ""}`}
          label="Target audience"
          value={audience?.description ?? ""}
          readOnly={readOnly}
          multiline
          placeholder="Who should receive this?"
          onCommit={(value) =>
            onFieldChange({ audience: { ...audience, description: value } })
          }
        />
        <Field
          key={`audienceQuantity:${audience?.quantity ?? ""}`}
          label="Quantity"
          value={audience?.quantity ? String(audience.quantity) : ""}
          readOnly={readOnly}
          type="number"
          placeholder="How many pieces?"
          onCommit={(value) =>
            onFieldChange({
              audience: {
                description: audience?.description ?? "",
                quantity: value ? Number(value) : undefined,
              },
            })
          }
        />
      </CardContent>
      {!readOnly && (
        <CardFooter className="justify-end">
          <Button onClick={onConfirm} disabled={isConfirming}>
            {isConfirming ? "Confirming…" : "Confirm audience"}
          </Button>
        </CardFooter>
      )}
    </Card>
  )
}

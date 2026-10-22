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
import { Separator } from "@/components/ui/separator"
import type { CampaignBrief, CampaignStatus } from "@/lib/campaign-creator/types"
import { isAtOrPastStatus } from "@/lib/campaign-creator/campaign-status"
import { eddmPostageEstimate } from "@/lib/eddm/postage"
import { summarizeSelection } from "@/lib/eddm/routes"

import { Field } from "./BriefSummaryCard"

interface QuantityTrackingStageProps {
  brief: CampaignBrief
  status: CampaignStatus
  onFieldChange: (patch: Partial<CampaignBrief>) => void
  onConfirm: () => void
  isConfirming?: boolean
  hideConfirm?: boolean
}

export function QuantityTrackingStage({
  brief,
  status,
  onFieldChange,
  onConfirm,
  isConfirming,
  hideConfirm,
}: QuantityTrackingStageProps) {
  const readOnly = status !== "audience_confirmed"
  const isConfirmed = isAtOrPastStatus(status, "quantity_confirmed")
  const everyDoor = brief.audience?.delivery === "eddm" && brief.audience.eddm
  const eddmSummary = everyDoor
    ? summarizeSelection(everyDoor.routes, everyDoor.coverage)
    : null
  const eddmPostage = eddmSummary ? eddmPostageEstimate(eddmSummary.pieces) : null

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-2">
          <CardTitle>Quantity &amp; tracking</CardTitle>
          {isConfirmed && <Badge variant="secondary">Confirmed</Badge>}
        </div>
        <CardDescription>
          {isConfirmed
            ? "This is confirmed and will carry forward into the rest of your campaign."
            : "Confirm how many pieces to send and how you'll know it's working."}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {eddmSummary && eddmPostage ? (
          <div className="flex flex-col gap-2">
            <div>
              <p className="text-sm text-muted-foreground">Pieces</p>
              <p className="text-lg font-medium">{eddmSummary.pieces.toLocaleString("en-US")}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">{eddmPostage.label}</p>
              <p className="text-lg font-medium">{eddmPostage.amountLabel}</p>
              <p className="text-sm text-muted-foreground">{eddmPostage.detail}</p>
            </div>
            {eddmSummary.messages.map((message) => (
              <p key={message} className="text-sm text-destructive" role="status">
                {message}
              </p>
            ))}
          </div>
        ) : (
          <Field
            key={`quantity:${brief.audience?.quantity ?? ""}`}
            label="Quantity"
            value={brief.audience?.quantity ? String(brief.audience.quantity) : ""}
            readOnly={readOnly}
            type="number"
            placeholder="How many pieces?"
            onCommit={(value) =>
              onFieldChange({
                audience: {
                  ...brief.audience,
                  description: brief.audience?.description ?? "",
                  quantity: value ? Number(value) : undefined,
                },
              })
            }
          />
        )}

        <Separator />

        <Field
          key={`qrDestination:${brief.qrDestination ?? ""}`}
          label="QR code destination"
          value={brief.qrDestination ?? ""}
          readOnly={readOnly}
          placeholder="Where should the QR code lead?"
          onCommit={(value) => onFieldChange({ qrDestination: value })}
        />
        <Field
          key={`phone:${brief.phone ?? ""}`}
          label="Phone number to feature"
          value={brief.phone ?? ""}
          readOnly={readOnly}
          onCommit={(value) => onFieldChange({ phone: value })}
        />
        <Field
          key={`website:${brief.website ?? ""}`}
          label="Website to feature"
          value={brief.website ?? ""}
          readOnly={readOnly}
          onCommit={(value) => onFieldChange({ website: value })}
        />
      </CardContent>
      {!readOnly && !hideConfirm && (
        <CardFooter className="justify-end">
          <Button onClick={onConfirm} disabled={isConfirming || Boolean(eddmSummary && eddmSummary.messages.length > 0)}>
            {isConfirming ? "Confirming…" : "Confirm quantity & tracking"}
          </Button>
        </CardFooter>
      )}
    </Card>
  )
}

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
import { eddmAudienceIssue } from "@/lib/eddm/validate"

import { EddmAudiencePanel } from "./EddmAudiencePanel"
import { Field } from "./BriefSummaryCard"

interface AudienceStageProps {
  audience: AudienceDefinition | undefined
  briefText?: string
  status: CampaignStatus
  fromConversation?: boolean
  onFieldChange: (patch: Partial<CampaignBrief>) => void
  onConfirm: () => void
  isConfirming?: boolean
  hideConfirm?: boolean
}

export function AudienceStage({
  audience,
  briefText = "",
  status,
  fromConversation = true,
  onFieldChange,
  onConfirm,
  isConfirming,
  hideConfirm,
}: AudienceStageProps) {
  const readOnly = status !== "creative_approved"
  const isConfirmed = isAtOrPastStatus(status, "audience_confirmed")
  const everyDoor = audience?.delivery === "eddm"
  const eddmIssue = everyDoor ? eddmAudienceIssue({ text: briefText, audience: audience?.eddm }) : null

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
            : everyDoor
              ? "Choose the carrier routes. Every address on those routes gets one piece, addressed to Postal Customer."
              : fromConversation
                ? "Here's the audience from our conversation — confirm or adjust it before we build your mailing list."
                : "Describe who should receive this, then confirm it."}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {!readOnly && (
          <div className="flex flex-wrap gap-2" role="group" aria-label="How to choose recipients">
            <Button
              type="button"
              variant={everyDoor ? "outline" : "default"}
              onClick={() =>
                onFieldChange({
                  audience: {
                    description: audience?.description ?? "",
                    quantity: audience?.quantity,
                    delivery: "named_list",
                    eddm: audience?.eddm,
                  },
                })
              }
            >
              A mailing list
            </Button>
            <Button
              type="button"
              variant={everyDoor ? "default" : "outline"}
              onClick={() =>
                onFieldChange({
                  audience: {
                    description: audience?.delivery === "eddm" ? audience.description : "Every door in this area",
                    quantity: audience?.eddm?.routes.length ? audience.quantity : undefined,
                    delivery: "eddm",
                    eddm: audience?.eddm ?? {
                      query: "",
                      zip: "",
                      coverage: "residential",
                      size: "6.5x9",
                      filters: {},
                      selectedRouteIds: [],
                      routes: [],
                    },
                  },
                })
              }
            >
              Every door in an area
            </Button>
          </div>
        )}
        {everyDoor ? (
          <EddmAudiencePanel
            audience={audience}
            briefText={briefText}
            readOnly={readOnly}
            onChange={(next) => onFieldChange({ audience: next })}
          />
        ) : (
          <>
            <Field
              key={`audienceDescription:${audience?.description ?? ""}`}
              label="Target audience"
              value={audience?.description ?? ""}
              readOnly={readOnly}
              multiline
              placeholder="Who should receive this?"
              onCommit={(value) =>
                onFieldChange({
                  audience: {
                    ...audience,
                    description: value,
                    delivery: audience?.delivery ?? "named_list",
                  },
                })
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
                    ...audience,
                    description: audience?.description ?? "",
                    quantity: value ? Number(value) : undefined,
                    delivery: audience?.delivery ?? "named_list",
                  },
                })
              }
            />
          </>
        )}
      </CardContent>
      {!readOnly && !hideConfirm && (
        <CardFooter className="justify-end">
          <Button onClick={onConfirm} disabled={isConfirming || Boolean(eddmIssue)}>
            {isConfirming ? "Confirming…" : "Confirm audience"}
          </Button>
        </CardFooter>
      )}
    </Card>
  )
}

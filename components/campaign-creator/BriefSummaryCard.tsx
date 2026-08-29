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
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"
import { Textarea } from "@/components/ui/textarea"
import type { CampaignBrief, CampaignStatus } from "@/lib/campaign-creator/types"

interface BriefSummaryCardProps {
  brief: CampaignBrief
  status: CampaignStatus
  onFieldChange: (patch: Partial<CampaignBrief>) => void
  onConfirm: () => void
  isConfirming?: boolean
}

function assetsToText(assets: CampaignBrief["brandAssets"]) {
  return (assets ?? []).map((asset) => asset.description).join("\n")
}

function textToAssets(text: string): CampaignBrief["brandAssets"] {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((description) => ({
      id: crypto.randomUUID(),
      type: "other" as const,
      description,
    }))
}

export interface FieldProps {
  label: string
  value: string
  onCommit: (value: string) => void
  readOnly: boolean
  multiline?: boolean
  placeholder?: string
  type?: string
}

export function Field({ label, value, onCommit, readOnly, multiline, placeholder, type }: FieldProps) {
  const [draft, setDraft] = useState(value)

  if (readOnly) {
    if (!value) return null
    return (
      <div className="flex flex-col gap-0.5">
        <span className="text-xs text-muted-foreground">{label}</span>
        <span className="text-sm whitespace-pre-wrap">{value}</span>
      </div>
    )
  }

  const commit = () => {
    if (draft !== value) onCommit(draft)
  }

  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs text-muted-foreground">{label}</label>
      {multiline ? (
        <Textarea
          value={draft}
          placeholder={placeholder}
          onChange={(event) => setDraft(event.target.value)}
          onBlur={commit}
        />
      ) : (
        <Input
          type={type}
          value={draft}
          placeholder={placeholder}
          onChange={(event) => setDraft(event.target.value)}
          onBlur={commit}
        />
      )}
    </div>
  )
}

export function BriefSummaryCard({
  brief,
  status,
  onFieldChange,
  onConfirm,
  isConfirming,
}: BriefSummaryCardProps) {
  const readOnly = status !== "draft"

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-2">
          <CardTitle>Here&apos;s what I&apos;ve got</CardTitle>
          {readOnly && <Badge variant="secondary">Confirmed</Badge>}
        </div>
        <CardDescription>
          {readOnly
            ? "This strategy is confirmed and will carry forward into creative development."
            : "Review and correct anything below, then confirm when it looks right."}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        <div className="flex flex-col gap-3">
          <Field
            key={`goal:${brief.goal ?? ""}`}
            label="Goal"
            value={brief.goal ?? ""}
            readOnly={readOnly}
            multiline
            placeholder="What are you trying to accomplish?"
            onCommit={(value) => onFieldChange({ goal: value })}
          />
          <Field
            key={`desiredRecipientAction:${brief.desiredRecipientAction ?? ""}`}
            label="Desired recipient action"
            value={brief.desiredRecipientAction ?? ""}
            readOnly={readOnly}
            placeholder="What should the recipient do?"
            onCommit={(value) => onFieldChange({ desiredRecipientAction: value })}
          />
          <Field
            key={`primarySuccessMetric:${brief.primarySuccessMetric?.description ?? ""}`}
            label="What does success look like?"
            value={brief.primarySuccessMetric?.description ?? ""}
            readOnly={readOnly}
            placeholder="e.g. Phone calls, QR scans, appointments booked"
            onCommit={(value) =>
              onFieldChange({
                primarySuccessMetric: {
                  type: brief.primarySuccessMetric?.type ?? "other",
                  description: value,
                },
              })
            }
          />
          <Field
            key={`supportingMetrics:${(brief.supportingMetrics ?? []).join(", ")}`}
            label="Supporting metrics"
            value={(brief.supportingMetrics ?? []).join(", ")}
            readOnly={readOnly}
            placeholder="Comma-separated, if any"
            onCommit={(value) =>
              onFieldChange({
                supportingMetrics: value
                  .split(",")
                  .map((item) => item.trim())
                  .filter(Boolean),
              })
            }
          />
          <Field
            key={`emotionalTone:${brief.emotionalTone ?? ""}`}
            label="Desired emotional response"
            value={brief.emotionalTone ?? ""}
            readOnly={readOnly}
            placeholder="How should this feel to the recipient?"
            onCommit={(value) => onFieldChange({ emotionalTone: value })}
          />
          <Field
            key={`offer:${brief.offer ?? ""}`}
            label="Offer"
            value={brief.offer ?? ""}
            readOnly={readOnly}
            placeholder="Any promotion or offer, if applicable"
            onCommit={(value) => onFieldChange({ offer: value })}
          />
        </div>

        <Separator />

        <div className="flex flex-col gap-3">
          <Field
            key={`audienceDescription:${brief.audience?.description ?? ""}`}
            label="Target audience"
            value={brief.audience?.description ?? ""}
            readOnly={readOnly}
            multiline
            placeholder="Who should receive this?"
            onCommit={(value) =>
              onFieldChange({
                audience: { ...brief.audience, description: value },
              })
            }
          />
          <Field
            key={`audienceQuantity:${brief.audience?.quantity ?? ""}`}
            label="Quantity"
            value={brief.audience?.quantity ? String(brief.audience.quantity) : ""}
            readOnly={readOnly}
            type="number"
            placeholder="How many pieces?"
            onCommit={(value) =>
              onFieldChange({
                audience: {
                  description: brief.audience?.description ?? "",
                  quantity: value ? Number(value) : undefined,
                },
              })
            }
          />
        </div>

        <Separator />

        <div className="flex flex-col gap-3">
          <Field
            key={`businessName:${brief.businessInfo?.name ?? ""}`}
            label="Business name"
            value={brief.businessInfo?.name ?? ""}
            readOnly={readOnly}
            onCommit={(value) =>
              onFieldChange({ businessInfo: { ...brief.businessInfo, name: value } })
            }
          />
          <Field
            key={`businessWebsite:${brief.businessInfo?.website ?? ""}`}
            label="Business website"
            value={brief.businessInfo?.website ?? ""}
            readOnly={readOnly}
            onCommit={(value) =>
              onFieldChange({ businessInfo: { ...brief.businessInfo, website: value } })
            }
          />
          <Field
            key={`businessPhone:${brief.businessInfo?.phone ?? ""}`}
            label="Business phone"
            value={brief.businessInfo?.phone ?? ""}
            readOnly={readOnly}
            onCommit={(value) =>
              onFieldChange({ businessInfo: { ...brief.businessInfo, phone: value } })
            }
          />
          <Field
            key={`businessAddress:${brief.businessInfo?.address ?? ""}`}
            label="Business address"
            value={brief.businessInfo?.address ?? ""}
            readOnly={readOnly}
            onCommit={(value) =>
              onFieldChange({ businessInfo: { ...brief.businessInfo, address: value } })
            }
          />
        </div>

        <Separator />

        <div className="flex flex-col gap-3">
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
          <Field
            key={`brandAssets:${assetsToText(brief.brandAssets)}`}
            label="Brand assets"
            value={assetsToText(brief.brandAssets)}
            readOnly={readOnly}
            multiline
            placeholder="One per line — logo, photos, coupon, etc."
            onCommit={(value) => onFieldChange({ brandAssets: textToAssets(value) })}
          />
          <Field
            key={`otherRequirements:${brief.otherRequirements ?? ""}`}
            label="Other requirements"
            value={brief.otherRequirements ?? ""}
            readOnly={readOnly}
            multiline
            onCommit={(value) => onFieldChange({ otherRequirements: value })}
          />
        </div>
      </CardContent>
      {!readOnly && (
        <CardFooter className="justify-end">
          <Button onClick={onConfirm} disabled={isConfirming}>
            {isConfirming ? "Confirming…" : "Confirm strategy"}
          </Button>
        </CardFooter>
      )}
    </Card>
  )
}

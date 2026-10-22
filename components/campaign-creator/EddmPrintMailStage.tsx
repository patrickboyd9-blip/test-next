"use client"

import { useEffect, useState } from "react"

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
import { submitEddmPrintTest, refreshPrintMailStatus } from "@/lib/click2mail/mail-order-actions"
import { isTerminalJobStatus, jobStatusLabel } from "@/lib/click2mail/job-status"
import type { PrintMailMode } from "@/lib/click2mail/mode"
import { eddmDisplayName } from "@/lib/eddm/geometry"
import { eddmPostageEstimate } from "@/lib/eddm/postage"
import { summarizeSelection } from "@/lib/eddm/routes"
import type { Campaign } from "@/lib/campaign-creator/types"

interface EddmPrintMailStageProps {
  campaign: Campaign
  mode: PrintMailMode
  onCampaign: (campaign: Campaign) => void
}

export function EddmPrintMailStage({ campaign, mode, onCampaign }: EddmPrintMailStageProps) {
  const eddm = campaign.brief.audience?.eddm
  const [issues, setIssues] = useState<string[]>([])
  const [busy, setBusy] = useState(false)
  const order = campaign.mailOrder
  const summary = eddm ? summarizeSelection(eddm.routes, eddm.coverage) : null
  const postage = eddmPostageEstimate(summary?.pieces ?? 0)
  const blocked = summary ? summary.messages.length > 0 : true
  const canSend = mode.eddmSubmitEnabled && !blocked && !busy && mode.environment === "stage"

  useEffect(() => {
    if (!mode.credentialsConfigured || !order?.jobId || isTerminalJobStatus(order.jobStatus)) return
    let cancelled = false
    const tick = () => {
      void refreshPrintMailStatus(campaign.id).then((result) => {
        if (cancelled) return
        onCampaign(result.campaign)
        if (result.issues.length > 0) setIssues(result.issues)
      })
    }
    tick()
    const timer = window.setInterval(tick, 15_000)
    return () => {
      cancelled = true
      window.clearInterval(timer)
    }
  }, [campaign.id, mode.credentialsConfigured, order?.jobId, order?.jobStatus, onCampaign])

  async function handleSubmit() {
    setBusy(true)
    setIssues([])
    try {
      const result = await submitEddmPrintTest(campaign.id)
      onCampaign(result.campaign)
      setIssues(result.issues)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center gap-2">
          <CardTitle>Print & mail</CardTitle>
          <Badge variant="secondary">Test mode</Badge>
          <Badge variant="outline">Every Door</Badge>
        </div>
        <CardDescription>
          This prepares an Every Door order on Click2Mail staging. It does not mail real customers, and it does not show a checkout price.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="grid gap-3 sm:grid-cols-4">
          <Stat label="Card" value={eddm ? eddmDisplayName(eddm.size) : "—"} />
          <Stat label="Routes" value={summary ? String(summary.routeCount) : "0"} />
          <Stat label="Pieces" value={summary ? summary.pieces.toLocaleString("en-US") : "0"} />
          <Stat label={postage.label} value={postage.amountLabel} />
        </div>
        <p className="text-sm text-muted-foreground">{postage.detail}</p>
        <p className="text-sm text-muted-foreground">
          Residential {summary?.residential.toLocaleString("en-US") ?? "0"} · Business {summary?.business.toLocaleString("en-US") ?? "0"}. The address line is Postal Customer.
        </p>
        {summary?.messages.map((message) => (
          <p key={message} className="rounded-lg border p-3 text-sm" role="status">
            {message}
          </p>
        ))}
        {!mode.eddmSubmitEnabled && (
          <p className="rounded-lg border bg-muted/40 p-3 text-sm" role="status">
            {mode.environment !== "stage"
              ? "Every Door orders stay on Click2Mail staging. Production is not turned on."
              : mode.eddmAccountConfigured
                ? "Staging submit is off until Click2Mail confirms the product names for these sizes. Set C2M_EDDM_SUBMIT=true on staging after that."
                : "Add the USPS account id in C2M_EDDM_CRID. The live order also stays off until Click2Mail confirms which id belongs in the crid field."}
          </p>
        )}
        {order?.jobId && (
          <div className="rounded-lg border bg-muted/40 p-3 text-sm">
            <p className="font-medium">{jobStatusLabel(order.jobStatus)}</p>
            <p className="mt-1 text-muted-foreground">
              Job {order.jobId}
              {order.submitted ? " · submitted on staging" : " · not submitted"}
            </p>
            {order.error && <p className="mt-2 text-destructive">{order.error}</p>}
          </div>
        )}
        {issues.length > 0 && (
          <ul className="text-sm text-destructive">
            {issues.map((issue) => (
              <li key={issue}>{issue}</li>
            ))}
          </ul>
        )}
      </CardContent>
      <CardFooter className="justify-end">
        <Button type="button" onClick={() => void handleSubmit()} disabled={!canSend}>
          {busy ? "Sending…" : "Send staging Every Door test"}
        </Button>
      </CardFooter>
    </Card>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="text-lg font-medium">{value}</p>
    </div>
  )
}

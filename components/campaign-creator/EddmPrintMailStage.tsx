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
import { submitEddmPrintTest, refreshPrintMailStatus, saveUspsCrid, rememberedUspsCrid } from "@/lib/click2mail/mail-order-actions"
import { isTerminalJobStatus, jobStatusLabel } from "@/lib/click2mail/job-status"
import type { PrintMailMode } from "@/lib/click2mail/mode"
import { eddmPaymentBlockedMessage } from "@/lib/fulfillment/payment-clearance"
import { eddmDisplayName, isEddmSize } from "@/lib/eddm/geometry"
import { eddmCridHelp, eddmCridMissingMessage, normalizeUspsCrid, USPS_CRID_URL } from "@/lib/eddm/usps-crid"

import { EddmAddressBlockPreview } from "./EddmAddressBlockPreview"
import { eddmPostageEstimate } from "@/lib/eddm/postage"
import { summarizeSelection } from "@/lib/eddm/routes"
import { Input } from "@/components/ui/input"
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
  const [crid, setCrid] = useState(campaign.brief.businessInfo?.uspsCrid ?? "")
  const order = campaign.mailOrder
  const summary = eddm ? summarizeSelection(eddm.routes, eddm.coverage) : null
  const postage = eddmPostageEstimate(summary?.pieces ?? 0)
  const blocked = summary ? summary.messages.length > 0 : true
  const cridOk = normalizeUspsCrid(crid) !== null
  const canSend =
    mode.eddmSubmitEnabled &&
    mode.eddmPaymentCleared &&
    !blocked &&
    !busy &&
    cridOk &&
    mode.environment === "stage"

  useEffect(() => {
    if (campaign.brief.businessInfo?.uspsCrid?.trim()) return
    let cancelled = false
    void rememberedUspsCrid().then((saved) => {
      if (cancelled || !saved) return
      setCrid((current) => current.trim() ? current : saved)
    })
    return () => {
      cancelled = true
    }
  }, [campaign.brief.businessInfo?.uspsCrid])

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
      const saved = await saveUspsCrid(campaign.id, crid)
      onCampaign(saved.campaign)
      if (saved.issues.length > 0) {
        setIssues(saved.issues)
        return
      }
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
          Click2Mail prints and mails this with their Every Door permit. You pay first. Then the order goes to Click2Mail staging. This screen does not show a checkout price.
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
          Residential {summary?.residential.toLocaleString("en-US") ?? "0"} · Business {summary?.business.toLocaleString("en-US") ?? "0"}.
        </p>
        {eddm && isEddmSize(eddm.size) ? <EddmAddressBlockPreview size={eddm.size} /> : null}
        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium" htmlFor="usps-crid">
            Postal Service business ID (CRID)
          </label>
          <Input
            id="usps-crid"
            inputMode="numeric"
            autoComplete="off"
            value={crid}
            onChange={(event) => setCrid(event.target.value)}
            onBlur={() => {
              if (!normalizeUspsCrid(crid)) return
              void saveUspsCrid(campaign.id, crid).then((saved) => {
                if (saved.issues.length === 0) onCampaign(saved.campaign)
              })
            }}
            placeholder="Numbers only"
          />
          <p className="text-sm text-muted-foreground">
            {eddmCridHelp()}{" "}
            <a className="underline" href={USPS_CRID_URL} target="_blank" rel="noreferrer">
              Get a free CRID from the Postal Service
            </a>
            .
          </p>
        </div>
        {!cridOk && (
          <p className="rounded-lg border p-3 text-sm" role="status">
            {crid.trim() ? "That does not look like a CRID. Use the number from your Postal Service business account." : eddmCridMissingMessage()}
          </p>
        )}
        {summary?.messages.map((message) => (
          <p key={message} className="rounded-lg border p-3 text-sm" role="status">
            {message}
          </p>
        ))}
        {!mode.eddmPaymentCleared && (
          <p className="rounded-lg border bg-muted/40 p-3 text-sm" role="status">
            {eddmPaymentBlockedMessage()}
          </p>
        )}
        {mode.environment !== "stage" && (
          <p className="rounded-lg border bg-muted/40 p-3 text-sm" role="status">
            Every Door orders stay on Click2Mail staging. Production is not turned on.
          </p>
        )}
        {mode.environment === "stage" && !mode.eddmSubmitEnabled && (
          <p className="rounded-lg border bg-muted/40 p-3 text-sm" role="status">
            {mode.credentialsConfigured
              ? "Staging send is off until C2M_EDDM_SUBMIT=true. A job template created in the Click2Mail staging site is the preferred way to name the product."
              : "Click2Mail staging sign-in is not set. Add C2M_STAGE_USERNAME and C2M_STAGE_PASSWORD on the server."}
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

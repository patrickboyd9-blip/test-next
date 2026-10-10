"use client"

import { useEffect, useMemo, useState } from "react"

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
import { Textarea } from "@/components/ui/textarea"
import {
  continuePrintMailTest,
  refreshPrintMailStatus,
  submitPrintMailTest,
} from "@/lib/click2mail/mail-order-actions"
import { placeholderCostLabel } from "@/lib/click2mail/cost"
import { isTerminalJobStatus, jobStatusLabel } from "@/lib/click2mail/job-status"
import type { PrintMailMode } from "@/lib/click2mail/mode"
import { parseRecipientCsv, normalizeRecipient } from "@/lib/click2mail/recipients"
import type { Campaign } from "@/lib/campaign-creator/types"

interface PrintMailTestStageProps {
  campaign: Campaign
  mode: PrintMailMode
  onCampaign: (campaign: Campaign) => void
}

const EMPTY_SELF = {
  first: "",
  last: "",
  address1: "",
  address2: "",
  city: "",
  state: "",
  zip: "",
}

export function PrintMailTestStage({ campaign, mode, onCampaign }: PrintMailTestStageProps) {
  const [source, setSource] = useState<"self" | "csv">("self")
  const [selfAddress, setSelfAddress] = useState(EMPTY_SELF)
  const [csvText, setCsvText] = useState("")
  const [issues, setIssues] = useState<string[]>([])
  const [busy, setBusy] = useState(false)

  const recipients = useMemo(() => {
    if (source === "csv") return parseRecipientCsv(csvText).recipients
    const parsed = normalizeRecipient(selfAddress, 1)
    return parsed.recipient ? [parsed.recipient] : []
  }, [source, csvText, selfAddress])

  const order = campaign.mailOrder
  const pieceCount = recipients.length
  const productionLocked = mode.environment === "prod" && !mode.productionEnabled
  const canSend = mode.credentialsConfigured && !productionLocked && pieceCount > 0 && !busy
  const testMode = !mode.productionEnabled

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
      const result =
        source === "csv"
          ? await submitPrintMailTest(campaign.id, { kind: "csv", csvText })
          : await submitPrintMailTest(campaign.id, { kind: "self", ...selfAddress })
      onCampaign(result.campaign)
      setIssues(result.issues)
    } finally {
      setBusy(false)
    }
  }

  async function handleContinue() {
    setBusy(true)
    setIssues([])
    try {
      const result = await continuePrintMailTest(campaign.id)
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
          <Badge variant={testMode ? "secondary" : "destructive"}>
            {testMode ? "Test mode" : "Production"}
          </Badge>
        </div>
        <CardDescription>
          {testMode
            ? "This sends the approved postcard to Click2Mail staging. It does not mail real customers, and production stays off."
            : "Production is on. This can print real pieces and spend real credit."}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {productionLocked && (
          <p className="text-sm text-muted-foreground">
            This server is pointed at production, and live mailing is locked. Nothing is sent until
            C2M_ALLOW_PRODUCTION is turned on.
          </p>
        )}
        {!mode.credentialsConfigured && (
          <p className="text-sm text-muted-foreground">
            Staging credentials are not on this server yet. Add C2M_USERNAME and C2M_PASSWORD, then
            try again.
          </p>
        )}

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <p className="text-sm text-muted-foreground">Piece count</p>
            <p className="text-lg font-medium">{pieceCount}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Estimated cost</p>
            <p className="text-lg font-medium">
              {pieceCount > 0 ? placeholderCostLabel(pieceCount) : "Add addresses to see a placeholder"}
            </p>
          </div>
        </div>

        <div className="flex gap-2">
          <Button
            type="button"
            variant={source === "self" ? "default" : "outline"}
            onClick={() => setSource("self")}
          >
            Send a test to myself
          </Button>
          <Button
            type="button"
            variant={source === "csv" ? "default" : "outline"}
            onClick={() => setSource("csv")}
          >
            Upload a CSV
          </Button>
        </div>

        {source === "self" ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="First name" value={selfAddress.first} onChange={(first) => setSelfAddress({ ...selfAddress, first })} />
            <Field label="Last name" value={selfAddress.last} onChange={(last) => setSelfAddress({ ...selfAddress, last })} />
            <Field label="Address" value={selfAddress.address1} onChange={(address1) => setSelfAddress({ ...selfAddress, address1 })} />
            <Field label="Address line 2" value={selfAddress.address2} onChange={(address2) => setSelfAddress({ ...selfAddress, address2 })} />
            <Field label="City" value={selfAddress.city} onChange={(city) => setSelfAddress({ ...selfAddress, city })} />
            <Field label="State" value={selfAddress.state} onChange={(state) => setSelfAddress({ ...selfAddress, state })} />
            <Field label="ZIP" value={selfAddress.zip} onChange={(zip) => setSelfAddress({ ...selfAddress, zip })} />
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium" htmlFor="recipient-csv">
              CSV file
            </label>
            <Input
              id="recipient-csv"
              type="file"
              accept=".csv,text/csv"
              onChange={(event) => {
                const file = event.currentTarget.files?.[0]
                if (!file) return
                void file.text().then(setCsvText)
              }}
            />
            <p className="text-xs text-muted-foreground">
              Columns: first, last, address1, address2, city, state, zip
            </p>
            <Textarea
              value={csvText}
              onChange={(event) => setCsvText(event.target.value)}
              rows={5}
              placeholder={"first,last,address1,address2,city,state,zip"}
            />
          </div>
        )}

        {order && <OrderStatus order={order} />}

        {issues.length > 0 && (
          <ul className="text-sm text-destructive">
            {issues.map((issue) => (
              <li key={issue}>{issue}</li>
            ))}
          </ul>
        )}
      </CardContent>
      <CardFooter className="justify-end gap-2">
        {order && !order.jobId && (order.documentId || order.addressListId) && (
          <Button type="button" variant="outline" onClick={() => void handleContinue()} disabled={busy || productionLocked}>
            {busy ? "Checking…" : testMode ? "Continue staging test" : "Continue mailing"}
          </Button>
        )}
        <Button type="button" onClick={() => void handleSubmit()} disabled={!canSend}>
          {busy ? "Sending…" : testMode ? "Send staging test" : "Send production mailing"}
        </Button>
      </CardFooter>
    </Card>
  )
}

function Field({
  label,
  value,
  onChange,
}: {
  label: string
  value: string
  onChange: (value: string) => void
}) {
  const id = `print-mail-${label.toLowerCase().replace(/\s+/g, "-")}`
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-sm font-medium" htmlFor={id}>
        {label}
      </label>
      <Input id={id} value={value} onChange={(event) => onChange(event.target.value)} />
    </div>
  )
}

function OrderStatus({ order }: { order: NonNullable<Campaign["mailOrder"]> }) {
  return (
    <div className="rounded-lg border bg-muted/40 p-3 text-sm">
      <p className="font-medium">{jobStatusLabel(order.jobStatus)}</p>
      <p className="mt-1 text-muted-foreground">
        {order.submitted
          ? "Submitted with user credit."
          : "Not submitted yet. A staging job in editing has not been paid."}
      </p>
      <dl className="mt-3 grid gap-1 text-muted-foreground sm:grid-cols-2">
        <Detail label="Pieces" value={String(order.pieceCount)} />
        <Detail label="Cost note" value={order.estimatedCostLabel} />
        <Detail label="Artwork" value={order.artwork === "final-photo" ? "Final photograph" : "Words on a solid ground"} />
        <Detail label="Document" value={order.documentId} />
        <Detail label="Address list" value={order.addressListId} />
        <Detail label="List status" value={order.addressListStatus !== undefined ? String(order.addressListStatus) : undefined} />
        <Detail label="Job" value={order.jobId} />
        <Detail label="Click2Mail status" value={vendorJobLine(order)} />
        <Detail label="Proof" value={order.proofId} />
        <Detail label="Tracking pieces" value={order.trackingPieceCount !== undefined ? String(order.trackingPieceCount) : undefined} />
        <Detail label="Updated" value={formatWhen(order.updatedAt)} />
      </dl>
      {order.error && <p className="mt-3 text-destructive">{order.error}</p>}
    </div>
  )
}

function vendorJobLine(order: NonNullable<Campaign["mailOrder"]>): string | undefined {
  const code = order.resultCode !== undefined ? String(order.resultCode) : ""
  const description = order.resultDescription?.trim() ?? ""
  if (code && description) return `${code} · ${description}`
  return description || code || undefined
}

function Detail({ label, value }: { label: string; value?: string }) {
  if (!value) return null
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide">{label}</dt>
      <dd className="text-foreground">{value}</dd>
    </div>
  )
}

function formatWhen(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString()
}

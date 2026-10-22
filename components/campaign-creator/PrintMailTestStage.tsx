"use client"

import Link from "next/link"
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
import { recordComplianceAcceptance, startMailCheckout } from "@/lib/checkout/actions"
import { COMPLIANCE_CHECKOUT_HOOK } from "@/lib/checkout/compliance-gate"
import type { CheckoutAvailability } from "@/lib/checkout/stripe-config"
import {
  continuePrintMailTest,
  refreshPrintMailStatus,
} from "@/lib/click2mail/mail-order-actions"
import { mailingCutoffWarning } from "@/lib/click2mail/cutoff"
import { isTerminalJobStatus, jobStatusLabel } from "@/lib/click2mail/job-status"
import type { PrintMailMode } from "@/lib/click2mail/mode"
import { parseRecipientCsv, normalizeRecipient } from "@/lib/click2mail/recipients"
import { priceForCount } from "@/lib/pricing/quote"
import type { CustomerRate } from "@/lib/pricing/types"
import type { Campaign } from "@/lib/campaign-creator/types"

interface PrintMailTestStageProps {
  campaign: Campaign
  mode: PrintMailMode
  onCampaign: (campaign: Campaign) => void
  rate: CustomerRate
  showPricingBanner: boolean
  checkout: CheckoutAvailability
  checkoutNotice?: string | null
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

export function PrintMailTestStage({
  campaign,
  mode,
  onCampaign,
  rate,
  showPricingBanner,
  checkout,
  checkoutNotice,
}: PrintMailTestStageProps) {
  const [source, setSource] = useState<"self" | "csv">("self")
  const [selfAddress, setSelfAddress] = useState(EMPTY_SELF)
  const [csvText, setCsvText] = useState("")
  const [issues, setIssues] = useState<string[]>([])
  const [busy, setBusy] = useState(false)
  const [now, setNow] = useState(() => new Date())

  const recipients = useMemo(() => {
    if (source === "csv") return parseRecipientCsv(csvText).recipients
    const parsed = normalizeRecipient(selfAddress, 1)
    return parsed.recipient ? [parsed.recipient] : []
  }, [source, csvText, selfAddress])

  const order = campaign.mailOrder
  const pieceCount = recipients.length
  const pricedCount = order && !order.submitted && order.jobId ? order.pieceCount : pieceCount
  const price = priceForCount(rate, pricedCount)
  const productionLocked = mode.environment === "prod" && !mode.productionEnabled
  const termsAccepted = Boolean(campaign.complianceAcceptance?.acceptedAt)
  const alreadyPaid = campaign.payment?.status === "paid" && campaign.payment.orderId === order?.id
  const canPay =
    checkout.enabled &&
    termsAccepted &&
    mode.credentialsConfigured &&
    !productionLocked &&
    pricedCount > 0 &&
    price.totalCents >= 50 &&
    !alreadyPaid &&
    !busy
  const testMode = !mode.productionEnabled
  const cutoffWarning = order?.submitted ? null : mailingCutoffWarning(now)

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 60_000)
    return () => window.clearInterval(timer)
  }, [])

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

  async function handleAcceptTerms() {
    setBusy(true)
    setIssues([])
    try {
      const result = await recordComplianceAcceptance(campaign.id)
      onCampaign(result.campaign)
      setIssues(result.issues)
    } finally {
      setBusy(false)
    }
  }

  async function handlePay() {
    setBusy(true)
    setIssues([])
    try {
      const result =
        source === "csv"
          ? await startMailCheckout(campaign.id, { kind: "csv", csvText })
          : await startMailCheckout(campaign.id, { kind: "self", ...selfAddress })
      onCampaign(result.campaign)
      setIssues(result.issues)
      if (result.checkoutUrl) window.location.assign(result.checkoutUrl)
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
            ? "Review the price, accept the mailing terms, then pay. The piece is sent to the printer only after the card payment succeeds."
            : "Production is on. Payment still has to succeed before anything is mailed."}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {showPricingBanner && (
          <div className="rounded-lg border-2 border-foreground bg-muted px-4 py-3" role="status">
            <p className="font-medium">Pricing not final</p>
            <p className="mt-1 text-sm text-muted-foreground">
              These amounts are placeholders. They can change before anyone is charged on the live site.
            </p>
          </div>
        )}

        {productionLocked && (
          <p className="text-sm text-muted-foreground">
            This server is pointed at production, and live mailing is locked. Nothing is sent until
            that lock is turned off.
          </p>
        )}
        {!mode.credentialsConfigured && (
          <p className="text-sm text-muted-foreground">
            The printer is not connected on this server yet. You can review the price. Nothing is sent.
          </p>
        )}
        {!checkout.enabled && checkout.message && (
          <p className="text-sm text-muted-foreground">{checkout.message}</p>
        )}
        {checkoutNotice && (
          <p className="text-sm" role="status">
            {checkoutNotice}
          </p>
        )}

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <p className="text-sm text-muted-foreground">Price per card</p>
            <p className="text-lg font-medium">{price.perCardLabel}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">
              {pricedCount === 1 ? "Total for 1 card" : `Total for ${pricedCount} cards`}
            </p>
            <p className="text-lg font-medium">{price.totalLabel}</p>
            {pricedCount === 0 && (
              <p className="text-sm text-muted-foreground">Add addresses to see the total.</p>
            )}
          </div>
        </div>

        {cutoffWarning && (
          <p className="rounded-lg border bg-muted/40 p-3 text-sm" role="status">
            {cutoffWarning}
          </p>
        )}

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

        <ComplianceCheckoutHook accepted={termsAccepted} busy={busy} onAccept={() => void handleAcceptTerms()} />

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
            {busy ? "Checking…" : "Check the addresses again"}
          </Button>
        )}
        {alreadyPaid ? (
          <Button type="button" variant="outline" render={<Link href="/app/orders" />}>
            View order
          </Button>
        ) : (
          <Button type="button" onClick={() => void handlePay()} disabled={!canPay}>
            {busy ? "Opening checkout…" : "Pay and send"}
          </Button>
        )}
      </CardFooter>
    </Card>
  )
}

/**
 * HOOK: compliance clickwrap.
 * The clickwrap change replaces the body of this section. It must stay above
 * payment, keep data-compliance-hook="before-payment", and call
 * recordComplianceAcceptance (or write campaign.complianceAcceptance) before
 * Pay and send can succeed. See lib/checkout/compliance-gate.ts.
 */
export function ComplianceCheckoutHook({
  accepted,
  busy,
  onAccept,
}: {
  accepted: boolean
  busy: boolean
  onAccept: () => void
}) {
  return (
    <section
      data-compliance-hook={COMPLIANCE_CHECKOUT_HOOK}
      aria-label="Mailing terms"
      className="rounded-lg border p-3"
    >
      <p className="text-sm font-medium">Mailing terms</p>
      {accepted ? (
        <p className="mt-1 text-sm text-muted-foreground">Mailing terms accepted.</p>
      ) : (
        <>
          <p className="mt-1 text-sm text-muted-foreground">
            The agreement to mail this piece sits here, before payment. Payment stays closed until it is accepted.
          </p>
          <Button type="button" className="mt-3" variant="outline" onClick={onAccept} disabled={busy}>
            Accept mailing terms
          </Button>
        </>
      )}
    </section>
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
          ? "Sent to the printer after payment."
          : "Not sent yet. Payment has to succeed before this is submitted."}
      </p>
      <dl className="mt-3 grid gap-1 text-muted-foreground sm:grid-cols-2">
        <Detail label="Pieces" value={String(order.pieceCount)} />
        <Detail label="Total" value={order.estimatedCostLabel} />
        <Detail label="Artwork" value={order.artwork === "final-photo" ? "Final photograph" : order.artwork === "uploaded-design" ? "Uploaded design" : "Words on a solid ground"} />
        <Detail label="Document" value={order.documentId} />
        <Detail label="Address list" value={order.addressListId} />
        <Detail label="List status" value={order.addressListStatus !== undefined ? String(order.addressListStatus) : undefined} />
        <Detail label="Job" value={order.jobId} />
        <Detail label="Printer status" value={vendorJobLine(order)} />
        <Detail label="Proof" value={order.proofId} />
        <Detail label="Tracking pieces" value={order.trackingPieceCount !== undefined ? String(order.trackingPieceCount) : undefined} />
        <Detail label="Updated" value={formatWhen(order.updatedAt)} />
      </dl>
      {order.cutoffNote && (
        <p className="mt-3 rounded-md border bg-background p-2 text-foreground" role="status">
          {order.cutoffNote}
        </p>
      )}
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

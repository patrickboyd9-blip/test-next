"use client"

import { useState } from "react"

import { saveScanChoice } from "@/lib/analytics/choice-action"

export function ScanChoice({
  choice,
  website,
  campaignId,
  readOnly = false,
  onChange,
}: {
  choice: "page" | "website"
  website: string
  campaignId?: string
  readOnly?: boolean
  onChange?: (choice: "page" | "website", website: string) => void
}) {
  const [picked, setPicked] = useState(choice)
  const [site, setSite] = useState(website)

  function pick(next: "page" | "website", url = site) {
    if (readOnly) return
    setPicked(next)
    setSite(url)
    onChange?.(next, url)
    if (campaignId) void saveScanChoice(campaignId, next, url)
  }

  return (
    <div className="flex flex-col gap-3" data-scan-choice>
      <input type="hidden" name="destination" value={picked === "website" ? "website" : "page"} />
      <button
        type="button"
        aria-pressed={picked === "page"}
        disabled={readOnly}
        onClick={() => pick("page")}
        className={cardClass(picked === "page")}
      >
        <span className="text-xs font-semibold uppercase tracking-wide text-[#0b6b4a]">Recommended</span>
        <span className="text-base font-medium">Send scans to a simple page we make for you</span>
        <span className="text-sm leading-6 text-muted-foreground">
          When someone scans your QR code, they see a page with your offer and a big button to call you. We can tell you how many people scanned, how many tapped to call you, and who filled out the form. Nothing to set up.
        </span>
      </button>
      <div className={cardClass(picked === "website")}>
        <button
          type="button"
          aria-pressed={picked === "website"}
          disabled={readOnly}
          onClick={() => pick("website")}
          className="flex flex-col items-start gap-2 text-left"
        >
          <span className="text-base font-medium">Send scans to my own website</span>
          <span className="text-sm leading-6 text-muted-foreground">
            When someone scans your QR code, they go straight to your website. We can still tell you how many people scanned, but we can&apos;t see what they do after that (like whether they called or filled out a form).
          </span>
        </button>
        <label className="mt-3 block text-sm">
          Your website
          <input
            name="website"
            value={site}
            disabled={readOnly}
            placeholder="https://yourbusiness.com"
            onChange={(event) => pick("website", event.target.value)}
            className="mt-1 min-h-11 w-full rounded-xl border bg-background px-3"
          />
        </label>
      </div>
      <details className="rounded-xl border px-3 py-2 text-sm">
        <summary className="min-h-11 cursor-pointer py-2 font-medium">What&apos;s the difference?</summary>
        <div className="grid gap-3 pb-2 sm:grid-cols-2">
          <Compare title="A page we make" scans callTaps formLeads />
          <Compare title="Your website" scans />
        </div>
      </details>
    </div>
  )
}

function Compare({
  title,
  scans,
  callTaps,
  formLeads,
}: {
  title: string
  scans?: boolean
  callTaps?: boolean
  formLeads?: boolean
}) {
  return (
    <div className="rounded-xl bg-muted/50 p-3">
      <p className="font-medium">{title}</p>
      <ul className="mt-2 space-y-1">
        <Mark on={Boolean(scans)} label="Scans counted" />
        <Mark on={Boolean(callTaps)} label="Call taps" />
        <Mark on={Boolean(formLeads)} label="Form leads" />
      </ul>
    </div>
  )
}

function Mark({ on, label }: { on: boolean; label: string }) {
  return (
    <li className="flex items-center gap-2">
      <span aria-hidden className="inline-flex size-5 items-center justify-center text-base">
        {on ? "✓" : "–"}
      </span>
      <span>{label}</span>
    </li>
  )
}

function cardClass(selected: boolean): string {
  return [
    "flex w-full flex-col items-start gap-2 rounded-2xl border p-4 text-left",
    selected ? "border-foreground ring-2 ring-foreground/30" : "border-border",
  ].join(" ")
}

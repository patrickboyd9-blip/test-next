"use client"

import { useState } from "react"

import { saveScanChoice } from "@/lib/analytics/choice-action"
import { pageOfferCopy } from "@/lib/analytics/page-copy"
import type { PageParts } from "@/lib/analytics/store"

const OFF: PageParts = { call: false, form: false, booking: false, bookingUrl: null }

export function ScanChoice({
  choice,
  website,
  campaignId,
  parts = OFF,
  phone = "",
  readOnly = false,
  embed = false,
  onChange,
}: {
  choice: "page" | "website"
  website: string
  campaignId?: string
  parts?: PageParts
  phone?: string
  readOnly?: boolean
  /** Omit field names when this choice sits inside another form. */
  embed?: boolean
  onChange?: (choice: "page" | "website", website: string, parts?: PageParts, phone?: string) => void
}) {
  const [picked, setPicked] = useState(choice)
  const [site, setSite] = useState(website)
  const [pageParts, setPageParts] = useState<PageParts>(parts)
  const [callNumber, setCallNumber] = useState(phone)

  function persist(next: "page" | "website", url: string, nextParts: PageParts, nextPhone: string) {
    if (readOnly) return
    setPicked(next)
    setSite(url)
    setPageParts(nextParts)
    setCallNumber(nextPhone)
    onChange?.(next, url, nextParts, nextPhone)
    if (campaignId) void saveScanChoice(campaignId, next, url, nextParts, nextPhone)
  }

  return (
    <div className="flex flex-col gap-3" data-scan-choice>
      <input type="hidden" name={embed ? undefined : "destination"} value={picked === "website" ? "website" : "page"} />
      <input type="hidden" name={embed ? undefined : "showCall"} value={pageParts.call ? "1" : ""} />
      <input type="hidden" name={embed ? undefined : "showForm"} value={pageParts.form ? "1" : ""} />
      <input type="hidden" name={embed ? undefined : "showBooking"} value={pageParts.booking ? "1" : ""} />
      <button
        type="button"
        aria-pressed={picked === "page"}
        disabled={readOnly}
        onClick={() => persist("page", site, pageParts, callNumber)}
        className={cardClass(picked === "page")}
      >
        <span className="text-xs font-semibold uppercase tracking-wide text-[#0b6b4a]">Recommended</span>
        <span className="text-base font-medium">Send scans to a simple page we make for you</span>
        <span className="text-sm leading-6 text-muted-foreground">{pageOfferCopy(pageParts)}</span>
      </button>
      {picked === "page" ? (
        <fieldset className="flex flex-col gap-3 rounded-2xl border p-4" disabled={readOnly}>
          <legend className="px-1 text-sm font-medium">What should the page include?</legend>
          <label className="flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              className="mt-1"
              checked={pageParts.call}
              onChange={(event) => persist("page", site, { ...pageParts, call: event.target.checked }, callNumber)}
            />
            <span>Tap to call button</span>
          </label>
          {pageParts.call ? (
            <label className="block text-sm">
              Your phone number
              <input
                name={embed ? undefined : "phone"}
                value={callNumber}
                placeholder="(619) 555-0148"
                onChange={(event) => persist("page", site, { ...pageParts, call: true }, event.target.value)}
                className="mt-1 min-h-11 w-full rounded-xl border bg-background px-3"
              />
            </label>
          ) : null}
          <label className="flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              className="mt-1"
              checked={pageParts.form}
              onChange={(event) => persist("page", site, { ...pageParts, form: event.target.checked }, callNumber)}
            />
            <span>Short form</span>
          </label>
          <label className="flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              className="mt-1"
              checked={pageParts.booking}
              onChange={(event) => persist("page", site, { ...pageParts, booking: event.target.checked }, callNumber)}
            />
            <span>Book a time button</span>
          </label>
          {pageParts.booking ? (
            <label className="block text-sm">
              Your booking link
              <input
                name={embed ? undefined : "bookingUrl"}
                value={pageParts.bookingUrl ?? ""}
                placeholder="https://calendly.com/your-name"
                onChange={(event) =>
                  persist("page", site, { ...pageParts, booking: true, bookingUrl: event.target.value }, callNumber)
                }
                className="mt-1 min-h-11 w-full rounded-xl border bg-background px-3"
              />
            </label>
          ) : null}
        </fieldset>
      ) : null}
      <div className={cardClass(picked === "website")}>
        <button
          type="button"
          aria-pressed={picked === "website"}
          disabled={readOnly}
          onClick={() => persist("website", site, pageParts, callNumber)}
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
            name={embed ? undefined : "website"}
            value={site}
            disabled={readOnly}
            placeholder="https://yourbusiness.com"
            onChange={(event) => persist("website", event.target.value, pageParts, callNumber)}
            className="mt-1 min-h-11 w-full rounded-xl border bg-background px-3"
          />
        </label>
      </div>
      <details className="rounded-xl border px-3 py-2 text-sm">
        <summary className="min-h-11 cursor-pointer py-2 font-medium">What&apos;s the difference?</summary>
        <div className="grid gap-3 pb-2 sm:grid-cols-2">
          <Compare title="A page we make" scans callTaps formLeads bookingTaps />
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
  bookingTaps,
}: {
  title: string
  scans?: boolean
  callTaps?: boolean
  formLeads?: boolean
  bookingTaps?: boolean
}) {
  return (
    <div className="rounded-xl bg-muted/50 p-3">
      <p className="font-medium">{title}</p>
      <ul className="mt-2 space-y-1">
        <Mark on={Boolean(scans)} label="Scans counted" />
        <Mark on={Boolean(callTaps)} label="Call taps" />
        <Mark on={Boolean(formLeads)} label="Form leads" />
        <Mark on={Boolean(bookingTaps)} label="Booking button taps" />
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

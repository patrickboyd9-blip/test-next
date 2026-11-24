"use client"

import { ScanChoice } from "@/components/analytics/ScanChoice"
import type { PageParts } from "@/lib/analytics/store"
import type { Click2MailSize } from "@/lib/print-spec/click2mail-keep-outs"
import {
  addQrCode,
  QR_MAX_INCHES,
  QR_MIN_INCHES,
  QR_RECOMMENDATION,
  QR_WEBSITE_MISSING,
  removeQrCode,
  resizeQr,
  normalizeScanUrl,
  scanDestinationLine,
  setQrChoice,
  setQrEnabled,
  setQrSide,
  type PlacedQr,
  type QrPageParts,
  type QrPlacementValue,
} from "@/lib/qr-placement/model"

/**
 * Shared controls for placing up to two QR codes.
 * Design it for me, Comet, upload, and team design all mount this panel.
 */
export function QrPlacementPanel({
  value,
  size,
  businessName,
  headline,
  offer,
  onChange,
}: {
  value: QrPlacementValue
  size: Click2MailSize
  businessName: string
  headline: string
  offer: string
  onChange: (value: QrPlacementValue) => void
}) {
  const website = value.codes[0]?.website ?? ""
  const phone = value.codes[0]?.phone ?? ""

  return (
    <section className="space-y-4" data-qr-placement>
      <p className="text-sm text-muted-foreground">{QR_RECOMMENDATION}</p>
      <label className="flex min-h-11 items-center gap-2 text-sm font-medium">
        <input
          type="checkbox"
          className="size-4"
          checked={value.enabled}
          onChange={(event) => onChange(setQrEnabled(value, event.target.checked, size, website, phone))}
        />
        Add a QR code
      </label>
      {value.blockedMessage ? (
        <p className="text-sm" role="status">
          {value.blockedMessage}
        </p>
      ) : null}
      {value.enabled
        ? value.codes.map((qr, index) => (
            <QrCard
              key={qr.id}
              index={index}
              qr={qr}
              size={size}
              businessName={businessName}
              headline={headline}
              offer={offer}
              value={value}
              onChange={onChange}
            />
          ))
        : null}
      {value.enabled && value.codes.length === 1 ? (
        <button
          type="button"
          className="min-h-11 rounded-xl border px-4 text-sm font-semibold"
          onClick={() => onChange(addQrCode(value, size, website, phone))}
        >
          Add a second QR code
        </button>
      ) : null}
    </section>
  )
}

function QrCard({
  index,
  qr,
  size,
  businessName,
  headline,
  offer,
  value,
  onChange,
}: {
  index: number
  qr: PlacedQr
  size: Click2MailSize
  businessName: string
  headline: string
  offer: string
  value: QrPlacementValue
  onChange: (value: QrPlacementValue) => void
}) {
  const where = scanDestinationLine(qr)
  const site = qr.destination === "website" ? normalizeScanUrl(qr.website) : null

  return (
    <div className="space-y-3 rounded-2xl border p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-medium">QR code {index + 1}</p>
        <button type="button" className="min-h-11 rounded-xl px-3 text-sm" onClick={() => onChange(removeQrCode(value, qr.id))}>
          Remove
        </button>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {(["front", "back"] as const).map((side) => (
          <button
            key={side}
            type="button"
            aria-pressed={qr.side === side}
            onClick={() => onChange(setQrSide(value, size, qr.id, side))}
            className={`min-h-11 rounded-xl border text-sm ${qr.side === side ? "border-foreground" : ""}`}
          >
            {side === "front" ? "Front" : "Back"}
          </button>
        ))}
      </div>
      <label className="block text-sm">
        Size
        <span className="mt-1 block font-normal text-muted-foreground">{qr.sizeInches.toFixed(2)} in</span>
        <input
          type="range"
          min={QR_MIN_INCHES}
          max={QR_MAX_INCHES}
          step={0.05}
          value={qr.sizeInches}
          aria-label={`Size of QR code ${index + 1}`}
          className="mt-2 min-h-11 w-full"
          onChange={(event) => onChange(resizeQr(value, size, qr.id, Number(event.target.value)))}
        />
      </label>
      <p className="text-sm leading-6">
        {site ? (
          <>
            When someone scans this code, they&apos;ll go to:{" "}
            <a href={site} className="underline" target="_blank" rel="noreferrer">
              {site}
            </a>
          </>
        ) : (
          where
        )}
      </p>
      {qr.destination === "website" && !site ? (
        <p className="text-sm" role="status">
          {QR_WEBSITE_MISSING}
        </p>
      ) : null}
      {qr.destination === "page" ? (
        <OfferPagePreview businessName={businessName} headline={headline} offer={offer} phone={qr.phone} parts={qr.parts} />
      ) : null}
      <ScanChoice
        embed
        choice={qr.destination}
        website={qr.website}
        parts={toPageParts(qr.parts)}
        phone={qr.phone}
        onChange={(choice, nextWebsite, parts, nextPhone) =>
          onChange(
            setQrChoice(
              value,
              qr.id,
              choice,
              nextWebsite,
              parts ? fromPageParts(parts) : qr.parts,
              nextPhone ?? qr.phone
            )
          )
        }
      />
    </div>
  )
}

function OfferPagePreview({
  businessName,
  headline,
  offer,
  phone,
  parts,
}: {
  businessName: string
  headline: string
  offer: string
  phone: string
  parts: QrPageParts
}) {
  return (
    <div className="max-w-sm rounded-xl border bg-white p-3" data-offer-preview>
      <p className="text-[10px] uppercase tracking-wide text-neutral-500">Offer</p>
      <p className="mt-1 text-sm font-semibold">{headline || businessName || "A note from the business"}</p>
      {offer ? <p className="mt-1 text-xs leading-5">{offer}</p> : null}
      {parts.call && phone ? (
        <p className="mt-2 rounded-lg bg-neutral-950 px-2 py-2 text-center text-xs font-semibold text-white">Tap to call {phone}</p>
      ) : null}
      {parts.booking ? <p className="mt-2 rounded-lg border px-2 py-2 text-center text-xs font-semibold">Book a time</p> : null}
      {parts.form ? <p className="mt-2 text-xs text-neutral-500">A short form for their name and a note.</p> : null}
      <p className="mt-2 text-xs text-neutral-500">This is the page they open from the code.</p>
    </div>
  )
}

function toPageParts(parts: QrPageParts): PageParts {
  return {
    call: parts.call,
    form: parts.form,
    booking: parts.booking,
    bookingUrl: parts.bookingUrl,
  }
}

function fromPageParts(parts: PageParts): QrPageParts {
  return {
    call: parts.call === true,
    form: parts.form === true,
    booking: parts.booking === true,
    bookingUrl: parts.bookingUrl,
  }
}

import Link from "next/link"

import type { AppliedBrand } from "@/lib/white-label/brand"
import type { CommandSnapshot } from "@/lib/command-center/snapshot"

import { Eyebrow, Panel } from "./ui"

export function CommandCenter({
  shop,
  brand,
  snapshot,
}: {
  shop: string
  brand: AppliedBrand
  snapshot: CommandSnapshot
}) {
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-8 sm:px-6 sm:py-12">
      <div className="space-y-3" data-flight-copy>
        <Eyebrow>Command Center</Eyebrow>
        <h1 className="max-w-xl text-3xl font-semibold tracking-tight sm:text-5xl">Today at a glance</h1>
        <p className="max-w-xl text-base text-[#b7c9d8]">
          {brand.appName}. {shop}. Counts below are pieces, scans, page taps, and charges that were recorded.
        </p>
        {snapshot.sample ? (
          <p className="rounded-xl border border-[#f0a202] bg-[#f0a202]/15 px-3 py-2 text-sm text-[#f6d48a]">
            Sample data. These figures are not your mail, and nothing here was sent or charged.
          </p>
        ) : null}
      </div>

      {snapshot.stages.length > 0 ? (
        <div className="grid gap-3 sm:grid-cols-3">
          {snapshot.stages.map((stage) => (
            <Stat key={stage.id} label={stage.label} value={String(stage.pieces)} detail="pieces" />
          ))}
        </div>
      ) : null}
      <p className="text-sm text-[#8aa0b4]">{snapshot.mailNote}</p>

      <div className="grid gap-3 sm:grid-cols-3">
        <Stat label="QR scans" value={String(snapshot.scansTotal)} detail="Scans appear after your mail lands." />
        <Stat label="Tap to call" value={String(snapshot.taps)} detail="Taps on the page button. Not phone calls." />
        <Stat label="Leads" value={String(snapshot.leads)} detail="Forms saved from the page." />
      </div>

      <Panel className="p-4 sm:p-5">
        <h2 className="text-lg font-medium">Scans by day</h2>
        {snapshot.scansByDay.length === 0 ? (
          <p className="mt-2 text-sm text-[#8aa0b4]">Scans appear after your mail lands.</p>
        ) : (
          <ul className="mt-3 space-y-1 text-sm">
            {snapshot.scansByDay.map((row) => (
              <li key={row.day} className="flex justify-between gap-3">
                <span>{row.day}</span>
                <span>{row.count}</span>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-3 text-sm text-[#8aa0b4]">
          {snapshot.scanRate
            ? `Scan rate ${snapshot.scanRate}, scans divided by pieces delivered.`
            : "Scan rate needs a delivered piece count. Postal tracking has not supplied one."}
        </p>
      </Panel>

      <Panel className="p-4 sm:p-5">
        <h2 className="text-lg font-medium">Mail with a printer status</h2>
        {snapshot.inProgress.length === 0 ? (
          <p className="mt-2 text-sm text-[#8aa0b4]">No campaign has a printer status yet.</p>
        ) : (
          <ul className="mt-3 divide-y divide-[#1c3d52]">
            {snapshot.inProgress.map((row) => (
              <li key={row.id}>
                <Link href={snapshot.sample ? "/app/campaigns" : `/app/campaigns/${row.id}`} className="flex min-h-14 items-center justify-between gap-3 py-2">
                  <span className="font-medium">{row.name}</span>
                  <span className="text-sm text-[#b7c9d8]">{row.status}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <Panel className="p-4 sm:p-5">
        <h2 className="text-lg font-medium">Comet</h2>
        <ul className="mt-2 space-y-2">
          {snapshot.suggestions.map((line) => (
            <li key={line} className="text-sm leading-6 text-[#d5e6f2]">{line}</li>
          ))}
        </ul>
      </Panel>

      <Panel className="p-4 sm:p-5">
        <h2 className="text-lg font-medium">Charges this month</h2>
        <p className="mt-2 text-2xl font-semibold">
          {snapshot.spendThisMonthCents == null ? "No charges" : dollars(snapshot.spendThisMonthCents)}
        </p>
      </Panel>
    </div>
  )
}

function Stat({ label, value, detail }: { label: string; value: string; detail?: string }) {
  return (
    <Panel className="p-4">
      <p className="text-sm text-[#8aa0b4]">{label}</p>
      <p className="mt-1 text-2xl font-semibold">{value}</p>
      {detail ? <p className="mt-1 text-xs leading-5 text-[#8aa0b4]">{detail}</p> : null}
    </Panel>
  )
}

function dollars(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`
}

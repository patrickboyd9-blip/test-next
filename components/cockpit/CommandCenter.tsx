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
          {brand.appName}. {shop}. Counts below come from recorded mail, scans, and charges.
        </p>
        {snapshot.sample ? (
          <p className="rounded-xl border border-[#f0a202] bg-[#f0a202]/15 px-3 py-2 text-sm text-[#f6d48a]">
            Sample data. These figures are not your mail, and nothing here was sent or charged.
          </p>
        ) : null}
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Stat label="Printing" value={String(snapshot.printing)} />
        <Stat label="Mailed" value={String(snapshot.mailed)} />
        <Stat label="Delivered" value={String(snapshot.delivered)} />
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Stat label="QR scans today" value={snapshot.scansToday == null ? "Not recorded" : String(snapshot.scansToday)} />
        <Stat label="Tracking calls today" value={snapshot.callsToday == null ? "Not recorded" : String(snapshot.callsToday)} />
        <Stat
          label="Spend this month"
          value={snapshot.spendThisMonthCents == null ? "No charges" : dollars(snapshot.spendThisMonthCents)}
        />
      </div>

      <Panel className="p-4 sm:p-5">
        <h2 className="text-lg font-medium">Mailer Campaigns in Progress</h2>
        {snapshot.inProgress.length === 0 ? (
          <p className="mt-2 text-sm text-[#8aa0b4]">No campaigns are in progress on this account.</p>
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
        <h2 className="text-lg font-medium">Comet suggestions</h2>
        <ul className="mt-2 space-y-2">
          {snapshot.suggestions.map((line) => (
            <li key={line} className="text-sm leading-6 text-[#d5e6f2]">{line}</li>
          ))}
        </ul>
      </Panel>

      <Panel className="p-4 sm:p-5">
        <h2 className="text-lg font-medium">Headline analytics</h2>
        <dl className="mt-3 grid gap-3 sm:grid-cols-3">
          {snapshot.analytics.map((row) => (
            <div key={row.label}>
              <dt className="text-sm text-[#8aa0b4]">{row.label}</dt>
              <dd className="text-lg">{row.value}</dd>
            </div>
          ))}
        </dl>
      </Panel>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <Panel className="p-4">
      <p className="text-sm text-[#8aa0b4]">{label}</p>
      <p className="mt-1 text-2xl font-semibold">{value}</p>
    </Panel>
  )
}

function dollars(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`
}

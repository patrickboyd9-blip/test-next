import Link from "next/link"

import { SAMPLE_MAILERS, STATUS_LABEL, statusNeedsYou } from "@/lib/mailer-compose/flow"

import { CockpitFrame, Eyebrow, Panel } from "./ui"

export function HomeBoard({ shop }: { shop: string }) {
  const waiting = SAMPLE_MAILERS.filter((item) => statusNeedsYou(item.status)).length
  return (
    <CockpitFrame>
      <div className="mx-auto flex max-w-3xl flex-col gap-8 px-4 py-8 sm:px-6 sm:py-12">
        <div className="space-y-5">
          <Eyebrow>How&apos;s my mail doing?</Eyebrow>
          <h1 className="max-w-xl text-3xl font-semibold tracking-tight sm:text-5xl">
            {waiting > 0 ? "One sample mailer is waiting on you." : "Nothing is waiting on you."}
          </h1>
          <p className="max-w-xl text-base text-[#b7c9d8]">
            {shop}. This list is a sample so you can see the shape of the page. It is not a report, and nothing here was mailed.
          </p>
          <Link
            href="/app/mail"
            className="inline-flex min-h-14 w-full items-center justify-center rounded-2xl bg-[#5ce1ff] px-6 text-lg font-semibold text-[#041018] sm:w-auto"
          >
            New mailer
          </Link>
        </div>

        <Panel className="p-4 sm:p-5">
          <div className="mb-3 flex items-baseline justify-between gap-3">
            <h2 className="text-lg font-medium">Mailers in progress</h2>
            <p className="text-sm text-[#8aa0b4]">Sample</p>
          </div>
          <ul className="divide-y divide-[#1c3d52]">
            {SAMPLE_MAILERS.map((mailer) => {
              const needs = statusNeedsYou(mailer.status)
              return (
                <li key={mailer.id}>
                  <Link
                    href={`/app/mail/${mailer.id}`}
                    className="flex min-h-16 flex-col gap-1 py-3 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <span>
                      <span className="block text-lg font-medium">{mailer.name}</span>
                      <span className="text-sm text-[#8aa0b4]">Sample · {mailer.listName}</span>
                    </span>
                    <span
                      className={
                        needs
                          ? "inline-flex min-h-10 items-center rounded-full bg-[#f0a202] px-3 text-sm font-semibold text-[#1a1203]"
                          : "inline-flex min-h-10 items-center rounded-full border border-[#245068] px-3 text-sm text-[#d5e6f2]"
                      }
                    >
                      {needs ? "Proof ready — approve" : STATUS_LABEL[mailer.status]}
                    </span>
                  </Link>
                </li>
              )
            })}
          </ul>
        </Panel>

        <p className="text-sm text-[#8aa0b4]">
          Sample only. No results, no response rate, and no live tracking.
          {waiting > 0 ? " One sample proof is ready for a look." : ""}
        </p>
      </div>
    </CockpitFrame>
  )
}

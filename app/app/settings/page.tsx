import Link from "next/link"

import { WhiteLabelForm } from "@/components/settings/WhiteLabelForm"
import { CockpitFrame, Eyebrow, Panel } from "@/components/cockpit/ui"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { getSession } from "@/lib/auth/session"
import { DOMAIN_COST_AS_OF, DOMAIN_COST_LINES } from "@/lib/white-label/domain-cost"
import { readWhiteLabel } from "@/lib/white-label/store"

export const dynamic = "force-dynamic"

export default async function SettingsPage() {
  const session = await getSession()
  const brand = session ? await readWhiteLabel(session.userId).catch(() => null) : null
  return (
    <CockpitFrame>
      <div className="mx-auto flex max-w-3xl flex-col gap-5 px-4 py-8 sm:px-6">
        <div className="flex items-center gap-3">
          <SidebarTrigger className="text-[#e7f2fb]" />
          <Eyebrow>Settings</Eyebrow>
        </div>
        <h1 className="text-3xl font-semibold">Settings</h1>
        <nav aria-label="Settings" className="flex flex-wrap gap-2">
          <span
            aria-current="page"
            className="inline-flex min-h-10 items-center rounded-full border border-[#7ee7ff] bg-[#102433] px-4 text-sm text-[#f7fbff]"
          >
            Account
          </span>
          <Link
            href="/app/settings/api"
            className="inline-flex min-h-10 items-center rounded-full border border-[#1c3d52] px-4 text-sm text-[#b7c9d8] hover:border-[#3d6d88] hover:text-[#f7fbff]"
          >
            API & AI assistants
          </Link>
        </nav>
        <Panel className="p-5">
          <h2 className="font-medium">Business profile</h2>
          {session ? (
            <p className="mt-2 text-sm text-[#b7c9d8]">
              {session.businessName || "No business name yet"}. {session.email}. This is the signed-in account.
            </p>
          ) : (
            <p className="mt-2 text-sm text-[#b7c9d8]">Sign in to see the business profile.</p>
          )}
        </Panel>
        <Panel className="p-5">
          <h2 className="font-medium">White label</h2>
          <p className="mt-2 mb-4 text-sm text-[#b7c9d8]">
            Branding only. The switch is on unless you turn it off. A custom domain is not connected.
          </p>
          {session && brand ? <WhiteLabelForm initial={brand} /> : <p className="text-sm">Sign in to save branding.</p>}
          <div className="mt-4 rounded-xl border border-[#245068] px-3 py-3 text-sm text-[#b7c9d8]" data-slot="domain-cost">
            <p className="font-medium text-[#f7fbff]">Custom domain cost</p>
            <p className="mt-1 text-xs text-[#8aa0b4]">Checked {DOMAIN_COST_AS_OF}. Not connected.</p>
            <ul className="mt-2 space-y-2">
              {DOMAIN_COST_LINES.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </div>
        </Panel>
        <Panel className="p-5">
          <h2 className="font-medium">Team</h2>
          <p className="mt-2 text-sm text-[#b7c9d8]">No teammates yet. Invites are not turned on.</p>
        </Panel>
      </div>
    </CockpitFrame>
  )
}

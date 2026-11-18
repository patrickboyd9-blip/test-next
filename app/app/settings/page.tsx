import { WhiteLabelForm } from "@/components/settings/WhiteLabelForm"
import { CockpitFrame, Eyebrow, Panel } from "@/components/cockpit/ui"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { getSession } from "@/lib/auth/session"
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
        </Panel>
        <Panel className="p-5">
          <h2 className="font-medium">Team</h2>
          <p className="mt-2 text-sm text-[#b7c9d8]">No teammates yet. Invites are not turned on.</p>
        </Panel>
      </div>
    </CockpitFrame>
  )
}

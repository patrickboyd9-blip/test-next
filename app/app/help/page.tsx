import { CockpitFrame, Eyebrow, Panel } from "@/components/cockpit/ui"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { getSession } from "@/lib/auth/session"
import { applyBrand } from "@/lib/white-label/brand"
import { readWhiteLabel } from "@/lib/white-label/store"

export const dynamic = "force-dynamic"

export default async function HelpPage() {
  const session = await getSession()
  const settings = session ? await readWhiteLabel(session.userId).catch(() => null) : null
  const brand = applyBrand(settings)
  const support = brand.supportEmail
    ? `${brand.supportName || "Support"} · ${brand.supportEmail}`
    : "No support contact is saved for this account."
  return (
    <CockpitFrame>
      <div className="mx-auto flex max-w-3xl flex-col gap-5 px-4 py-8 sm:px-6">
        <div className="flex items-center gap-3">
          <SidebarTrigger className="text-[#e7f2fb]" />
          <Eyebrow>Help</Eyebrow>
        </div>
        <h1 className="text-3xl font-semibold">Help</h1>
        <Panel className="p-5 text-sm leading-6 text-[#d5e6f2]">
          <p>Ask Comet from the button on this screen, or from the bottom of the menu.</p>
          <p className="mt-3">{support}</p>
          {brand.poweredBy ? <p className="mt-3 text-[#8aa0b4]">{brand.poweredBy}</p> : null}
        </Panel>
      </div>
    </CockpitFrame>
  )
}

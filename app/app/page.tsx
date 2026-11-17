import Link from "next/link"

import { getSession } from "@/lib/auth/session"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { HomeBoard } from "@/components/cockpit/HomeBoard"
import { SAMPLE_SHOP } from "@/lib/mailer-compose/flow"

export default async function CommandCenterPage() {
  const session = await getSession()
  const shop = session?.businessName || SAMPLE_SHOP

  return (
    <div className="flex flex-1 flex-col bg-[#05080f]">
      <div className="flex items-center gap-4 px-4 pt-4">
        <SidebarTrigger className="text-[#e7f2fb]" />
        {!session ? (
          <p className="text-sm text-[#8aa0b4]">Not signed in. The list below is a sample, not an account.</p>
        ) : null}
      </div>
      <HomeBoard shop={shop} />
      <div className="mx-auto mb-10 flex w-full max-w-3xl flex-col gap-2 px-4 text-sm sm:px-6">
        <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-[#7ee7ff]">Advanced</p>
        <p className="text-[#8aa0b4]">The older editor is still here. This page does not show result numbers.</p>
        <div className="flex flex-wrap gap-4">
          <Link href="/app/campaigns/new" className="min-h-11 text-[#8ecfff]">
            Full editor
          </Link>
          <Link href="/app/templates" className="min-h-11 text-[#8ecfff]">
            Templates
          </Link>
          <Link href="/app/design-requests" className="min-h-11 text-[#8ecfff]">
            Design requests
          </Link>
        </div>
      </div>
    </div>
  )
}

import Link from "next/link"

import { CometIntro } from "@/components/assistant/CometIntro"
import { cometIntroSeen } from "@/lib/assistant/intro-action"
import { getSession, previewDemoAllowed } from "@/lib/auth/session"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { HomeBoard } from "@/components/cockpit/HomeBoard"
import { CockpitFrame } from "@/components/cockpit/ui"
import { SAMPLE_SHOP } from "@/lib/mailer-compose/flow"

export default async function CommandCenterPage({
  searchParams,
}: {
  searchParams: Promise<{ intro?: string }>
}) {
  const params = await searchParams
  const session = await getSession()
  const shop = session?.businessName || SAMPLE_SHOP
  const replay = params.intro === "1" && (previewDemoAllowed() || process.env.NODE_ENV !== "production")
  const seen = session ? await cometIntroSeen(session.userId) : false
  const showIntro = replay || Boolean(session && !seen)

  return (
    <CockpitFrame hero>
      <div className="flex items-center gap-4 px-4 pt-4">
        <SidebarTrigger className="text-[#e7f2fb]" />
        {session?.fixture ? (
          <p className="text-sm text-[#8aa0b4]">Preview demo. Sample account. Nothing is mailed or charged.</p>
        ) : !session ? (
          <p className="text-sm text-[#8aa0b4]">Not signed in. The list below is a sample, not an account.</p>
        ) : null}
      </div>
      <HomeBoard shop={shop} sample={!session || session.fixture} />
      <CometIntro open={showIntro} />
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
    </CockpitFrame>
  )
}

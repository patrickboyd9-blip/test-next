import { CometIntro } from "@/components/assistant/CometIntro"
import { CommandCenter } from "@/components/cockpit/CommandCenter"
import { MilestoneComet } from "@/components/cockpit/MilestoneComet"
import { CockpitFrame } from "@/components/cockpit/ui"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { cometIntroSeen } from "@/lib/assistant/intro-action"
import { getSession, previewDemoAllowed } from "@/lib/auth/session"
import { listOwnedCampaigns } from "@/lib/campaign-creator/actions"
import { activityFor } from "@/lib/analytics/store"
import { emptySnapshot, labeledSampleSnapshot, snapshotFrom } from "@/lib/command-center/snapshot"
import { SAMPLE_SHOP } from "@/lib/mailer-compose/flow"
import { readAudit } from "@/lib/ops/audit"
import { applyBrand } from "@/lib/white-label/brand"
import { readWhiteLabel } from "@/lib/white-label/store"

export default async function CommandCenterPage({
  searchParams,
}: {
  searchParams: Promise<{ intro?: string; hour?: string; milestone?: string; preview?: string; sample?: string }>
}) {
  const params = await searchParams
  const allowTune = previewDemoAllowed() || process.env.NODE_ENV !== "production"
  const hour = allowTune && params.hour ? Number(params.hour) : Number.NaN
  const milestone = allowTune && params.milestone ? Number(params.milestone) : Number.NaN
  const session = await getSession()
  const shop = session?.businessName || SAMPLE_SHOP
  const replay = params.intro === "1" && allowTune
  const seen = session ? await cometIntroSeen(session.userId) : false
  const showIntro = replay || Boolean(session && !seen)
  const settings = session ? await readWhiteLabel(session.userId).catch(() => null) : null
  const brand = applyBrand(settings)
  const sample = params.sample === "1" && allowTune
  const snapshot = sample ? labeledSampleSnapshot() : await liveSnapshot(session?.userId)

  return (
    <CockpitFrame hero hour={Number.isFinite(hour) ? hour : undefined}>
      <div className="flex items-center gap-4 px-4 pt-4">
        <SidebarTrigger className="text-[#e7f2fb]" />
        {session?.fixture ? (
          <p className="text-sm text-[#8aa0b4]">Preview demo. Sample account. Nothing is mailed or charged.</p>
        ) : !session ? (
          <p className="text-sm text-[#8aa0b4]">Not signed in. The figures below stay empty.</p>
        ) : null}
      </div>
      <CommandCenter shop={shop} brand={brand} snapshot={snapshot} />
      <MilestoneComet
        total={0}
        ownerId={session?.userId ?? "signed-out"}
        sample={!session || Boolean(session.fixture)}
        preview={params.preview === "1"}
        force={Number.isFinite(milestone) ? milestone : undefined}
      />
      <CometIntro open={showIntro} />
    </CockpitFrame>
  )
}

async function liveSnapshot(ownerId: string | undefined) {
  if (!ownerId) return emptySnapshot()
  try {
    const campaigns = await listOwnedCampaigns()
    const audit = await readAudit().catch(() => [])
    const charges = audit.filter((event) => event.actorId === ownerId)
    const activity = activityFor(campaigns.map((campaign) => campaign.id))
    return snapshotFrom(campaigns, charges, new Date().toISOString(), ownerId, activity)
  } catch {
    return emptySnapshot()
  }
}
